/**
 * @module DonorDashboardScreen.tsx
 * @description Serves as the primary operational view for registered donors, handling profile toggles and incoming reservation requests.
 *
 * Concepts demonstrated in this file:
 * - Side effects with useEffect: Component mount lifecycle execution fetching donor profile and active reservation state
 * - State management with useState: Local reactive state for profile metadata, toggling states, error alerts, and incoming locks
 * - WebSocket / real-time communication: Subscribing to live push events for incoming emergency reservations via custom socket hook
 * - Async data fetching from API: Invoking profile retrieval and reservation decision endpoints
 */
import React, { useEffect, useState } from 'react';
import Skeleton from 'react-loading-skeleton';
import { ShieldCheck, Droplets, Radio, Siren, AlertCircle, CheckCircle2 } from 'lucide-react';
import { DonorProfile, User } from '../types';
import { getMyDonorProfileApi, toggleDonorAvailabilityApi, confirmReservationApi, declineReservationApi } from '../lib/api';
import { useDonorNotifications } from '../hooks/useDonorNotifications';

export interface DonorDashboardScreenProps {
  user: User;
}

/**
 * Manages donor profile status and processes live reservation events.
 * Displays real-time alerts if a requester issues a lock on this donor.
 */
export const DonorDashboardScreen: React.FC<DonorDashboardScreenProps> = ({ user }) => {
  const [profile, setProfile] = useState<DonorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const [initialReservation, setInitialReservation] = useState<{
    requestId: string;
    donorProfileId: string;
    expiresInSeconds: number;
  } | null>(null);

  // Hook into the user's private socket room to receive immediate reservation payloads
  const { incoming, dismiss } = useDonorNotifications();

  useEffect(() => {
    fetchProfile();
  }, []);

  /** Fetches current profile state and any active reservation from the backend. */
  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMyDonorProfileApi();
      setProfile(res.profile);
      if (res.activeReservation) {
        setInitialReservation(res.activeReservation);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not fetch donor profile.');
    } finally {
      setLoading(false);
    }
  };

  // Combine real-time socket events with initial load data to determine active alert state
  const activeAlert = incoming || initialReservation;

  /** Toggles the donor's broad availability metric in the backend. */
  const handleToggle = async () => {
    if (!profile) return;
    setToggling(true);
    setError(null);
    try {
      const res = await toggleDonorAvailabilityApi(profile._id);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              status: res.status as DonorProfile['status'],
              isAvailable: res.isAvailable,
            }
          : null
      );
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to toggle availability.');
    } finally {
      setToggling(false);
    }
  };

  /** Confirms the active reservation, agreeing to supply the blood request. */
  const handleAcceptIncoming = async () => {
    if (!activeAlert || !profile) return;
    setActionMsg(null);
    try {
      await confirmReservationApi(activeAlert.requestId, profile._id);
      setActionMsg('Reservation accepted! Thank you for donating.');
      dismiss();
      setInitialReservation(null);
      fetchProfile();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to confirm reservation.');
    }
  };

  /** Declines the active reservation, forcing the system to escalate to the next candidate. */
  const handleDeclineIncoming = async () => {
    if (!activeAlert || !profile) return;
    setActionMsg(null);
    try {
      await declineReservationApi(activeAlert.requestId, profile._id, 'declined');
      setActionMsg('Reservation declined. Match escalated to next candidate.');
      dismiss();
      setInitialReservation(null);
      fetchProfile();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to decline reservation.');
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-6">
        <div className="bg-surface-container border border-outline-variant rounded-xl p-6 border-l-[6px] border-l-primary-container">
          <Skeleton height={32} width="40%" />
          <Skeleton height={16} width="70%" className="mt-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton height={120} count={3} className="rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-surface-container border border-outline-variant rounded-xl p-6 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-l-[6px] border-l-primary-container shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-2xl shadow">
            {profile?.bloodGroup || '??'}
          </div>
          <div>
            <h1 className="font-headline-lg text-xl md:text-headline-lg text-on-surface">
              Donor Control Center — {user.name}
            </h1>
            <p className="font-body-md text-secondary text-sm">
              Manage your availability status & respond to emergency dispatch requests.
            </p>
          </div>
        </div>

        {/* Availability Toggle */}
        <div className="flex items-center gap-3 bg-white dark:bg-on-background px-4 py-3 rounded-xl border border-outline-variant shadow-sm">
          <span className="text-xs font-semibold text-on-surface">
            {profile?.status === 'available' ? 'Available to Donate' : 'Unavailable / On Cooldown'}
          </span>
          <button
            onClick={handleToggle}
            disabled={toggling || profile?.status === 'reserved'}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              profile?.status === 'available' ? 'bg-emerald-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                profile?.status === 'available' ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-error-container text-on-error-container rounded-xl flex items-center gap-3 font-semibold text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {actionMsg && (
        <div className="p-4 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 rounded-xl flex items-center gap-3 font-semibold text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{actionMsg}</span>
        </div>
      )}

      {/* Real-time Incoming Reservation Alert Card */}
      {activeAlert && (
        <div className="bg-amber-50 border-2 border-amber-400 dark:bg-amber-950/40 dark:border-amber-600 rounded-xl p-6 shadow-md space-y-4 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
              <Siren className="w-5 h-5 text-amber-600" />
              <span>EMERGENCY RESERVATION REQUEST DISPATCHED</span>
            </div>
            <span className="font-mono text-xs text-amber-800 bg-amber-200 px-2 py-0.5 rounded font-bold">
              TTL: {activeAlert.expiresInSeconds}s
            </span>
          </div>
          <p className="text-xs text-amber-900 dark:text-amber-200">
            A requester within 50 km has placed an emergency reservation on your profile via LifeLine.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleAcceptIncoming}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-lg text-xs shadow transition-colors"
            >
              Accept & Confirm
            </button>
            <button
              onClick={handleDeclineIncoming}
              className="flex-1 bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 font-semibold py-2.5 px-4 rounded-lg text-xs transition-colors"
            >
              Decline Match
            </button>
          </div>
        </div>
      )}

      {/* Profile Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-on-background border border-outline-variant dark:border-outline p-6 rounded-xl space-y-2 shadow-sm">
          <div className="flex justify-between items-center text-secondary">
            <span className="font-label-caps text-xs uppercase">Reliability Score</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="font-data-metric text-3xl font-bold text-on-surface font-mono">
            {profile?.reliabilityScore ?? 100} / 100
          </div>
          <p className="text-[11px] text-secondary">
            Increases +2 per confirmed donation; -10 for unresponded requests.
          </p>
        </div>

        <div className="bg-white dark:bg-on-background border border-outline-variant dark:border-outline p-6 rounded-xl space-y-2 shadow-sm">
          <div className="flex justify-between items-center text-secondary">
            <span className="font-label-caps text-xs uppercase">Blood Group</span>
            <Droplets className="w-4 h-4 text-primary" />
          </div>
          <div className="font-data-metric text-3xl font-bold text-primary font-mono">
            {profile?.bloodGroup || 'O+'}
          </div>
          <p className="text-[11px] text-secondary">
            Registered blood group used in geospatial matching.
          </p>
        </div>

        <div className="bg-white dark:bg-on-background border border-outline-variant dark:border-outline p-6 rounded-xl space-y-2 shadow-sm">
          <div className="flex justify-between items-center text-secondary">
            <span className="font-label-caps text-xs uppercase">Current Status</span>
            <Radio className="w-4 h-4 text-primary" />
          </div>
          <div className="font-data-metric text-2xl font-bold text-on-surface capitalize font-mono">
            {profile?.status || 'available'}
          </div>
          <p className="text-[11px] text-secondary">
            Status set in Mongoose & Upstash Redis lock key.
          </p>
        </div>
      </div>
    </div>
  );
};
