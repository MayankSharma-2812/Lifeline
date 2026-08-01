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

function AppContent() {
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

  const navigate = useNavigate();

  // Initialize socket lifecycle
  useSocket();

  // Handle remote session revocation — auto-dismissing toast
  useSessionRevoked(() => {
    setUser(null);
    toast.error('Session revoked — logged out');
    navigate('/login');
  });

  // Dark mode effect
  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [dark]);

  // Check initial session via silent refresh
  useEffect(() => {
    async function initAuth() {
      try {
        const res = await refreshApi();
        if (res.accessToken) {
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
        // No active session
      } finally {
        setInitializing(false);
      }
    }
    initAuth();
  }, []);

  const handleAuthSuccess = (u: User) => {
    setUser(u);
    navigate(u.role === 'donor' ? '/dashboard' : '/intake');
  };

  const handleLogout = async () => {
    await logoutApi();
    setUser(null);
    setCurrentRequest(null);
    setReservedDonor(null);
    navigate('/login');
  };

  const handleRequestCreated = (data: {
    requestId: string;
    parsed: EmergencyRequest['parsed'];
    candidates: Candidate[];
  }) => {
    setCurrentRequest(data);
    navigate('/matches');
  };

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

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};

export default App;
