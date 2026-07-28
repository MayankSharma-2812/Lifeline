const { Router }                = require('express');
const { body, validationResult } = require('express-validator');
const authService               = require('../services/authService');
const { authenticate }          = require('../middleware/auth');

const router = Router();

// ── Cookie config ────────────────────────────────────────────────
// refreshToken and sessionId are packed into a single httpOnly cookie.
// Format: "<sessionId>:<refreshToken>"
// Secure flag is only set in production (localhost doesn't send secure cookies).

const COOKIE_NAME    = 'refresh_session';
const COOKIE_TTL_MS  = 7 * 24 * 60 * 60 * 1000; // 7 days

function setRefreshCookie(res, sessionId, refreshToken) {
  res.cookie(COOKIE_NAME, `${sessionId}:${refreshToken}`, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   COOKIE_TTL_MS,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

function parseRefreshCookie(req) {
  const raw = req.cookies?.[COOKIE_NAME];
  if (!raw) return null;
  const idx = raw.indexOf(':');
  if (idx === -1) return null;
  return { sessionId: raw.slice(0, idx), refreshToken: raw.slice(idx + 1) };
}

// ── POST /api/v1/auth/signup ─────────────────────────────────────
router.post(
  '/signup',
  [
    body('name').trim().notEmpty().withMessage('Name required'),
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
    body('phone').notEmpty().withMessage('Phone required'),
    body('role').isIn(['requester', 'donor']).withMessage('role must be requester or donor'),
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

// ── POST /api/v1/auth/login ──────────────────────────────────────
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      setRefreshCookie(res, result.sessionId, result.refreshToken);
      res.json({ accessToken: result.accessToken, user: result.user });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/v1/auth/refresh ────────────────────────────────────
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

// ── POST /api/v1/auth/logout ─────────────────────────────────────
// Deletes the Redis session — makes the cookie instantly dead on all devices.
router.post('/logout', authenticate, async (req, res, next) => {
  const parsed = parseRefreshCookie(req);
  try {
    await authService.logout(parsed?.sessionId);
    clearRefreshCookie(res);
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/auth/me ──────────────────────────────────────────
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
