import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AuthProvider } from './auth/AuthContext';
import { useAuth } from './auth/useAuth';
import { ThemeProvider } from './theme/ThemeContext';
import LoginPage from './pages/LoginPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import CompetitionPickerPage from './pages/CompetitionPickerPage';
import CustomCompetitionPage from './pages/CustomCompetitionPage';
import RoundScopePage from './pages/RoundScopePage';
import SettingsPage from './pages/SettingsPage';
import GeneratePage from './pages/GeneratePage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  return token ? <>{children}</> : <Navigate to="/" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/competitions" element={<ProtectedRoute><CompetitionPickerPage /></ProtectedRoute>} />
      <Route path="/custom" element={<ProtectedRoute><CustomCompetitionPage /></ProtectedRoute>} />
      <Route path="/scope" element={<ProtectedRoute><RoundScopePage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/generate" element={<ProtectedRoute><GeneratePage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
