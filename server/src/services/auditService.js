const { getPrisma } = require('../config/prisma');
const AuditLog = require('../models/AuditLog');
const DonorProfile = require('../models/DonorProfile');

/**
 * recordAuditEvent — Writes audit events to PostgreSQL (donors_reference & audit_events).
 * Falls back safely to Mongo AuditLog if Postgres DB is unconfigured or unavailable.
 */
async function recordAuditEvent({ requestId, action, actorId, donorProfileId, metadata }) {
  // Always record in Mongo for backward compatibility / backup
  try {
    await AuditLog.create({
      requestId,
      action,
      actorId,
      metadata: metadata || {},
    });
  } catch (err) {
    // Mongo fallback log error ignored if any
  }

  // Record in PostgreSQL via Prisma (Polyglot Persistence)
  if (process.env.DATABASE_URL) {
    try {
      const prisma = getPrisma();
      let postgresDonorId = null;

      if (donorProfileId) {
        // Ensure donor_reference exists in PostgreSQL (relational foreign key target)
        let donorRef = await prisma.donorReference.findUnique({
          where: { mongoDonorId: donorProfileId.toString() },
        });

        if (!donorRef) {
          // Fetch donor name & bloodGroup from Mongo to populate relational reference table
          const donorDoc = await DonorProfile.findById(donorProfileId).populate('userId', 'name');
          const donorName = donorDoc?.userId?.name || 'Anonymous Donor';
          const bloodGroup = donorDoc?.bloodGroup || 'Unknown';

          donorRef = await prisma.donorReference.upsert({
            where: { mongoDonorId: donorProfileId.toString() },
            update: { name: donorName, bloodGroup },
            create: {
              mongoDonorId: donorProfileId.toString(),
              name: donorName,
              bloodGroup,
            },
          });
        }
        postgresDonorId = donorRef.id;
      }

      await prisma.auditEvent.create({
        data: {
          requestId: requestId.toString(),
          action,
          actorId: actorId ? actorId.toString() : 'system',
          donorId: postgresDonorId,
          metadata: metadata || {},
          timestamp: new Date(),
        },
      });
    } catch (err) {
      console.warn('[AuditService] Postgres audit write skipped:', err.message);
    }
  }
}

/**
 * getAuditTrailForRequest — Demonstrates real SQL JOIN query via Prisma ORM.
 * Joins audit_events with donors_reference to include donor name & blood_group.
 */
async function getAuditTrailForRequest(requestId) {
  if (process.env.DATABASE_URL) {
    try {
      const prisma = getPrisma();
      // REAL SQL JOIN: audit_events LEFT JOIN donors_reference ON audit_events.donor_id = donors_reference.id
      const events = await prisma.auditEvent.findMany({
        where: { requestId: requestId.toString() },
        include: {
          donor: {
            select: {
              id: true,
              mongoDonorId: true,
              name: true,
              bloodGroup: true,
            },
          },
        },
        orderBy: { timestamp: 'asc' },
      });
      return events;
    } catch (err) {
      console.warn('[AuditService] Postgres audit query error, falling back to Mongo:', err.message);
    }
  }

  // Fallback to Mongo query if Postgres not configured
  const mongoLogs = await AuditLog.find({ requestId }).sort({ createdAt: 1 }).lean();
  return mongoLogs.map((log) => ({
    id: log._id.toString(),
    requestId: log.requestId.toString(),
    action: log.action,
    actorId: log.actorId.toString(),
    timestamp: log.createdAt,
    donor: null,
    metadata: log.metadata,
  }));
}

module.exports = { recordAuditEvent, getAuditTrailForRequest };
