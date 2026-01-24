/**
 * Notifications Context - Manejo global de notificaciones
 * Con suscripción en tiempo real a Supabase
 */
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import notificationsService from '../services/notificationsService';
import { supabase } from '../services/supabase';

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
  const lastCountRef = useRef(0);
  const audioRef = useRef(null);

  // Crear audio element para notificaciones
  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSpx0fPTgjMGHm7A7+OZURE');
    audioRef.current.volume = 0.5;
  }, []);

  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((error) => {
        console.warn('No se pudo reproducir sonido:', error);
      });
    }
  };

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

      const fetchedNotifications = notifResult.notifications || [];
      
      // Eliminar duplicados basados en ID (por si acaso)
      const uniqueNotifications = Array.from(
        new Map(fetchedNotifications.map(n => [n.id, n])).values()
      );
      
      if (uniqueNotifications.length !== fetchedNotifications.length) {
        console.warn('⚠️ Se detectaron notificaciones duplicadas en la carga inicial');
      }

      setNotifications(uniqueNotifications);
      const newCount = countResult.count || 0;
      
      // Reproducir sonido si hay nuevas notificaciones
      if (newCount > lastCountRef.current && lastCountRef.current > 0) {
        playNotificationSound();
      }
      
      setUnreadCount(newCount);
      lastCountRef.current = newCount;
    } catch (err) {
      console.error('Error cargando notificaciones:', err);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  useEffect(() => {
    // Cargar inmediatamente
    if (user?.id && user.id !== userIdRef.current) {
      userIdRef.current = user.id;
      loadNotifications(user.id);
      
      // Suscribirse a cambios en tiempo real
      const channel = supabase
        .channel('notifications-realtime')
        .on(
          'postgres_changes',
          {
            event: '*', // INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('🔔 Notificación en tiempo real:', payload);
            
            if (payload.eventType === 'INSERT') {
              // Nueva notificación - verificar que no exista ya
              setNotifications(prev => {
                const exists = prev.some(n => n.id === payload.new.id);
                if (exists) {
                  console.log('⚠️ Notificación duplicada detectada, ignorando:', payload.new.id);
                  return prev;
                }
                return [payload.new, ...prev];
              });
              setUnreadCount(prev => prev + 1);
              playNotificationSound();
            } else if (payload.eventType === 'UPDATE') {
              // Notificación actualizada
              setNotifications(prev => 
                prev.map(n => n.id === payload.new.id ? payload.new : n)
              );
            } else if (payload.eventType === 'DELETE') {
              // Notificación eliminada
              setNotifications(prev => 
                prev.filter(n => n.id !== payload.old.id)
              );
            }
          }
        )
        .subscribe();

      // Cleanup: desuscribirse al desmontar
      return () => {
        supabase.removeChannel(channel);
      };
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

  const deleteAllNotifications = async () => {
    if (!user) return { error: 'No user authenticated' };
    const result = await notificationsService.deleteAllNotifications(user.id);
    if (!result.error) {
      setNotifications([]);
      setUnreadCount(0);
    }
    return result;
  };

  const requestPaymentConfirmation = async (debtId, confirmerId, debtData = {}) => {
    if (!user) return { error: 'No user authenticated' };
    
    const result = await notificationsService.createPaymentConfirmation(
      debtId, 
      user.id, 
      confirmerId,
      debtData // Pasar datos de la deuda para evitar queries problemáticas
    );
    
    if (!result.error) {
      // Refrescar notificaciones después de crear la solicitud
      loadingRef.current = false;
      await loadNotifications(user.id);
    }
    
    return result;
  };

  const respondPaymentConfirmation = async (confirmationId, confirmed) => {
    if (!user) return { error: 'No user authenticated' };
    
    const result = await notificationsService.respondPaymentConfirmation(confirmationId, confirmed, user.id);
    
    if (!result.error) {
      // Refrescar notificaciones después de responder
      loadingRef.current = false;
      await loadNotifications(user.id);
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
    deleteAllNotifications,
    requestPaymentConfirmation,
    respondPaymentConfirmation,
    refreshNotifications: () => { loadingRef.current = false; loadNotifications(user?.id); }
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

export default NotificationsContext;
