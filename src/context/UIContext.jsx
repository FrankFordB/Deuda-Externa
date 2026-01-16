/**
 * UI Context - Manejo de estado de UI global
 */
import { createContext, useContext, useState, useEffect } from 'react';
import adminService from '../services/adminService';

const UIContext = createContext(null);

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI debe usarse dentro de UIProvider');
  }
  return context;
};

export const UIProvider = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [siteConfig, setSiteConfig] = useState({
    header_title: 'GestorDeudas',
    header_links: [],
    footer_text: '© 2026 GestorDeudas. Todos los derechos reservados.',
    footer_links: []
  });
  const [notifications, setNotifications] = useState([]);
  const [theme, setTheme] = useState('light');

  // Cargar configuración del sitio
  useEffect(() => {
    let isMounted = true;
    
    const loadConfig = async () => {
      try {
        const { config } = await adminService.getSiteConfig();
        if (isMounted && config) {
          setSiteConfig(config);
        }
      } catch (err) {
        // Ignorar AbortError
        if (err.name === 'AbortError') return;
        console.error('Error cargando config:', err);
      }
    };
    loadConfig();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // Cargar preferencias del localStorage
  useEffect(() => {
    const savedSidebar = localStorage.getItem('sidebarCollapsed');
    const savedTheme = localStorage.getItem('theme');
    
    if (savedSidebar !== null) {
      setSidebarCollapsed(JSON.parse(savedSidebar));
    }
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      localStorage.setItem('sidebarCollapsed', JSON.stringify(!prev));
      return !prev;
    });
  };

  const toggleTheme = () => {
    setTheme(prev => {
      const newTheme = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', newTheme);
      return newTheme;
    });
  };

  const addNotification = (notification) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { ...notification, id }]);
    
    // Auto-remover después de 5 segundos
    if (notification.autoClose !== false) {
      setTimeout(() => {
        removeNotification(id);
      }, notification.duration || 5000);
    }
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const showSuccess = (message) => {
    addNotification({ type: 'success', message });
  };

  const showError = (message) => {
    addNotification({ type: 'error', message });
  };

  const showWarning = (message) => {
    addNotification({ type: 'warning', message });
  };

  const showInfo = (message) => {
    addNotification({ type: 'info', message });
  };

  const updateSiteConfig = async (newConfig) => {
    const result = await adminService.updateSiteConfig(newConfig);
    if (!result.error) {
      setSiteConfig(result.config);
    }
    return result;
  };

  const value = {
    sidebarCollapsed,
    toggleSidebar,
    siteConfig,
    updateSiteConfig,
    notifications,
    addNotification,
    removeNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    theme,
    toggleTheme
  };

  return (
    <UIContext.Provider value={value}>
      {children}
    </UIContext.Provider>
  );
};

export default UIContext;
