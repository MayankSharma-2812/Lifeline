import React, { useEffect, useState } from 'react';
import { useRequestStatus } from '../hooks/useRequestStatus';
import { confirmReservationApi, declineReservationApi } from '../lib/api';

interface ReservationStatusScreenProps {
  requestId: string;
  donorProfileId: string;
  lockKey?: string;
  onDone: () => void;
}

export const ReservationStatusScreen: React.FC<ReservationStatusScreenProps> = ({
  requestId,
  donorProfileId,
  lockKey,
  onDone,
}) => {
  const statusEvent = useRequestStatus(requestId);
  const currentStatus = statusEvent?.status || 'reserved';

  const [secondsLeft, setSecondsLeft] = useState(900); // 15 minutes default
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await confirmReservationApi(requestId, donorProfileId);
      setMessage('Donation confirmed successfully! Donor reliability updated +2.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to confirm reservation.');
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async (outcome: 'declined' | 'no_response' = 'declined') => {
    setLoading(true);
    setError(null);
    try {
      const res = await declineReservationApi(requestId, donorProfileId, outcome);
      setMessage(
        res.nextCandidate
          ? `Escalated — Lock released. Next donor matching triggered.`
          : `Escalated — No further donors found.`
      );
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to decline reservation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Main Reservation Card */}
      <div className="bg-white dark:bg-on-background border border-outline-variant dark:border-outline rounded-xl p-8 shadow-lg space-y-8 relative overflow-hidden">
        {/* Status Stepper */}
        <div className="border-b border-outline-variant pb-6">
          <div className="flex justify-between items-center mb-4">
            <span className="font-label-caps text-xs text-secondary uppercase tracking-widest">
              Live State Machine
            </span>
            <span className="font-mono text-xs bg-surface-container-high px-2.5 py-1 rounded text-on-surface">
              {lockKey || `lock:donor:${donorProfileId}`}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold">
            <div className="p-2 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              <span>Matched</span>
            </div>
            <div
              className={`p-2 rounded flex items-center justify-center gap-1 ${
                currentStatus === 'reserved'
                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 ring-2 ring-amber-500'
                  : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800'
              }`}
            >
              <span className="material-symbols-outlined text-sm">lock</span>
              <span>Reserved</span>
            </div>
            <div
              className={`p-2 rounded flex items-center justify-center gap-1 ${
                currentStatus === 'confirmed'
                  ? 'bg-emerald-500 text-white font-bold'
                  : 'bg-surface-container-low text-secondary'
              }`}
            >
              <span className="material-symbols-outlined text-sm">verified</span>
              <span>Confirmed</span>
            </div>
            <div
              className={`p-2 rounded flex items-center justify-center gap-1 ${
                currentStatus === 'escalated' || currentStatus === 'expired'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-surface-container-low text-secondary'
              }`}
            >
              <span className="material-symbols-outlined text-sm">published_with_changes</span>
              <span>{currentStatus === 'escalated' ? 'Escalated' : 'Complete'}</span>
            </div>
          </div>
        </div>

        {/* Big Countdown Display */}
        <div className="text-center py-4 bg-surface-container-low dark:bg-tertiary-container rounded-2xl border border-outline-variant p-6">
          <span className="font-label-caps text-xs text-secondary uppercase tracking-widest block mb-2">
            Reservation Lock TTL Countdown
          </span>
          <div className="font-display-timer text-5xl md:text-6xl text-primary dark:text-primary-fixed-dim font-bold tracking-tight font-mono">
            {formatTimer(secondsLeft)}
          </div>
          <p className="text-xs text-secondary mt-2">
            Donor profile locked via Redis <code className="text-primary font-bold">SET NX PX</code>. No other requester can reserve this donor while active.
          </p>
        </div>

        {message && (
          <div className="p-4 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 rounded-xl flex items-center gap-3 font-semibold text-sm">
            <span className="material-symbols-outlined">check_circle</span>
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-error-container text-on-error-container rounded-xl flex items-center gap-3 font-semibold text-sm">
            <span className="material-symbols-outlined">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Action Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <button
            onClick={handleConfirm}
            disabled={loading || currentStatus === 'confirmed'}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3.5 px-4 rounded-xl shadow transition-all duration-200 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            <span className="material-symbols-outlined">check_circle</span>
            <span>Confirm Donation Arrival</span>
          </button>

          <button
            onClick={() => handleDecline('declined')}
            disabled={loading || currentStatus === 'confirmed'}
            className="w-full bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant font-semibold py-3.5 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-error">cancel</span>
            <span>Decline / Escalate Match</span>
          </button>
        </div>

        <div className="text-center pt-2">
          <button
            onClick={onDone}
            className="text-xs font-semibold text-secondary hover:text-primary underline transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
