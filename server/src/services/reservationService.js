const { getRedis }        = require('../config/redis');
const DonorProfile        = require('../models/DonorProfile');
const EmergencyRequest    = require('../models/EmergencyRequest');
const AuditLog            = require('../models/AuditLog');
const { emitSocketEvent, emitToUser } = require('../socket');
const { runMatchingForRequest } = require('./matchingService');

const LOCK_TTL_SECONDS = 900; // 15 minutes — per LLD §2

/**
 * reserveDonor — per LLD §4, the core showcase of this system.
 *
 * Uses Redis SET key value NX PX <ttl>:
 *   - NX (set if Not eXists) is an atomic read-then-write in a single Redis command.
 *   - Redis is single-threaded for command execution, so two concurrent callers
 *     CANNOT both get 'OK' — only one SET wins; the other gets null immediately.
 *   - This makes double-booking structurally impossible, not just unlikely.
 *
 * @param {string} requestId
 * @param {string} donorProfileId
 * @param {string} actorUserId      The requester triggering the reservation
 * @param {number} [ttl]            Lock TTL in seconds (default 15 min)
 */
async function reserveDonor(requestId, donorProfileId, actorUserId, ttl = LOCK_TTL_SECONDS) {
  const lockKey = `lock:donor:${donorProfileId}`;
  const redis   = getRedis();

  // ── The atomic lock acquisition ──────────────────────────────
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

  // ── Persist the reservation state ───────────────────────────
  await DonorProfile.findByIdAndUpdate(donorProfileId, { status: 'reserved' });
  await EmergencyRequest.findByIdAndUpdate(requestId, {
    status: 'reserved',
    currentLockKey: lockKey,
  });

  await AuditLog.create({
    requestId,
    action: 'reserve',
    actorId: actorUserId,
    metadata: { donorProfileId, lockKey, ttlSeconds: ttl },
  });

  // ── Push real-time event to the request room ─────────────────
  emitSocketEvent(requestId, 'reserved', { donorProfileId, expiresInSeconds: ttl });

  // ── Also notify the donor directly on their personal room ─────
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
 * confirmReservation — donor accepts the request.
 * Releases lock, marks donor on_cooldown (+2 reliability), sets status confirmed.
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

  await AuditLog.create({
    requestId,
    action: 'confirm',
    actorId: actorUserId,
    metadata: { donorProfileId },
  });

  emitSocketEvent(requestId, 'confirmed', { donorProfileId });
}

/**
 * declineAndEscalate — donor declines OR TTL expiry is simulated.
 *
 * Escalation state machine (LLD §6):
 *   reserved → escalated → matched (next candidate) | expired (no candidates)
 *
 * @param {string} requestId
 * @param {string} donorProfileId   The donor who declined / didn't respond
 * @param {'declined'|'no_response'} outcome
 * @param {string} actorUserId
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

  await AuditLog.create({
    requestId,
    action: 'escalate',
    actorId: actorUserId,
    metadata: { donorProfileId, outcome, scoreAdjustment },
  });

  emitSocketEvent(requestId, 'escalated', { donorProfileId, outcome });

  // ── Find next candidate (excluding already-tried donors) ─────
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
