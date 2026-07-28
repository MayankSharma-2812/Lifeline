const { Server } = require('socket.io');
const jwt        = require('jsonwebtoken');

let io;

// ── Initialise ───────────────────────────────────────────────────
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin:      process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  // ── Auth middleware — verify access token on every connection ──
  // Client must pass { auth: { token: accessToken } } when creating the socket.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.userId;
      next();
    } catch {
      next(new Error('Invalid or expired access token'));
    }
  });

  io.on('connection', (socket) => {
    // Every authenticated user auto-joins their personal room.
    // Used for: session-revoked events, incoming reservation notifications.
    socket.join(`user:${socket.userId}`);

    // Requester/donor join a request room to get status updates.
    socket.on('join:request', (requestId) => {
      socket.join(`request:${requestId}`);
    });

    // Donor explicitly joins their donor room (redundant with user room,
    // kept for clarity if donor-specific events are added later).
    socket.on('join:donor', (donorProfileId) => {
      socket.join(`donor:${donorProfileId}`);
    });

    socket.on('disconnect', () => {
      // Rooms cleaned up automatically by socket.io
    });
  });

  // eslint-disable-next-line no-console
  console.log('[socket.io] initialised');
  return io;
}

// ── Emit helpers (used by reservation / auth services) ───────────

/**
 * Broadcast a status event to everyone in a request's room.
 * Both the requester and the matched donor should be in this room.
 */
function emitSocketEvent(requestId, event, payload = {}) {
  if (!io) return; // no-op in unit tests
  io.to(`request:${requestId}`).emit(event, payload);
}

/**
 * Send an event to a specific user's personal room.
 * Used for: session-revoked, incoming reservation notifications.
 */
function emitToUser(userId, event, payload = {}) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

function getIO() {
  return io;
}

module.exports = { initSocket, emitSocketEvent, emitToUser, getIO };
