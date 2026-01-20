/**
 * App.jsx - Configuración de rutas de la aplicación
 */
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthLayout, DashboardLayout, AdminLayout } from './layouts';
import {
  Login,
  Register,
  ForgotPassword,
  ResetPassword,
  EmailVerified,
  EmailVerificationSent,
  Dashboard,
  Expenses,
  Debts,
  Friends,
  Statistics,
  Installments,
  Profile,
  Settings,
  AccountDetail,
  AdminDashboard,
  AdminUsers,
  AdminConfig
} from './pages';

function App() {
  return (
    <Router>
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
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/installments" element={<Installments />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/account/:accountId" element={<AccountDetail />} />
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
    </Router>
  );
}

export default App;
