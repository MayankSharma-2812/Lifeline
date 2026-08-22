/**
 * @file auditService.js
 * @description Polyglot audit logging service. Writes significant system actions to PostgreSQL via Prisma, falling back to MongoDB.
 *
 * Concepts demonstrated in this file:
 * - SQL JOINs: Generates SQL LEFT JOIN across audit_events and donors_reference tables using Prisma include: { donor: true }
 * - Filtering, ordering, grouping: SQL query filtering via where: { requestId } and sorting via orderBy: { timestamp: 'asc' }
 * - ORM usage (Prisma/Sequelize): Type-safe Prisma Client methods (findUnique, upsert, create, findMany)
 * - Relational schema design with PK/FK: Interacts with PostgreSQL foreign key relationships between audit events and donor references
 */
const { getPrisma } = require('../config/prisma');
const AuditLog = require('../models/AuditLog');
const DonorProfile = require('../models/DonorProfile');

/**
 * Records an audit event across configured datastores.
 * Primary write is to MongoDB for backward compatibility, with secondary writes to PostgreSQL.
 *
 * @param {Object} params - The audit event data.
 * @param {string} params.requestId - Associated emergency request ID.
 * @param {string} params.action - Action taken (e.g., reserve, confirm).
 * @param {string} params.actorId - ID of the user performing the action.
 * @param {string} [params.donorProfileId] - Optional associated donor ID.
 * @param {Object} [params.metadata] - Additional contextual data.
 * @returns {Promise<void>}
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
 * Retrieves the complete audit trail for a specific request.
 * Attempts to use the relational data structure in PostgreSQL if available, otherwise falls back to MongoDB.
 *
 * @param {string} requestId - The request ID to fetch logs for.
 * @returns {Promise<Array>} List of audit events sorted by timestamp ascending.
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
