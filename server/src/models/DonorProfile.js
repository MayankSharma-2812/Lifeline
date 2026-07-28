const mongoose = require('mongoose');

/**
 * DonorProfile — per LLD §1.
 * Compound index on { bloodGroup, status } enables fast filtered matching queries.
 */
const donorProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  bloodGroup: {
    type: String,
    enum: ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'],
    required: true,
  },
  lastDonationDate: { type: Date, default: null },
  isAvailable: { type: Boolean, default: true },
  reliabilityScore: { type: Number, default: 100 }, // -10 no-response, +2 confirmed
  status: {
    type: String,
    enum: ['available', 'reserved', 'on_cooldown'],
    default: 'available',
  },
});

// LLD §1 specified compound index
donorProfileSchema.index({ bloodGroup: 1, status: 1 });

module.exports = mongoose.model('DonorProfile', donorProfileSchema);
