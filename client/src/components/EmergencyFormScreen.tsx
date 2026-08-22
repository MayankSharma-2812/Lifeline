/**
 * @module EmergencyFormScreen.tsx
 * @description The primary data entry view for requesters to submit natural-language emergency blood requests.
 */
import React, { useState } from 'react';
import Skeleton from 'react-loading-skeleton';
import { Siren, AlertCircle, MapPin, Navigation, Search, Sparkles, Activity, Lock } from 'lucide-react';
import { Candidate, EmergencyRequest } from '../types';
import { createEmergencyRequestApi } from '../lib/api';

export interface EmergencyFormScreenProps {
  /** Callback fired upon successful AI parsing and geospatial matching of the request. */
  onSuccess: (data: { requestId: string; parsed: EmergencyRequest['parsed']; candidates: Candidate[] }) => void;
}

const PRESET_EXAMPLES = [
  'Need O- blood urgently for my father admitted in ICU at Fortis Hospital Jaipur. Surgery scheduled in 2 hours.',
  'Critical emergency: Patient in road accident needs B+ blood immediately at SMS Hospital, Tonk Road.',
  'Hospital surgery tomorrow morning requires 2 units of A+ blood. Patient is stable.',
];

/**
 * Captures the emergency text and user location, submits it for processing, and displays skeleton loaders
 * during the natural language parsing and geospatial queries.
 */
export const EmergencyFormScreen: React.FC<EmergencyFormScreenProps> = ({ onSuccess }) => {
  const [rawText, setRawText] = useState('');
  // Pre-seed location state with default coordinates to streamline demo testing
  const [lat, setLat] = useState(26.9124);
  const [lng, setLng] = useState(75.7873);
  const [locText, setLocText] = useState('Jaipur, Rajasthan (26.9124, 75.7873)');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Retrieves precise geospatial coordinates using the browser API.
   *
   * Demonstrates JavaScript Callbacks vs Promises:
   * navigator.geolocation.getCurrentPosition uses the legacy error-first callback pattern
   * passing separate success and error callback functions, in contrast to modern Promise / async-await
   * workflows used elsewhere in the app (e.g. handleSubmit below).
   */
  const handleDetectGPS = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
          setLocText(`Current Location (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`);
        },
        () => setError('GPS permission denied. Using default Jaipur location.')
      );
    }
  };

  /**
   * Validates input and fires the API request to parse the text and fetch candidates.
   *
   * Demonstrates JavaScript Event Loop & Microtask Mechanics:
   * 1. Synchronous execution: setError(null) and setLoading(true) are pushed onto the Call Stack immediately.
   * 2. Yielding to Event Loop: Encountering `await createEmergencyRequestApi(...)` suspends handleSubmit
   *    and yields the thread to the Event Loop, allowing React to re-render the DOM with <Skeleton /> (line 73).
   * 3. Microtask queue: When the network HTTP promise resolves, its continuation callback is enqueued into
   *    the Microtask Queue and executed before the next macrotask, resuming in try/catch to call onSuccess(res).
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) {
      setError('Please describe the emergency request.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await createEmergencyRequestApi(rawText, { lat, lng });
      onSuccess(res);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit emergency request.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-6">
        <div className="bg-surface-container border border-outline-variant rounded-xl p-6 shadow-sm border-l-[6px] border-l-primary-container">
          <div className="flex items-center gap-4">
            <Skeleton circle height={56} width={56} />
            <div className="flex-1">
              <Skeleton height={28} width="60%" />
              <Skeleton height={16} width="85%" className="mt-2" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-on-background border border-outline-variant rounded-xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <Sparkles className="w-4 h-4 animate-spin text-primary" />
            <span>Parsing text & running $geoNear geospatial matching...</span>
          </div>
          <Skeleton height={80} count={3} className="my-3 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-surface-container border border-outline-variant rounded-xl p-6 relative overflow-hidden border-l-[6px] border-l-primary-container shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-container text-white rounded-xl flex items-center justify-center">
              <Siren className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="font-headline-lg text-headline-md md:text-headline-lg text-on-surface">
                Post Emergency Blood Request
              </h1>
              <p className="font-body-md text-secondary text-sm">
                Describe the situation in plain language. AI parses blood type and urgency, then triggers hyperlocal donor matching.
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-error-container text-on-error-container rounded-xl flex items-center gap-3 font-semibold text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Intake Form */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6 bg-white dark:bg-on-background border border-outline-variant dark:border-outline rounded-xl p-6 shadow-sm">
          <div>
            <label className="block font-label-caps text-label-caps text-on-surface-variant mb-2">
              Emergency Details & Description
            </label>
            <textarea
              required
              rows={5}
              className="w-full bg-surface-container-lowest border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary rounded-xl p-4 font-body-md text-on-surface transition-all text-sm leading-relaxed"
              placeholder="e.g. Need O- blood urgently for my father admitted in ICU at Fortis Hospital. Surgery in 2 hours..."
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
            />
          </div>

          {/* Preset Buttons */}
          <div>
            <span className="block font-label-caps text-xs text-secondary mb-2">
              Or click a sample emergency preset:
            </span>
            <div className="space-y-2">
              {PRESET_EXAMPLES.map((ex, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setRawText(ex)}
                  className="w-full text-left text-xs p-2.5 bg-surface-container-low hover:bg-surface-container-high rounded-lg border border-outline-variant text-on-surface transition-all truncate"
                >
                  "{ex}"
                </button>
              ))}
            </div>
          </div>

          {/* Location Bar */}
          <div>
            <label className="block font-label-caps text-label-caps text-on-surface-variant mb-2">
              Emergency Location (GPS Coords)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-secondary" />
                <input
                  readOnly
                  className="w-full pl-9 bg-surface-container-lowest border border-outline-variant rounded-lg p-3 font-body-md text-on-surface text-sm"
                  value={locText}
                />
              </div>
              <button
                type="button"
                onClick={handleDetectGPS}
                className="px-4 bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant rounded-lg flex items-center gap-2 text-primary font-semibold text-xs transition-colors"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Detect GPS</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-container hover:bg-primary text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition-all duration-200 flex items-center justify-center gap-3 text-base disabled:opacity-50"
          >
            <Search className="w-5 h-5" />
            <span>Parse Request & Find Nearest Donors</span>
          </button>
        </div>

        {/* Info / Sidebar Card */}
        <div className="space-y-4 bg-surface-container-low dark:bg-tertiary-container border border-outline-variant dark:border-outline rounded-xl p-6 h-fit">
          <div className="flex items-center gap-3 text-primary dark:text-on-primary-container">
            <Sparkles className="w-5 h-5" />
            <h3 className="font-bold text-sm">OpenRouter AI Layer</h3>
          </div>
          <p className="text-xs text-secondary leading-relaxed">
            The free-text prompt is evaluated using OpenRouter AI to extract blood group (e.g. O-, AB+) and urgency.
          </p>
          <div className="p-3 bg-white dark:bg-on-background rounded-lg border border-outline-variant text-xs space-y-2">
            <div className="flex justify-between items-center text-secondary">
              <span className="flex items-center gap-1"><Activity className="w-3.5 h-3.5" /> Geospatial Index:</span>
              <span className="font-mono font-semibold text-on-surface">2dsphere</span>
            </div>
            <div className="flex justify-between items-center text-secondary">
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Max Radius:</span>
              <span className="font-mono font-semibold text-on-surface">50 km</span>
            </div>
            <div className="flex justify-between items-center text-secondary">
              <span className="flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Concurrency Lock:</span>
              <span className="font-mono font-semibold text-primary">Redis SET NX</span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
