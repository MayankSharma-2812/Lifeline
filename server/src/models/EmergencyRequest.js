/**
 * @file EmergencyRequest.js
 * @description Mongoose schema for the EmergencyRequest model. Tracks the lifecycle of a blood request from creation to resolution.
 */
const mongoose = require('mongoose');

/**
 * EmergencyRequest schema as per LLD section 1.
 * Tracks the full lifecycle: pending to matched to reserved to confirmed, expired, or escalated.
 */
const emergencyRequestSchema = new mongoose.Schema(
  {
    requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rawText: { type: String, required: true },
    parsed: {
      bloodGroup: { type: String },
      urgency: { type: String, enum: ['critical', 'high', 'moderate'], default: 'moderate' },
    },
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

emergencyRequestSchema.index({ location: '2dsphere' });
emergencyRequestSchema.index({ requesterId: 1, status: 1 });

module.exports = mongoose.model('EmergencyRequest', emergencyRequestSchema);
