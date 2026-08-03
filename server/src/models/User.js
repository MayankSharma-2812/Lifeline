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
    phone:        { type: String, required: true },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role:         { type: String, enum: ['requester', 'donor'], required: true },
    location: {
      type:        { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }, // [longitude, latitude]
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Geospatial index is required for $geoNear aggregation in the matching engine
userSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('User', userSchema);
