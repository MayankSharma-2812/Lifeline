/**
 * @module App.tsx
 * @description Main application routing component. Handles authentication state, theme preferences, and top-level routing logic.
 *
 * Concepts demonstrated in this file:
 * - Client-side routing: React Router v6 architecture with BrowserRouter, Routes, Route, useNavigate, useParams, and Navigate redirects
 * - React component composition: Composing modular screen components (Header, AuthScreen, EmergencyFormScreen, MatchingDonorScreen, etc.)
 * - State management with useState: Centralized UI state for authenticated user, active request, dark mode, and reservation data
 * - Side effects with useEffect: Silent authentication initialization on mount and DOM theme synchronization
 */
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import 'react-loading-skeleton/dist/skeleton.css';
import { Candidate, EmergencyRequest, User } from './types';
import { refreshApi, logoutApi } from './lib/api';
import { useSocket } from './hooks/useSocket';
import { useSessionRevoked } from './hooks/useSessionRevoked';
import { Header } from './components/Header';
import { AuthScreen } from './components/AuthScreen';
import { EmergencyFormScreen } from './components/EmergencyFormScreen';
import { MatchingDonorScreen } from './components/MatchingDonorScreen';
import { ReservationStatusScreen } from './components/ReservationStatusScreen';
import { DonorDashboardScreen } from './components/DonorDashboardScreen';
import { AuditVerifyScreen } from './components/AuditVerifyScreen';

/**
 * Inner application content component.
 * Manages the core state variables (user, currentRequest, reservedDonor) and provides the main routing structure.
 * Demonstrates Concepts: React component composition, State management with useState, Client-side routing
 *
 * @returns React component wrapping the application layout and routes.
 */
function AppContent() {
  // Concept: State management with useState — user session and view state
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [dark, setDark] = useState(false);

  const [currentRequest, setCurrentRequest] = useState<{
    requestId: string;
    parsed: EmergencyRequest['parsed'];
    candidates: Candidate[];
  } | null>(null);

  const [reservedDonor, setReservedDonor] = useState<{
    donorProfileId: string;
    lockKey: string;
  } | null>(null);

  // Concept: Client-side routing — programmatic navigation hook
  const navigate = useNavigate();

  // Initialize and manage the global socket lifecycle
  useSocket();

  // Handle remote session revocation
  // When triggered by the server, this resets the user state and redirects to login.
  useSessionRevoked(() => {
    setUser(null);
    toast.error('Session revoked — logged out');
    navigate('/login');
  });

  // Apply dark mode class to the document element based on state
  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [dark]);

  // Attempt to restore the user session implicitly upon initial load
  useEffect(() => {
    async function initAuth() {
      try {
        const res = await refreshApi();
        if (res.accessToken) {
          // Decode the JWT payload to reconstruct the basic user object
          const payload = JSON.parse(atob(res.accessToken.split('.')[1]));
          const loggedUser: User = {
            _id: payload.userId,
            name: payload.name || 'User',
            email: payload.email || '',
            phone: payload.phone || '',
            role: payload.role || 'requester',
          };
          setUser(loggedUser);
        }
      } catch {
        // Suppress errors to allow normal unauthenticated flow
      } finally {
        setInitializing(false);
      }
    }
    initAuth();
  }, []);

  /**
   * Handles successful authentication by updating state and navigating based on role.
   *
   * @param u - The authenticated user object.
   */
  const handleAuthSuccess = (u: User) => {
    setUser(u);
    navigate(u.role === 'donor' ? '/dashboard' : '/intake');
  };

  /**
   * Clears session state and redirects to the login view.
   */
  const handleLogout = async () => {
    await logoutApi();
    setUser(null);
    setCurrentRequest(null);
    setReservedDonor(null);
    navigate('/login');
  };

  /**
   * Handles successful creation of an emergency request.
   *
   * @param data - The new request and initial candidate matches.
   */
  const handleRequestCreated = (data: {
    requestId: string;
    parsed: EmergencyRequest['parsed'];
    candidates: Candidate[];
  }) => {
    setCurrentRequest(data);
    navigate('/matches');
  };

  /**
   * Handles successful donor reservation.
   *
   * @param donorProfileId - The ID of the reserved donor profile.
   * @param lockKey - The concurrency lock key for the reservation.
   */
  const handleDonorReserved = (donorProfileId: string, lockKey: string) => {
    setReservedDonor({ donorProfileId, lockKey });
    if (currentRequest) {
      navigate(`/reservation/${currentRequest.requestId}`);
    } else {
      navigate('/intake');
    }
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-surface dark:bg-on-background flex flex-col items-center justify-center p-4">
        <div className="flex items-center gap-3 text-primary dark:text-primary-fixed-dim">
          <span className="material-symbols-outlined text-4xl animate-spin">progress_activity</span>
          <span className="font-bold text-xl font-headline-md">Initializing LifeLine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-on-background text-on-surface transition-colors duration-200">
      <Toaster position="top-right" richColors duration={4000} />

      <Header
        user={user}
        dark={dark}
        onToggleTheme={() => setDark(!dark)}
        onLogout={handleLogout}
        onNavigateHome={() => {
          if (user) {
            navigate(user.role === 'donor' ? '/dashboard' : '/intake');
          } else {
            navigate('/login');
          }
        }}
      />

      <main className="pt-24 pb-16 px-4 md:px-10 max-w-7xl mx-auto">
        <Routes>
          {/* Public Auth Route */}
          <Route
            path="/login"
            element={
              !user ? (
                <div className="flex items-center justify-center min-h-[calc(100vh-140px)]">
                  <AuthScreen onSuccess={handleAuthSuccess} />
                </div>
              ) : (
                <Navigate to={user.role === 'donor' ? '/dashboard' : '/intake'} replace />
              )
            }
          />

          {/* Protected Intake Route */}
          <Route
            path="/intake"
            element={
              user ? (
                user.role === 'donor' ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <EmergencyFormScreen onSuccess={handleRequestCreated} />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          {/* Protected Matches Route */}
          <Route
            path="/matches"
            element={
              user ? (
                currentRequest ? (
                  <MatchingDonorScreen
                    requestId={currentRequest.requestId}
                    parsed={currentRequest.parsed}
                    candidates={currentRequest.candidates}
                    onDonorReserved={handleDonorReserved}
                    onNewRequest={() => navigate('/intake')}
                  />
                ) : (
                  <Navigate to="/intake" replace />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          {/* Protected Reservation Route */}
          <Route
            path="/reservation/:id"
            element={
              <ReservationRouteWrapper
                user={user}
                currentRequest={currentRequest}
                reservedDonor={reservedDonor}
                onDone={() => navigate('/intake')}
              />
            }
          />

          {/* Protected Dashboard Route */}
          <Route
            path="/dashboard"
            element={
              user ? (
                user.role === 'donor' ? (
                  <DonorDashboardScreen user={user} />
                ) : (
                  <Navigate to="/intake" replace />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          {/* Protected Audit Verify Route */}
          <Route
            path="/verify"
            element={
              user ? (
                currentRequest ? (
                  <AuditVerifyScreen
                    requestId={currentRequest.requestId}
                    parsed={currentRequest.parsed}
                    selectedCandidate={
                      reservedDonor
                        ? currentRequest.candidates.find(
                            (c) => c.donorProfileId === reservedDonor.donorProfileId
                          )
                        : null
                    }
                    onBack={() => navigate('/matches')}
                  />
                ) : (
                  <Navigate to="/intake" replace />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          {/* Default Fallback Redirect */}
          <Route
            path="*"
            element={
              <Navigate
                to={user ? (user.role === 'donor' ? '/dashboard' : '/intake') : '/login'}
                replace
              />
            }
          />
        </Routes>
      </main>
    </div>
  );
}

/**
 * Helper component that bridges URL parameters to the ReservationStatusScreen props.
 * Prevents invalid states by verifying required contextual data before rendering.
 */
function ReservationRouteWrapper({
  user,
  currentRequest,
  reservedDonor,
  onDone,
}: {
  user: User | null;
  currentRequest: { requestId: string; parsed: EmergencyRequest['parsed']; candidates: Candidate[] } | null;
  reservedDonor: { donorProfileId: string; lockKey: string } | null;
  onDone: () => void;
}) {
  const { id } = useParams<{ id: string }>();

  if (!user) return <Navigate to="/login" replace />;

  const requestId = id || currentRequest?.requestId;
  const donorProfileId = reservedDonor?.donorProfileId || currentRequest?.candidates[0]?.donorProfileId;

  if (!requestId || !donorProfileId) {
    return <Navigate to="/intake" replace />;
  }

  return (
    <ReservationStatusScreen
      requestId={requestId}
      donorProfileId={donorProfileId}
      lockKey={reservedDonor?.lockKey}
      onDone={onDone}
    />
  );
}

/**
 * The main application component, mounting the React Router context.
 */
export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};

export default App;
