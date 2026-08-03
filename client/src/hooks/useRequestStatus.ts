/**
 * @module useRequestStatus.ts
 * @description Hook for subscribing to real-time status updates of an emergency request via Socket.io.
 */
import { useEffect, useState } from 'react';
import { getSocket, joinRequestRoom } from '../lib/socket';

export type RequestStatus =
  | 'pending'
  | 'matched'
  | 'reserved'
  | 'confirmed'
  | 'escalated'
  | 'expired'
  | 'cancelled';

export interface StatusPayload {
  donorProfileId?: string;
  expiresInSeconds?: number;
  candidates?: unknown[];
  [key: string]: unknown;
}

export interface StatusEvent {
  status: RequestStatus;
  payload: StatusPayload;
}

const STATUS_EVENTS: RequestStatus[] = [
  'matched',
  'reserved',
  'confirmed',
  'escalated',
  'expired',
];

/**
 * Subscribes to real-time status transition events for a specific emergency request.
 *
 * Automatically joins the designated Socket.io room (`request:{requestId}`) and sets up listeners
 * for state changes. This enables the UI to reflect progress (e.g., stepper updates, countdowns)
 * immediately without relying on HTTP polling.
 *
 * @param requestId - The unique ID of the emergency request. Pass null to disable the subscription.
 * @returns The most recent status event received, or null if no events have occurred.
 */
export function useRequestStatus(requestId: string | null) {
  const [statusEvent, setStatusEvent] = useState<StatusEvent | null>(null);

  useEffect(() => {
    if (!requestId) return;

    const socket = getSocket();
    // Register the client into the specific room for this request
    joinRequestRoom(requestId);

    // Map over defined status events to attach individual listeners
    const handlers = STATUS_EVENTS.map((event) => {
      const handler = (payload: StatusPayload) => {
        setStatusEvent({ status: event, payload });
      };
      socket.on(event, handler);
      return { event, handler };
    });

    return () => {
      // Detach all listeners explicitly on cleanup to prevent memory leaks and duplicate triggers
      handlers.forEach(({ event, handler }) => socket.off(event, handler));
    };
  }, [requestId]); // Re-run setup only if the tracked request ID changes

  return statusEvent;
}
