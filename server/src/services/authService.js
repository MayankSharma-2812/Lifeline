const crypto       = require('crypto');
const bcrypt       = require('bcrypt');
const jwt          = require('jsonwebtoken');
const User         = require('../models/User');
const DonorProfile = require('../models/DonorProfile');
const { getRedis } = require('../config/redis');

const BCRYPT_ROUNDS    = 10;
const ACCESS_TOKEN_TTL = '15m';
const SESSION_TTL_SEC  = 7 * 24 * 60 * 60; // 7 days

// ── Helpers ──────────────────────────────────────────────────────

function sessionKey(sessionId) {
  return `session:${sessionId}`;
}

function makeAccessToken(userId) {
  return jwt.sign({ userId: userId.toString() }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Signup — per LLD §1 (User schema) and app flow.
 * Returns { accessToken, sessionId, refreshToken } — caller sets the cookie.
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
 * Login — per LLD §5 exactly.
 */
async function login(email, password) {
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }
  return _createSession(user);
}

/**
 * Refresh — per LLD §5 exactly.
 * Validates session in Redis, rotates refresh token, issues new access token.
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
 * Logout — per LLD §5. Deletes the Redis session key; cookie becomes instantly dead.
 * Returns the userId so the caller can emit a 'session-revoked' Socket.io event.
 */
async function logout(sessionId) {
  if (!sessionId) return null;
  // Fetch userId before deletion so the route can emit session-revoked
  const session = await getRedis().get(sessionKey(sessionId));
  await getRedis().del(sessionKey(sessionId));
  return session?.userId ?? null;
}

// ── Internal ─────────────────────────────────────────────────────

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
