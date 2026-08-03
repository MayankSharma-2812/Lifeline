/**
 * @file auth.js
 * @description Authentication middleware. Verifies JSON Web Tokens (JWT) to secure API endpoints.
 */
const jwt = require('jsonwebtoken');

/**
 * Verifies the Bearer access token provided in the Authorization header.
 * Sets req.userId on successful verification. Used by all protected route handlers.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 * @returns {void|import('express').Response} Returns a 401 response if authentication fails, otherwise calls next().
 */
function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing access token' });
  }

  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired access token' });
  }
}

module.exports = { authenticate };
