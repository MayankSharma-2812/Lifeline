import React, { useState } from 'react';
import { BloodGroup, Role, User } from '../types';
import { loginApi, signupApi } from '../lib/api';

interface AuthScreenProps {
  onSuccess: (user: User) => void;
}

const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isDonor, setIsDonor] = useState(false);
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('O+');
  const [lat, setLat] = useState<number | undefined>(26.9124); // default Jaipur coord
  const [lng, setLng] = useState<number | undefined>(75.7873);
  const [locationText, setLocationText] = useState('Jaipur, Rajasthan');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDetectLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
          setLocationText(`GPS: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        },
        () => {
          setError('Location permission denied. Using default location.');
        }
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignup) {
        const role: Role = isDonor ? 'donor' : 'requester';
        const res = await signupApi({
          name,
          email: identifier.includes('@') ? identifier : `${identifier}@lifeline.org`,
          phone: identifier.match(/^\d+$/) ? identifier : '+919876543210',
          password,
          role,
          bloodGroup: isDonor ? bloodGroup : undefined,
          location: lat && lng ? { lat, lng } : undefined,
        });
        onSuccess(res.user);
      } else {
        const res = await loginApi(identifier, password);
        onSuccess(res.user);
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.errors?.[0]?.msg ||
        'Authentication failed. Please check credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="w-full max-w-md bg-white dark:bg-on-background rounded-xl shadow-lg border border-outline-variant dark:border-outline p-8 relative overflow-hidden transition-all duration-200">
      {/* Header Section */}
      <div className="mb-6 text-center">
        <div className="inline-flex items-center justify-center mb-3">
          <span
            className="material-symbols-outlined text-primary dark:text-primary-fixed-dim text-5xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            bloodtype
          </span>
        </div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2 tracking-tight">
          LifeLine
        </h1>
        <p className="font-body-md text-body-md text-secondary">
          Every drop is a heartbeat. Join the emergency network.
        </p>
      </div>

      {/* Mode Switch Tabs */}
      <div className="flex border-b border-outline-variant mb-6">
        <button
          type="button"
          className={`flex-1 py-2 font-semibold text-center text-sm transition-colors border-b-2 ${
            !isSignup
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-secondary hover:text-on-surface'
          }`}
          onClick={() => {
            setIsSignup(false);
            setError(null);
          }}
        >
          Sign In
        </button>
        <button
          type="button"
          className={`flex-1 py-2 font-semibold text-center text-sm transition-colors border-b-2 ${
            isSignup
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-secondary hover:text-on-surface'
          }`}
          onClick={() => {
            setIsSignup(true);
            setError(null);
          }}
        >
          Register
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-error-container text-on-error-container rounded-lg text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Auth Form */}
      <form className="space-y-5" onSubmit={handleSubmit}>
        {isSignup && (
          <div>
            <label className="block font-label-caps text-label-caps text-on-surface-variant mb-2">
              Full Name
            </label>
            <input
              required
              className="w-full bg-surface-container-lowest border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary rounded-lg p-3 font-body-md text-on-surface transition-all"
              placeholder="e.g. Dr. Ramesh Kumar"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}

        <div>
          <label className="block font-label-caps text-label-caps text-on-surface-variant mb-2">
            Email or Phone
          </label>
          <input
            required
            className="w-full bg-surface-container-lowest border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary rounded-lg p-3 font-body-md text-on-surface transition-all"
            placeholder="e.g. name@hospital.com"
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        </div>

        <div>
          <label className="block font-label-caps text-label-caps text-on-surface-variant mb-2">
            Password
          </label>
          <div className="relative">
            <input
              required
              className="w-full bg-surface-container-lowest border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary rounded-lg p-3 font-body-md text-on-surface transition-all pr-10"
              placeholder="••••••••"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-3 top-3 text-secondary hover:text-on-surface"
              onClick={() => setShowPassword(!showPassword)}
            >
              <span className="material-symbols-outlined text-xl">
                {showPassword ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>
        </div>

        {isSignup && (
          <>
            {/* Donor Toggle Switch */}
            <div className="flex items-center justify-between p-4 bg-surface-container-low dark:bg-tertiary-container rounded-xl border border-outline-variant dark:border-outline">
              <div className="flex items-center gap-3">
                <span
                  className="material-symbols-outlined text-primary dark:text-on-primary-container"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  volunteer_activism
                </span>
                <span className="font-body-md font-semibold text-on-surface">
                  I'm a donor
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={isDonor}
                  onChange={(e) => setIsDonor(e.target.checked)}
                />
                <div className="w-11 h-6 bg-secondary-fixed peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container"></div>
              </label>
            </div>

            {/* Donor Fields */}
            {isDonor && (
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block font-label-caps text-label-caps text-on-surface-variant mb-2">
                    Blood Group
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {BLOOD_GROUPS.map((bg) => (
                      <button
                        key={bg}
                        type="button"
                        onClick={() => setBloodGroup(bg)}
                        className={`py-2 px-1 border rounded text-xs font-bold transition-all ${
                          bloodGroup === bg
                            ? 'bg-primary-container text-white border-primary'
                            : 'bg-surface-container-lowest border-outline-variant text-on-surface hover:bg-surface-container-high'
                        }`}
                      >
                        {bg}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-label-caps text-label-caps text-on-surface-variant mb-2">
                    Location
                  </label>
                  <div className="relative flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-3 material-symbols-outlined text-secondary text-sm">
                        location_on
                      </span>
                      <input
                        className="w-full pl-9 bg-surface-container-lowest border border-outline-variant rounded-lg p-3 font-body-md text-on-surface text-sm"
                        placeholder="Location"
                        type="text"
                        value={locationText}
                        onChange={(e) => setLocationText(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleDetectLocation}
                      className="px-3 bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant rounded-lg flex items-center justify-center text-primary"
                      title="Use My GPS"
                    >
                      <span className="material-symbols-outlined">my_location</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary-container hover:bg-primary text-white font-semibold py-3 px-4 rounded-xl shadow transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <span className="material-symbols-outlined animate-spin">progress_activity</span>
          ) : (
            <>
              <span>{isSignup ? 'Create Account' : 'Sign In'}</span>
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </>
          )}
        </button>
      </form>
    </main>
  );
};
