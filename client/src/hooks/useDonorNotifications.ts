/**
 * @module useDonorNotifications.ts
 * @description Hook that listens for incoming push notifications specifically targeted at the active donor.
 */
import { useEffect, useState } from 'react';
import { getSocket } from '../lib/socket';

export interface IncomingReservation {
  requestId: string;
  donorProfileId: string;
  expiresInSeconds: number;
}

/**
 * Subscribes to the authenticated user's private socket room to monitor for immediate reservation alerts.
 *
 * When a requester locks onto this donor, the server emits a 'reservation:incoming' event directly
 * to this donor's personal channel. This allows real-time alerting on the dashboard without requiring
 * the client to poll or know the request ID beforehand.
 *
 * @returns An object containing the latest incoming reservation alert and a method to dismiss it.
 */
export function useDonorNotifications() {
  const [incoming, setIncoming] = useState<IncomingReservation | null>(null);

  useEffect(() => {
    const socket = getSocket();

    const handler = (payload: IncomingReservation) => {
      setIncoming(payload);
    };

    // Attach listener for incoming reservation requests
    socket.on('reservation:incoming', handler);
    return () => {
      // Remove listener on unmount to prevent state updates on unmounted components
      socket.off('reservation:incoming', handler);
    };
  }, []); // Run once on mount; relies on the global socket instance

  const dismiss = () => setIncoming(null);

  return { incoming, dismiss };
}
