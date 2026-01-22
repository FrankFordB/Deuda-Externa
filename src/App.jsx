/**
 * App.jsx - Configuración de rutas de la aplicación
 * Con Lazy Loading para mejor performance
 */
import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthLayout, DashboardLayout, AdminLayout } from './layouts';

// Componente de carga mientras se descarga la página
const PageLoader = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    background: 'var(--bg-primary, #0f172a)'
  }}>
    <div style={{
      width: '40px',
      height: '40px',
      border: '3px solid rgba(99, 102, 241, 0.2)',
      borderTop: '3px solid #6366f1',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// ========== LAZY LOADING DE PÁGINAS ==========
// Auth pages - Se cargan solo cuando el usuario no está logueado
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const EmailVerified = lazy(() => import('./pages/EmailVerified'));
const EmailVerificationSent = lazy(() => import('./pages/EmailVerificationSent'));

// Main pages - Se cargan bajo demanda
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Debts = lazy(() => import('./pages/Debts'));
const Friends = lazy(() => import('./pages/Friends'));
const SharedExpenses = lazy(() => import('./pages/SharedExpenses'));
const Statistics = lazy(() => import('./pages/Statistics'));
const Installments = lazy(() => import('./pages/Installments'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const AccountDetail = lazy(() => import('./pages/AccountDetail'));
const MonthlyStats = lazy(() => import('./pages/MonthlyStats'));
const DueDates = lazy(() => import('./pages/DueDates'));

// Admin pages - Solo se cargan si el usuario es admin
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard'));
const AdminUsers = lazy(() => import('./pages/Admin/AdminUsers'));
const AdminConfig = lazy(() => import('./pages/Admin/AdminConfig'));

function App() {
  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Rutas de autenticación */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/email-verified" element={<EmailVerified />} />
            <Route path="/email-verification-sent" element={<EmailVerificationSent />} />
          </Route>

          {/* Rutas principales (requieren autenticación) */}
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/debts" element={<Debts />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/shared-expenses" element={<SharedExpenses />} />
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/installments" element={<Installments />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/account/:accountId" element={<AccountDetail />} />
            <Route path="/monthly-stats" element={<MonthlyStats />} />
            <Route path="/due-dates" element={<DueDates />} />
          </Route>

          {/* Rutas de administración (requieren superadmin) */}
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/config" element={<AdminConfig />} />
          </Route>

          {/* Ruta por defecto */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
