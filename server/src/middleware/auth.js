const jwt = require('jsonwebtoken');

/**
 * authenticate — verifies the Bearer access token in the Authorization header.
 * Sets req.userId on success. Used by all protected route handlers.
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
