/**
 * @file AuditLog.js
 * @description Mongoose schema for the AuditLog model. Provides an append-only ledger for all significant actions related to emergency requests.
 */
const mongoose = require('mongoose');

/**
 * AuditLog schema as per LLD section 1. Append-only log of all significant actions.
 */
const auditLogSchema = new mongoose.Schema({
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmergencyRequest' },
  action:    { type: String, required: true }, // e.g. 'reserve', 'confirm', 'decline', 'escalate'
  actorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: Date, default: Date.now },
  metadata:  { type: mongoose.Schema.Types.Mixed, default: {} },
});

auditLogSchema.index({ requestId: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
