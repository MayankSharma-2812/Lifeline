import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

/**
 * App router — screens wired up in Phase 6.
 * Placeholder routes keep the scaffold compiling and routing correctly now.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Phase 6: replace placeholders with real screen components */}
        <Route path="/login" element={<Placeholder label="Login" />} />
        <Route path="/signup" element={<Placeholder label="Sign Up" />} />
        <Route path="/request" element={<Placeholder label="Emergency Intake" />} />
        <Route path="/matches/:requestId" element={<Placeholder label="Donor Matches" />} />
        <Route path="/status/:requestId" element={<Placeholder label="Reservation Status" />} />
        <Route path="/donor/dashboard" element={<Placeholder label="Donor Dashboard" />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function Placeholder({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
      <div className="text-center">
        <div className="mb-2 text-4xl">🩸</div>
        <h1 className="text-2xl font-bold">LifeLine</h1>
        <p className="mt-1 text-gray-400">{label} — coming in Phase 6</p>
      </div>
    </div>
  );
}
