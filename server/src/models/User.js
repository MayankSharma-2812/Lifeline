/**
 * @file User.js
 * @description Mongoose schema for the User model. Defines user accounts, authentication data, roles, and geographical locations.
 */
const mongoose = require('mongoose');

/**
 * User schema as per LLD section 1.
 * The 2dsphere index on location enables the $geoNear matching queries in Phase 2.
 */
const userSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, trim: true },
    // BUG-11 fix: unique constraint on phone to avoid non-deterministic login
    phone:        { type: String, required: true, unique: true, trim: true },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role:         { type: String, enum: ['requester', 'donor'], required: true },
    // BUG-10 fix: Avoid defaulting to [0, 0] (Null Island) when location is not supplied
    location: {
      type:        { type: String, enum: ['Point'] },
      coordinates: { type: [Number] }, // [longitude, latitude]
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Geospatial index is required for $geoNear aggregation in the matching engine
userSchema.index({ location: '2dsphere' }, { sparse: true });

module.exports = mongoose.model('User', userSchema);
