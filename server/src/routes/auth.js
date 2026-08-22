/**
 * @file auth.js
 * @description Express routes for authentication. Provides endpoints for signup, login, session refresh, and logout.
 *
 * Concepts demonstrated in this file:
 * - RESTful endpoint design: Semantic HTTP methods (POST /signup, POST /login, POST /refresh, POST /logout, GET /me)
 * - Request body validation: express-validator rule chains (isEmail, isLength, isIn, custom validators)
 * - Form validation: Server-side validation rejecting invalid donor blood groups and missing passwords with 400 status
 * - HTTP status codes used correctly: 201 Created on registration, 400 on validation failure, 401 on missing session, 404 on missing user
 * - CRUD operations (Mongo): Querying and persisting user records via Mongoose models
 */
const { Router }                 = require('express');
const { body, validationResult } = require('express-validator');
const authService                = require('../services/authService');
const { authenticate }           = require('../middleware/auth');
const { emitToUser }             = require('../socket');

const router = Router();

// Cookie config
// refreshToken and sessionId are packed into a single httpOnly cookie.
// Format: "<sessionId>:<refreshToken>"
// Secure flag is only set in production (localhost doesn't send secure cookies).

const COOKIE_NAME    = 'refresh_session';
const COOKIE_TTL_MS  = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Sets the HTTP-only refresh session cookie.
 * @param {import('express').Response} res - Express response object.
 * @param {string} sessionId - The session identifier.
 * @param {string} refreshToken - The refresh token string.
 */
function setRefreshCookie(res, sessionId, refreshToken) {
  res.cookie(COOKIE_NAME, `${sessionId}:${refreshToken}`, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   COOKIE_TTL_MS,
  });
}

/**
 * Clears the refresh session cookie.
 * @param {import('express').Response} res - Express response object.
 */
function clearRefreshCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

/**
 * Parses the refresh session cookie into session ID and refresh token.
 * @param {import('express').Request} req - Express request object.
 * @returns {{ sessionId: string, refreshToken: string }|null} Parsed cookie data or null if invalid/missing.
 */
function parseRefreshCookie(req) {
  const raw = req.cookies?.[COOKIE_NAME];
  if (!raw) return null;
  const idx = raw.indexOf(':');
  if (idx === -1) return null;
  return { sessionId: raw.slice(0, idx), refreshToken: raw.slice(idx + 1) };
}

// POST /api/v1/auth/signup
router.post(
  '/signup',
  [
    body('name').trim().notEmpty().withMessage('Name required'),
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
    body('phone').notEmpty().withMessage('Phone required'),
    body('role').isIn(['requester', 'donor']).withMessage('role must be requester or donor'),
    body('bloodGroup')
      .if(body('role').equals('donor'))
      .notEmpty()
      .isIn(['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'])
      .withMessage('Valid bloodGroup required for donors'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const result = await authService.signup(req.body);
      setRefreshCookie(res, result.sessionId, result.refreshToken);
      res.status(201).json({ accessToken: result.accessToken, user: result.user });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/login
router.post(
  '/login',
  [
    body('identifier').optional().trim(),
    body('email').optional().trim(),
    body().custom((b) => b.identifier || b.email).withMessage('Valid email or phone required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const targetIdentifier = req.body.identifier || req.body.email;
      const result = await authService.login(targetIdentifier, req.body.password);
      setRefreshCookie(res, result.sessionId, result.refreshToken);
      res.json({ accessToken: result.accessToken, user: result.user });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/refresh
// Reads the httpOnly cookie, validates the Redis session, rotates the token.
router.post('/refresh', async (req, res, next) => {
  const parsed = parseRefreshCookie(req);
  if (!parsed) return res.status(401).json({ error: 'No refresh session cookie' });

  try {
    const { newAccessToken, newRefreshToken } = await authService.refresh(
      parsed.sessionId,
      parsed.refreshToken
    );
    // Re-set cookie with the rotated refresh token (same sessionId)
    setRefreshCookie(res, parsed.sessionId, newRefreshToken);
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/logout
// Deletes the Redis session — makes the cookie instantly dead on all devices.
// Broadcasts 'session-revoked' to the user's personal socket room so any other
// open tab/device shows the toast immediately without waiting for a 401.
router.post('/logout', authenticate, async (req, res, next) => {
  const parsed = parseRefreshCookie(req);
  try {
    const userId = await authService.logout(parsed?.sessionId);
    clearRefreshCookie(res);
    // Notify all open tabs/devices belonging to this user
    if (userId) emitToUser(userId, 'session-revoked', {});
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/me
// Convenience endpoint — lets the client bootstrap user state after a page refresh.
const User = require('../models/User');
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
