/**
 * @module useSocket.ts
 * @description Provides a React hook for managing the lifecycle of the global Socket.io connection.
 */
import { useEffect } from 'react';
import { connectSocket, disconnectSocket } from '../lib/socket';
import { getAccessToken } from '../lib/api';
import { User } from '../types';

/**
 * Initializes and manages the Socket.io connection lifecycle for the application.
 *
 * Reconnects with fresh authentication token whenever the authenticated user changes.
 * It automatically terminates the socket connection when the user logs out or component unmounts.
 */
export function useSocket(user?: User | null) {
  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      disconnectSocket();
      return;
    }

    connectSocket();

    return () => {
      // Clean up connection on unmount or logout
      if (!getAccessToken()) {
        disconnectSocket();
      }
    };
  }, [user?._id]);
}
