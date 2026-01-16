/**
 * Admin Layout - Layout para panel de administración
 */
import { useState } from 'react';
import { Outlet, NavLink, Navigate, useLocation } from 'react-router-dom';
import { useAuth, useUI } from '../../context';
import dashboardStyles from '../DashboardLayout/DashboardLayout.module.css';
import styles from './AdminLayout.module.css';

const AdminLayout = () => {
  const { user, profile, isAuthenticated, loading, signOut, isSuperAdmin } = useAuth();
  const { sidebarCollapsed, toggleSidebar, siteConfig } = useUI();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Si está cargando, mostrar loading
  if (loading) {
    return (
      <div className={`${dashboardStyles.dashboardLayout} ${styles.adminLayout}`} style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="loading-spinner lg"></div>
      </div>
    );
  }

  // Si no está autenticado o no es superadmin, redirigir
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSignOut = async () => {
    await signOut();
  };

  const navItems = [
    { 
      section: 'Administración',
      items: [
        { path: '/admin', label: 'Panel Principal', icon: '🏠' },
        { path: '/admin/users', label: 'Gestión Usuarios', icon: '👥' },
        { path: '/admin/config', label: 'Configuración Sitio', icon: '⚙️' },
        { path: '/admin/stats', label: 'Estadísticas', icon: '📊' },
      ]
    },
    {
      section: 'Regresar',
      items: [
        { path: '/dashboard', label: 'Ir al Dashboard', icon: '↩️' },
      ]
    }
  ];

  const getInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    return user?.email?.[0]?.toUpperCase() || '?';
  };

  const getPageTitle = () => {
    const path = location.pathname;
    for (const section of navItems) {
      for (const item of section.items) {
        if (path === item.path) {
          return item.label;
        }
      }
    }
    return 'Administración';
  };

  return (
    <div className={`${dashboardStyles.dashboardLayout} ${styles.adminLayout}`}>
      {/* Sidebar */}
      <aside className={`${dashboardStyles.sidebar} ${sidebarCollapsed ? dashboardStyles.collapsed : ''} ${mobileMenuOpen ? dashboardStyles.mobileOpen : ''}`}>
        <div className={dashboardStyles.sidebarHeader}>
          <div className={dashboardStyles.logo}>
            <span className={dashboardStyles.logoIcon}>🔐</span>
            <span className={dashboardStyles.logoText}>Admin Panel</span>
          </div>
          <button 
            className={dashboardStyles.collapseBtn}
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Expandir' : 'Contraer'}
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        <nav className={dashboardStyles.sidebarNav}>
          {navItems.map((section) => (
            <div key={section.section} className={dashboardStyles.navSection}>
              <div className={dashboardStyles.navSectionTitle}>{section.section}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/admin'}
                  className={({ isActive }) => 
                    `${dashboardStyles.navLink} ${isActive ? dashboardStyles.active : ''}`
                  }
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className={dashboardStyles.navIcon}>{item.icon}</span>
                  <span className={dashboardStyles.navText}>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className={dashboardStyles.sidebarFooter}>
          <button 
            className={`btn btn-ghost ${dashboardStyles.navLink}`} 
            onClick={handleSignOut}
            style={{ width: '100%' }}
          >
            <span className={dashboardStyles.navIcon}>🚪</span>
            <span className={dashboardStyles.navText}>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className={dashboardStyles.mobileOverlay} 
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className={`${dashboardStyles.mainContent} ${sidebarCollapsed ? dashboardStyles.collapsed : ''}`}>
        {/* Header */}
        <header className={dashboardStyles.header}>
          <div className={dashboardStyles.headerLeft}>
            <button 
              className={`${dashboardStyles.headerBtn} ${dashboardStyles.mobileMenuBtn}`}
              onClick={() => setMobileMenuOpen(true)}
            >
              ☰
            </button>
            <h1 className={dashboardStyles.pageTitle}>{getPageTitle()}</h1>
            <span className={styles.adminBadge}>🔐 SUPERADMIN</span>
          </div>

          <div className={dashboardStyles.headerRight}>
            <div className="dropdown">
              <button 
                className={dashboardStyles.userMenu}
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                <div className={dashboardStyles.userInfo}>
                  <div className={dashboardStyles.userName}>
                    {profile?.first_name} {profile?.last_name}
                  </div>
                  <div className={dashboardStyles.userRole}>Superadmin</div>
                </div>
                <div className="avatar">{getInitials()}</div>
              </button>

              {userMenuOpen && (
                <div className="dropdown-menu">
                  <NavLink 
                    to="/dashboard" 
                    className="dropdown-item"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    📊 Ir al Dashboard
                  </NavLink>
                  <div className="dropdown-divider"></div>
                  <button 
                    className="dropdown-item"
                    onClick={handleSignOut}
                  >
                    🚪 Cerrar Sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className={dashboardStyles.pageContent}>
          <Outlet />
        </main>

        {/* Footer */}
        <footer className={dashboardStyles.footer}>
          <div>Panel de Administración - {siteConfig.header_title}</div>
          <div className={dashboardStyles.footerLinks}>
            <NavLink to="/dashboard">Volver al sitio</NavLink>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default AdminLayout;
