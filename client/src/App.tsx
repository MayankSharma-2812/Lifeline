import React, { useEffect, useState } from 'react';
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

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [dark, setDark] = useState(false);

  // App state flow for requesters
  const [activeScreen, setActiveScreen] = useState<
    'intake' | 'matches' | 'reservation' | 'dashboard' | 'verify'
  >('intake');

  const [currentRequest, setCurrentRequest] = useState<{
    requestId: string;
    parsed: EmergencyRequest['parsed'];
    candidates: Candidate[];
  } | null>(null);

  const [reservedDonor, setReservedDonor] = useState<{
    donorProfileId: string;
    lockKey: string;
  } | null>(null);

  // Initialize socket lifecycle
  useSocket();

  // Handle remote session revocation — auto-dismissing toast (a) per spec
  useSessionRevoked(() => {
    setUser(null);
    toast.error('Session revoked — logged out');
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
          setUser({
            _id: payload.userId,
            name: payload.name || 'User',
            email: payload.email || '',
            phone: payload.phone || '',
            role: payload.role || 'requester',
          });
          setActiveScreen(payload.role === 'donor' ? 'dashboard' : 'intake');
        }
      } catch {
        // No active session — present AuthScreen
      } finally {
        setInitializing(false);
      }
    }
    initAuth();
  }, []);

  const handleAuthSuccess = (u: User) => {
    setUser(u);
    setActiveScreen(u.role === 'donor' ? 'dashboard' : 'intake');
  };

  const handleLogout = async () => {
    await logoutApi();
    setUser(null);
    setCurrentRequest(null);
    setReservedDonor(null);
  };

  const handleRequestCreated = (data: {
    requestId: string;
    parsed: EmergencyRequest['parsed'];
    candidates: Candidate[];
  }) => {
    setCurrentRequest(data);
    setActiveScreen('matches');
  };

  const handleDonorReserved = (donorProfileId: string, lockKey: string) => {
    setReservedDonor({ donorProfileId, lockKey });
    setActiveScreen('reservation');
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
            setActiveScreen(user.role === 'donor' ? 'dashboard' : 'intake');
          }
        }}
      />

      <main className="pt-24 pb-16 px-4 md:px-10 max-w-7xl mx-auto">
        {!user ? (
          <div className="flex items-center justify-center min-h-[calc(100vh-140px)]">
            <AuthScreen onSuccess={handleAuthSuccess} />
          </div>
        ) : user.role === 'donor' ? (
          <DonorDashboardScreen user={user} />
        ) : (
          <>
            {activeScreen === 'intake' && (
              <EmergencyFormScreen onSuccess={handleRequestCreated} />
            )}

            {activeScreen === 'matches' && currentRequest && (
              <MatchingDonorScreen
                requestId={currentRequest.requestId}
                parsed={currentRequest.parsed}
                candidates={currentRequest.candidates}
                onDonorReserved={handleDonorReserved}
                onNewRequest={() => setActiveScreen('intake')}
              />
            )}

            {activeScreen === 'reservation' && currentRequest && reservedDonor && (
              <ReservationStatusScreen
                requestId={currentRequest.requestId}
                donorProfileId={reservedDonor.donorProfileId}
                lockKey={reservedDonor.lockKey}
                onDone={() => setActiveScreen('intake')}
              />
            )}

            {activeScreen === 'verify' && currentRequest && (
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
                onBack={() => setActiveScreen('matches')}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;
