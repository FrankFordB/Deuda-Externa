/**
 * Dashboard Layout - Layout principal para usuarios autenticados
 */
import { useState, useEffect } from 'react';
import { Outlet, NavLink, Navigate, useLocation } from 'react-router-dom';
import { useAuth, useUI, useFriends, useDebts, useNotifications } from '../../context';
import { NotificationsPanel } from '../../components';
import remindersService from '../../services/remindersService';
import styles from './DashboardLayout.module.css';

const DashboardLayout = () => {
  const { user, profile, isAuthenticated, loading, signOut, isSuperAdmin } = useAuth();
  const { sidebarCollapsed, toggleSidebar, siteConfig } = useUI();
  const friendsContext = useFriends();
  const debtsContext = useDebts();
  const notificationsContext = useNotifications();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [upcomingDueCount, setUpcomingDueCount] = useState(0);

  // Obtener contadores de forma segura
  const friendRequestCount = friendsContext?.pendingRequestsCount || 0;
  const debtRequestCount = debtsContext?.pendingDebtsCount || 0;
  const notificationCount = notificationsContext?.unreadCount || 0;

  // Cargar contador de vencimientos próximos
  useEffect(() => {
    if (!user) return;

    const loadDueDatesCount = async () => {
      try {
        const result = await remindersService.getUpcomingDueDates(user.id);
        if (!result.error && result.dueDates) {
          const count = 
            (result.dueDates.installments?.length || 0) +
            (result.dueDates.debtsIOwned?.length || 0) +
            (result.dueDates.debtsOwedToMe?.length || 0);
          setUpcomingDueCount(count);
        }
      } catch (error) {
        console.error('Error cargando vencimientos:', error);
      }
    };

    loadDueDatesCount();
    
    // Recargar cada minuto
    const interval = setInterval(loadDueDatesCount, 60000);
    return () => clearInterval(interval);
  }, [user]);

  // Si está cargando, mostrar loading
  if (loading) {
    return (
      <div className={styles.dashboardLayout} style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="loading-spinner lg"></div>
      </div>
    );
  }

  // Si no está autenticado, redirigir al login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const handleSignOut = async () => {
    await signOut();
  };

  const navItems = [
    { 
      section: 'Principal',
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: '📊' },
        { path: '/expenses', label: 'Gastos', icon: '💰' },
        { path: '/debts', label: 'Deudas', icon: '💳', badge: debtRequestCount },
        { path: '/friends', label: 'Amigos', icon: '👥', badge: friendRequestCount },
        { path: '/shared-expenses', label: 'Gastos Compartidos', icon: '🤝' },
      ]
    },
    {
      section: 'Análisis',
      items: [
        { path: '/statistics', label: 'Estadísticas', icon: '📈' },
        { path: '/installments', label: 'Cuotas', icon: '🔄' },
        { path: '/monthly-stats', label: 'Resumen Mensual', icon: '📅' },
        { path: '/due-dates', label: 'Vencimientos', icon: '📅', badge: upcomingDueCount },
      ]
    },
    {
      section: 'Cuenta',
      items: [
        { path: '/profile', label: 'Mi Perfil', icon: '👤' },
        { path: '/settings', label: 'Configuración', icon: '⚙️' },
      ]
    }
  ];

  // Agregar admin si es superadmin
  if (isSuperAdmin) {
    navItems.push({
      section: 'Administración',
      items: [
        { path: '/admin', label: 'Panel Admin', icon: '🔐' },
        { path: '/admin/users', label: 'Usuarios', icon: '👥' },
        { path: '/admin/config', label: 'Configuración', icon: '🛠️' },
      ]
    });
  }

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
        if (path === item.path || path.startsWith(item.path + '/')) {
          return item.label;
        }
      }
    }
    return 'Dashboard';
  };

  return (
    <div className={styles.dashboardLayout}>
      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${sidebarCollapsed ? styles.collapsed : ''} ${mobileMenuOpen ? styles.mobileOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>💎</span>
            <span className={styles.logoText}>{siteConfig.header_title}</span>
          </div>
          <button 
            className={styles.collapseBtn}
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Expandir' : 'Contraer'}
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        <nav className={styles.sidebarNav}>
          {navItems.map((section) => (
            <div key={section.section} className={styles.navSection}>
              <div className={styles.navSectionTitle}>{section.section}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => 
                    `${styles.navLink} ${isActive ? styles.active : ''}`
                  }
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  <span className={styles.navText}>{item.label}</span>
                  {item.badge > 0 && (
                    <span className={styles.navBadge}>{item.badge}</span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <button 
            className={`btn btn-ghost ${styles.navLink}`} 
            onClick={handleSignOut}
            style={{ width: '100%' }}
          >
            <span className={styles.navIcon}>🚪</span>
            <span className={styles.navText}>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className={styles.mobileOverlay} 
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className={`${styles.mainContent} ${sidebarCollapsed ? styles.collapsed : ''}`}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button 
              className={`${styles.headerBtn} ${styles.mobileMenuBtn}`}
              onClick={() => setMobileMenuOpen(true)}
            >
              ☰
            </button>
            <h1 className={styles.pageTitle}>{getPageTitle()}</h1>
          </div>

          <div className={styles.headerRight}>
            <NotificationsPanel />

            <div className={styles.dropdown}>
              <button 
                className={styles.userMenu}
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                <div className={styles.userInfo}>
                  <div className={styles.userName}>
                    {profile?.first_name} {profile?.last_name}
                  </div>
                  <div className={styles.userRole}>@{profile?.nickname}</div>
                </div>
                {profile?.avatar_url ? (
                  <img 
                    src={profile.avatar_url} 
                    alt="Avatar" 
                    className={styles.userAvatar}
                  />
                ) : (
                  <div className="avatar">{getInitials()}</div>
                )}
              </button>

              {userMenuOpen && (
                <div className="dropdown-menu">
                  <NavLink 
                    to="/profile" 
                    className="dropdown-item"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    👤 Mi Perfil
                  </NavLink>
                  <NavLink 
                    to="/settings" 
                    className="dropdown-item"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    ⚙️ Configuración
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
        <main className={styles.pageContent}>
          <Outlet />
        </main>

        {/* Footer */}
        <footer className={styles.footer}>
          <div>{siteConfig.footer_text}</div>
          <div className={styles.footerLinks}>
            {siteConfig.footer_links?.map((link, index) => (
              <a key={index} href={link.url}>{link.label}</a>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
};

export default DashboardLayout;
