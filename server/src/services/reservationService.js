/**
 * @file reservationService.js
 * @description Handles the atomic reservation of donors using Redis distributed locks to prevent double-booking.
 */
const { getRedis }        = require('../config/redis');
const DonorProfile        = require('../models/DonorProfile');
const EmergencyRequest    = require('../models/EmergencyRequest');
const { emitSocketEvent, emitToUser } = require('../socket');
const { runMatchingForRequest } = require('./matchingService');
const { recordAuditEvent }     = require('./auditService');

const LOCK_TTL_SECONDS = 900; // 15 minutes — per LLD §2

/**
 * Reserves a donor atomically using a Redis distributed lock (SET NX PX).
 * Ensures double-booking is structurally impossible. Implementation based on LLD section 4.
 *
 * @param {string} requestId - The ID of the associated emergency request.
 * @param {string} donorProfileId - The ID of the donor profile to reserve.
 * @param {string} actorUserId - The ID of the user triggering the reservation.
 * @param {number} [ttl=900] - Lock Time-To-Live in seconds (default 15 minutes).
 * @returns {Promise<{ lockKey: string, donorProfileId: string }>} Result containing lock details.
 * @throws {Error} If the donor is already reserved by another request.
 */
async function reserveDonor(requestId, donorProfileId, actorUserId, ttl = LOCK_TTL_SECONDS) {
  const lockKey = `lock:donor:${donorProfileId}`;
  const redis   = getRedis();

  // The atomic lock acquisition
  // SET lockKey requestId NX PX <ttl_ms>
  // Returns 'OK' if acquired, null if key already exists (already reserved).
  const acquired = await redis.set(lockKey, requestId.toString(), {
    nx: true,
    px: ttl * 1000,
  });

  if (!acquired) {
    const err = new Error('Donor already reserved by another request');
    err.status = 409;
    throw err;
  }

  // Persist the reservation state
  await DonorProfile.findByIdAndUpdate(donorProfileId, { status: 'reserved' });
  await EmergencyRequest.findByIdAndUpdate(requestId, {
    status: 'reserved',
    currentLockKey: lockKey,
  });

  await recordAuditEvent({
    requestId,
    action: 'reserve',
    actorId: actorUserId,
    donorProfileId,
    metadata: { lockKey, ttlSeconds: ttl },
  });

  // Push real-time event to the request room
  emitSocketEvent(requestId, 'reserved', { donorProfileId, expiresInSeconds: ttl });

  // Also notify the donor directly on their personal room
  // The donor may not have joined the request room yet — this ensures
  // they see the incoming reservation notification on their dashboard.
  const donorDoc = await DonorProfile.findById(donorProfileId).select('userId');
  if (donorDoc) {
    emitToUser(donorDoc.userId.toString(), 'reservation:incoming', {
      requestId:       requestId.toString(),
      donorProfileId:  donorProfileId.toString(),
      expiresInSeconds: ttl,
    });
  }

  return { lockKey, donorProfileId };
}

/**
 * Confirms a donor's reservation.
 * Releases the lock, applies reliability score bonus, and marks the donor as on cooldown.
 *
 * @param {string} requestId - The emergency request ID.
 * @param {string} donorProfileId - The confirmed donor profile ID.
 * @param {string} actorUserId - The user ID of the confirming donor.
 * @returns {Promise<void>}
 * @throws {Error} If the lock expired or is not held by this request.
 */
async function confirmReservation(requestId, donorProfileId, actorUserId) {
  const redis   = getRedis();
  const lockKey = `lock:donor:${donorProfileId}`;

  // Verify this request still holds the lock (it may have expired)
  const lockHolder = await redis.get(lockKey);
  if (lockHolder?.toString() !== requestId.toString()) {
    const err = new Error('Reservation lock expired or not held by this request');
    err.status = 409;
    throw err;
  }

  await redis.del(lockKey);

  // +2 reliability on confirm, donor goes to cooldown (not available immediately)
  await DonorProfile.findByIdAndUpdate(donorProfileId, {
    status: 'on_cooldown',
    lastDonationDate: new Date(),
    $inc: { reliabilityScore: 2 },
  });

  await EmergencyRequest.findByIdAndUpdate(requestId, {
    status: 'confirmed',
    currentLockKey: null,
  });

  await recordAuditEvent({
    requestId,
    action: 'confirm',
    actorId: actorUserId,
    donorProfileId,
    metadata: {},
  });

  emitSocketEvent(requestId, 'confirmed', { donorProfileId });
}

/**
 * Handles donor declines or reservation expiry, initiating the escalation flow.
 * Releases the lock, applies reliability penalties if applicable, and attempts to match the next candidate.
 * Follows the escalation state machine defined in LLD section 6.
 *
 * @param {string} requestId - The emergency request ID.
 * @param {string} donorProfileId - The donor profile ID that declined or timed out.
 * @param {'declined'|'no_response'} outcome - The reason for escalation.
 * @param {string} actorUserId - The user ID triggering the escalation.
 * @returns {Promise<{ nextCandidate: Object|null }>} The next matched candidate, if any.
 */
async function declineAndEscalate(requestId, donorProfileId, outcome, actorUserId) {
  const redis   = getRedis();
  const lockKey = `lock:donor:${donorProfileId}`;

  // Release the Redis lock — donor becomes reservable again
  await redis.del(lockKey);

  // Reliability penalty: -10 for no_response, no change for an explicit decline
  const scoreAdjustment = outcome === 'no_response' ? -10 : 0;
  const donorUpdate = { status: 'available' };
  if (scoreAdjustment !== 0) donorUpdate.$inc = { reliabilityScore: scoreAdjustment };

  await DonorProfile.findByIdAndUpdate(donorProfileId, donorUpdate);

  // Record the escalation step and move to 'escalated' status
  const updatedRequest = await EmergencyRequest.findByIdAndUpdate(
    requestId,
    {
      status: 'escalated',
      currentLockKey: null,
      $push: { escalationHistory: { donorId: donorProfileId, outcome, timestamp: new Date() } },
    },
    { new: true }
  );

  await recordAuditEvent({
    requestId,
    action: 'escalate',
    actorId: actorUserId,
    donorProfileId,
    metadata: { outcome, scoreAdjustment },
  });

  emitSocketEvent(requestId, 'escalated', { donorProfileId, outcome });

  // Find next candidate (excluding already-tried donors)
  const triedIds = updatedRequest.escalationHistory.map((h) => h.donorId.toString());

  const { candidates } = await runMatchingForRequest(requestId, triedIds);
  const nextCandidate = candidates.find((c) => !triedIds.includes(c.donorProfileId.toString()));

  if (nextCandidate) {
    await EmergencyRequest.findByIdAndUpdate(requestId, { status: 'matched' });
    emitSocketEvent(requestId, 'matched', { candidates });
  } else {
    await EmergencyRequest.findByIdAndUpdate(requestId, { status: 'expired' });
    emitSocketEvent(requestId, 'expired', {});
  }

  return { nextCandidate: nextCandidate ?? null };
}

module.exports = { reserveDonor, confirmReservation, declineAndEscalate };
