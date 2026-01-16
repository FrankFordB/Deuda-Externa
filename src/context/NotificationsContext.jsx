/**
 * Notifications Context - Manejo global de notificaciones
 * Versión ultra-simplificada
 */
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import notificationsService from '../services/notificationsService';

const NotificationsContext = createContext(null);

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications debe usarse dentro de NotificationsProvider');
  }
  return context;
};

export const NotificationsProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadingRef = useRef(false);
  const userIdRef = useRef(null);

  const loadNotifications = async (forceUserId = null) => {
    const userId = forceUserId || user?.id;
    if (!userId || loadingRef.current) return;
    
    loadingRef.current = true;
    setLoading(true);
    
    try {
      const [notifResult, countResult] = await Promise.all([
        notificationsService.getNotifications(userId),
        notificationsService.getUnreadCount(userId)
      ]);

      setNotifications(notifResult.notifications || []);
      setUnreadCount(countResult.count || 0);
    } catch (err) {
      console.error('Error cargando notificaciones:', err);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  useEffect(() => {
    if (user?.id && user.id !== userIdRef.current) {
      userIdRef.current = user.id;
      loadNotifications(user.id);
    } else if (!user?.id) {
      userIdRef.current = null;
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user?.id]);

  const markAsRead = async (notificationId) => {
    const result = await notificationsService.markAsRead(notificationId);
    if (!result.error) {
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    return result;
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const result = await notificationsService.markAllAsRead(user.id);
    if (!result.error) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    }
    return result;
  };

  const deleteNotification = async (notificationId) => {
    const notification = notifications.find(n => n.id === notificationId);
    const result = await notificationsService.deleteNotification(notificationId);
    if (!result.error) {
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (notification && !notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    }
    return result;
  };

  const value = {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications: () => { loadingRef.current = false; loadNotifications(user?.id); }
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

export default NotificationsContext;
