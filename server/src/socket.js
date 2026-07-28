const { Server } = require("socket.io");

let io;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    // Requester/donor joins a room keyed by requestId
    socket.on("join:request", (requestId) => {
      socket.join(`request:${requestId}`);
    });

    socket.on("disconnect", () => {
      // rooms are cleaned up automatically by socket.io
    });
  });

  // eslint-disable-next-line no-console
  console.log("[socket.io] initialised");
  return io;
}

/** Emit a status event to everyone in a request's room */
function emitSocketEvent(requestId, event, payload = {}) {
  if (!io) return; // no-op if socket not initialised (e.g. in unit tests)
  io.to(`request:${requestId}`).emit(event, payload);
}

function getIO() {
  return io;
}

module.exports = { initSocket, emitSocketEvent, getIO };
