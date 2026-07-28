import React, { useState } from 'react';
import { Candidate, EmergencyRequest } from '../types';
import { createEmergencyRequestApi } from '../lib/api';

interface EmergencyFormScreenProps {
  onSuccess: (data: { requestId: string; parsed: EmergencyRequest['parsed']; candidates: Candidate[] }) => void;
}

const PRESET_EXAMPLES = [
  'Need O- blood urgently for my father admitted in ICU at Fortis Hospital Jaipur. Surgery scheduled in 2 hours.',
  'Critical emergency: Patient in road accident needs B+ blood immediately at SMS Hospital, Tonk Road.',
  'Hospital surgery tomorrow morning requires 2 units of A+ blood. Patient is stable.',
];

export const EmergencyFormScreen: React.FC<EmergencyFormScreenProps> = ({ onSuccess }) => {
  const [rawText, setRawText] = useState('');
  const [lat, setLat] = useState(26.9124);
  const [lng, setLng] = useState(75.7873);
  const [locText, setLocText] = useState('Jaipur, Rajasthan (26.9124, 75.7873)');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-surface-container border border-outline-variant rounded-xl p-6 relative overflow-hidden border-l-[6px] border-l-primary-container shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-container text-white rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                emergency
              </span>
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
          <span className="material-symbols-outlined">error</span>
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
                <span className="absolute left-3 top-3 material-symbols-outlined text-secondary text-sm">
                  location_on
                </span>
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
                <span className="material-symbols-outlined text-sm">my_location</span>
                <span>Detect GPS</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-container hover:bg-primary text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition-all duration-200 flex items-center justify-center gap-3 text-base disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
                <span>AI Parsing & Geospatial Matching...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                  search
                </span>
                <span>Parse Request & Find Nearest Donors</span>
              </>
            )}
          </button>
        </div>

        {/* Info / Sidebar Card */}
        <div className="space-y-4 bg-surface-container-low dark:bg-tertiary-container border border-outline-variant dark:border-outline rounded-xl p-6 h-fit">
          <div className="flex items-center gap-3 text-primary dark:text-on-primary-container">
            <span className="material-symbols-outlined text-2xl">auto_awesome</span>
            <h3 className="font-bold text-sm">OpenRouter AI Layer</h3>
          </div>
          <p className="text-xs text-secondary leading-relaxed">
            The free-text prompt is evaluated using OpenRouter AI to extract blood group (e.g. O-, AB+) and urgency.
          </p>
          <div className="p-3 bg-white dark:bg-on-background rounded-lg border border-outline-variant text-xs space-y-2">
            <div className="flex justify-between text-secondary">
              <span>Geospatial Index:</span>
              <span className="font-mono font-semibold text-on-surface">2dsphere</span>
            </div>
            <div className="flex justify-between text-secondary">
              <span>Max Radius:</span>
              <span className="font-mono font-semibold text-on-surface">50 km</span>
            </div>
            <div className="flex justify-between text-secondary">
              <span>Concurrency Lock:</span>
              <span className="font-mono font-semibold text-primary">Redis SET NX</span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
