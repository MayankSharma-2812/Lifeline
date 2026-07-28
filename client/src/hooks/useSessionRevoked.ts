import { useEffect, useCallback } from 'react';
import { getSocket } from '../lib/socket';

/**
 * useSessionRevoked — listens for the 'session-revoked' event on the personal
 * user room and calls the provided callback so the app can show a toast and
 * redirect to login.
 *
 * Per HLD §3.1: "a Redis-backed session can be revoked instantly... a stateless
 * JWT can't be revoked before it expires without a blocklist."
 * This hook is the client-side half of that guarantee.
 *
 * @param onRevoked  Called with no args when the session is remotely revoked.
 */
export function useSessionRevoked(onRevoked: () => void) {
  const stableCallback = useCallback(onRevoked, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const socket = getSocket();
    socket.on('session-revoked', stableCallback);
    return () => {
      socket.off('session-revoked', stableCallback);
    };
  }, [stableCallback]);
}
