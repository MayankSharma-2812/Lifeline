import { io, Socket } from 'socket.io-client';

/**
 * Lazy Socket.io singleton — created on first call to getSocket().
 * Connects to the same origin (Vite proxy forwards /socket.io to Express).
 * Phase 4 adds the event listener hooks.
 */
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', { withCredentials: true, autoConnect: false });
  }
  return socket;
}

export function connectSocket() {
  getSocket().connect();
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

/** Join the Socket.io room for a specific request so we receive its status updates. */
export function joinRequestRoom(requestId: string) {
  getSocket().emit('join:request', requestId);
}
