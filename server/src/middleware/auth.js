/**
 * @file auth.js
 * @description Authentication middleware. Verifies JSON Web Tokens (JWT) to secure API endpoints.
 *
 * Concepts demonstrated in this file:
 * - Middleware: Express route-level authentication guard intercepting incoming HTTP requests
 * - HTTP status codes used correctly: Explicit 401 Unauthorized responses for missing, malformed, or expired tokens
 * - Environment variables & secrets management: Reads JWT_SECRET from environment for cryptographic signature verification
 * - JWT issuance & verification: jwt.verify decoding payload and populating req.userId
 */
const jwt = require('jsonwebtoken');

/**
 * Verifies the Bearer access token provided in the Authorization header.
 * Sets req.userId on successful verification. Used by all protected route handlers.
 * Demonstrates Concepts: Middleware, HTTP status codes used correctly, Environment variables & secrets management
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 * @returns {void|import('express').Response} Returns a 401 response if authentication fails, otherwise calls next().
 */
function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  // Concept: HTTP status codes used correctly — 401 for unauthenticated request
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing access token' });
  }

  const token = auth.slice(7);
  try {
    // Concept: Environment variables & secrets management & JWT verification
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    // Concept: HTTP status codes used correctly — 401 on token expiration or invalid signature
    res.status(401).json({ error: 'Invalid or expired access token' });
  }
}

module.exports = { authenticate };
