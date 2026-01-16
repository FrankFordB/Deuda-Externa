/**
 * Auth Layout - Layout para páginas de autenticación
 */
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../context';
import styles from './AuthLayout.module.css';

const AuthLayout = () => {
  const { isAuthenticated, loading } = useAuth();

  // Si está cargando, mostrar loading
  if (loading) {
    return (
      <div className={styles.authLayout}>
        <main className={styles.authMain}>
          <div className="loading-spinner lg"></div>
        </main>
      </div>
    );
  }

  // Si ya está autenticado, redirigir al dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className={styles.authLayout}>
      <main className={styles.authMain}>
        <div className={styles.authContainer}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AuthLayout;
