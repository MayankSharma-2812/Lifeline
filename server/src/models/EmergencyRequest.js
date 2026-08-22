/**
 * @file EmergencyRequest.js
 * @description Mongoose schema for the EmergencyRequest model. Tracks the lifecycle of a blood request from creation to resolution.
 *
 * Concepts demonstrated in this file:
 * - Schema modeling (Mongo): Hybrid document schema with status enum, embedded objects, and GeoJSON Point coordinates
 * - Indexing for query performance (Mongo): 2dsphere spatial index for geospatial matching and compound index on (requesterId, status)
 * - Embedding vs referencing relationships: Embedded subdocuments (parsed, escalationHistory) paired with ObjectId references (requesterId -> User, matchedCandidateIds -> DonorProfile)
 */
const mongoose = require('mongoose');

/**
 * EmergencyRequest schema as per LLD section 1.
 * Tracks the full lifecycle: pending to matched to reserved to confirmed, expired, or escalated.
 * Demonstrates Concepts: Schema modeling (Mongo), Embedding vs referencing relationships
 */
const emergencyRequestSchema = new mongoose.Schema(
  {
    // Concept: Embedding vs referencing relationships — ObjectId referencing to User collection
    requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rawText: { type: String, required: true },
    // Concept: Embedding vs referencing relationships — Embedded subdocument for atomic reads
    parsed: {
      bloodGroup: { type: String },
      urgency: { type: String, enum: ['critical', 'high', 'moderate'], default: 'moderate' },
    },
    // Concept: Schema modeling (Mongo) — GeoJSON 2D Point structure for geospatial calculations
    location: {
      type:        { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    status: {
      type: String,
      enum: ['pending', 'matched', 'reserved', 'confirmed', 'expired', 'escalated', 'cancelled'],
      default: 'pending',
    },
    // Ordered list of candidate donorProfile IDs from the last match run
    matchedCandidateIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'DonorProfile' }],
    // The active Redis lock key — set when reserved, cleared on confirm/decline/expiry
    currentLockKey: { type: String, default: null },
    // Concept: Embedding vs referencing relationships — Embedded array of escalation attempts
    escalationHistory: [
      {
        donorId:  { type: mongoose.Schema.Types.ObjectId, ref: 'DonorProfile' },
        outcome:  { type: String, enum: ['no_response', 'declined'] },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Concept: Indexing for query performance (Mongo) — 2dsphere index for $geoNear aggregation
emergencyRequestSchema.index({ location: '2dsphere' });
// Concept: Indexing for query performance (Mongo) — Compound B-tree index for requester query performance
emergencyRequestSchema.index({ requesterId: 1, status: 1 });

module.exports = mongoose.model('EmergencyRequest', emergencyRequestSchema);
