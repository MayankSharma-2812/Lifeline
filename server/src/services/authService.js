/**
 * @file authService.js
 * @description Authentication service. Handles user registration, login, session management using Redis, and token generation.
 */
const crypto       = require('crypto');
const bcrypt       = require('bcrypt');
const jwt          = require('jsonwebtoken');
const User         = require('../models/User');
const DonorProfile = require('../models/DonorProfile');
const { getRedis } = require('../config/redis');

const BCRYPT_ROUNDS    = 10;
const ACCESS_TOKEN_TTL = '15m';
const SESSION_TTL_SEC  = 7 * 24 * 60 * 60; // 7 days

// Helpers

/**
 * Generates the Redis key for a given session ID.
 * @param {string} sessionId - The session identifier.
 * @returns {string} The formatted Redis key.
 */function sessionKey(sessionId) {
  return `session:${sessionId}`;
}

/**
 * Generates a JSON Web Token for the given user ID.
 * @param {string|mongoose.Types.ObjectId} userId - The user's ID.
 * @returns {string} The signed JWT access token.
 */
function makeAccessToken(userId) {
  return jwt.sign({ userId: userId.toString() }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

// Public API

/**
 * Registers a new user and automatically creates a DonorProfile if role is donor.
 * Implements logic as per LLD section 1 (User schema) and application flow.
 *
 * @param {Object} params - The user registration data.
 * @param {string} params.name - User's full name.
 * @param {string} params.phone - User's phone number.
 * @param {string} params.email - User's email address.
 * @param {string} params.password - Plain text password.
 * @param {string} params.role - Role, either 'requester' or 'donor'.
 * @param {Object} [params.location] - Optional location {lng, lat}.
 * @returns {Promise<Object>} Contains accessToken, sessionId, refreshToken, and user details.
 */
async function signup({ name, phone, email, password, role, location }) {
  const existing = await User.findOne({ email });
  if (existing) {
    const err = new Error('Email already registered');
    err.status = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await User.create({
    name,
    phone,
    email,
    passwordHash,
    role,
    ...(location && {
      location: { type: 'Point', coordinates: [location.lng, location.lat] },
    }),
  });

  // Auto-create DonorProfile for donor registrations
  if (role === 'donor') {
    if (!bloodGroup) {
      const err = new Error('bloodGroup is required when role is donor');
      err.status = 400;
      throw err;
    }
    await DonorProfile.create({ userId: user._id, bloodGroup });
  }

  return _createSession(user);
}

/**
 * Authenticates a user by email or phone. Supports LLD section 5.
 *
 * @param {string} identifier - The user's email or phone number.
 * @param {string} password - The plain text password.
 * @returns {Promise<Object>} Contains accessToken, sessionId, refreshToken, and user details.
 */
async function login(identifier, password) {
  if (!identifier) {
    const err = new Error('Email or phone is required');
    err.status = 400;
    throw err;
  }

  const user = await User.findOne({
    $or: [{ email: identifier }, { phone: identifier }],
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }
  return _createSession(user);
}

/**
 * Refreshes an active session by rotating tokens.
 * Validates session in Redis, rotates refresh token, issues new access token.
 * Matches LLD section 5 exactly.
 *
 * @param {string} sessionId - The current session identifier.
 * @param {string} refreshToken - The current refresh token.
 * @returns {Promise<Object>} Contains newAccessToken and newRefreshToken.
 */
async function refresh(sessionId, refreshToken) {
  const redis = getRedis();
  const session = await redis.get(sessionKey(sessionId));

  if (!session) {
    const err = new Error('Session revoked or expired');
    err.status = 401;
    throw err;
  }

  // @upstash/redis auto-parses JSON so session is already an object
  const { userId, refreshTokenHash } = session;

  if (!(await bcrypt.compare(refreshToken, refreshTokenHash))) {
    const err = new Error('Invalid refresh token');
    err.status = 401;
    throw err;
  }

  // Rotate — new refresh token, new hash, same sessionId, reset TTL
  const newRefreshToken = crypto.randomBytes(40).toString('hex');
  await redis.set(
    sessionKey(sessionId),
    { userId, refreshTokenHash: await bcrypt.hash(newRefreshToken, BCRYPT_ROUNDS) },
    { ex: SESSION_TTL_SEC }
  );

  return {
    newAccessToken: makeAccessToken(userId),
    newRefreshToken,
  };
}

/**
 * Terminates a session by deleting it from Redis. The session cookie becomes instantly invalid.
 * Implements logic per LLD section 5.
 *
 * @param {string} sessionId - The session identifier to revoke.
 * @returns {Promise<string|null>} The user ID associated with the revoked session, or null if not found.
 */
async function logout(sessionId) {
  if (!sessionId) return null;
  // Fetch userId before deletion so the route can emit session-revoked
  const session = await getRedis().get(sessionKey(sessionId));
  await getRedis().del(sessionKey(sessionId));
  return session?.userId ?? null;
}

// Internal

async function _createSession(user) {
  const accessToken  = makeAccessToken(user._id);
  const refreshToken = crypto.randomBytes(40).toString('hex');
  const sessionId    = crypto.randomUUID();

  // Store hashed refresh token in Redis — per LLD §5
  await getRedis().set(
    sessionKey(sessionId),
    { userId: user._id.toString(), refreshTokenHash: await bcrypt.hash(refreshToken, BCRYPT_ROUNDS) },
    { ex: SESSION_TTL_SEC }
  );

  return {
    accessToken,
    sessionId,
    refreshToken,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  };
}

module.exports = { signup, login, refresh, logout };
