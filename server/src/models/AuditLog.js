/**
 * @file AuditLog.js
 * @description Mongoose schema for the AuditLog model. Provides an append-only ledger for all significant actions related to emergency requests.
 *
 * Concepts demonstrated in this file:
 * - Embedding vs referencing relationships: Referencing architecture using ObjectId foreign keys (requestId -> EmergencyRequest, actorId -> User) for unbounded audit growth
 * - Schema modeling (Mongo): Immutable append-only audit event schema with flexible Mixed metadata payloads
 * - Indexing for query performance (Mongo): Compound index on (requestId, timestamp desc) to optimize historical timeline queries
 */
const mongoose = require('mongoose');

/**
 * AuditLog schema as per LLD section 1. Append-only log of all significant actions.
 * Demonstrates Concepts: Embedding vs referencing relationships, Schema modeling (Mongo)
 */
const auditLogSchema = new mongoose.Schema({
  // Concept: Embedding vs referencing relationships — Referencing avoids document size limit from unbounded event growth
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmergencyRequest' },
  action:    { type: String, required: true }, // e.g. 'reserve', 'confirm', 'decline', 'escalate'
  actorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: Date, default: Date.now },
  metadata:  { type: mongoose.Schema.Types.Mixed, default: {} },
});

// Concept: Indexing for query performance (Mongo) — Compound index for fast chronological audit retrieval
auditLogSchema.index({ requestId: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
