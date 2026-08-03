/**
 * @module useSocket.ts
 * @description Provides a React hook for managing the lifecycle of the global Socket.io connection.
 */
import { useEffect, useRef } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';
import { getAccessToken } from '../lib/api';

/**
 * Initializes and manages the Socket.io connection lifecycle for the application.
 *
 * This hook should be invoked once at a high level (e.g., within a layout or main app component)
 * to ensure the connection remains active as long as the application is running. It attaches the
 * current access token for JWT verification by the server middleware.
 *
 * It automatically terminates the socket connection when the component unmounts.
 */
export function useSocket() {
  const connected = useRef(false);

  useEffect(() => {
    // Prevent duplicate connections during React strict mode double-invocations
    if (connected.current) return;

    const socket = getSocket();
    
    // Attach the auth token before initiating the connection request
    socket.auth = { token: getAccessToken() ?? '' };
    connectSocket();
    connected.current = true;

    return () => {
      // Disconnect and reset state on unmount
      disconnectSocket();
      connected.current = false;
    };
  }, []);
}
