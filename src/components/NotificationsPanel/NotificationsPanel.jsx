/**
 * NotificationsPanel - Panel de notificaciones con dropdown
 */
import { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../../context';
import styles from './NotificationsPanel.module.css';

const NotificationsPanel = () => {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification,
    respondPaymentConfirmation,
    loading 
  } = useNotifications();
  
  const [isOpen, setIsOpen] = useState(false);
  const [respondingTo, setRespondingTo] = useState(null);
  const panelRef = useRef(null);

  // Cerrar panel al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
  };

  const handleConfirmPayment = async (notification, confirmed) => {
    if (!notification.data?.confirmation_id) return;
    
    setRespondingTo(notification.id);
    try {
      await respondPaymentConfirmation(notification.data.confirmation_id, confirmed);
      await deleteNotification(notification.id);
    } finally {
      setRespondingTo(null);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'payment_confirmation':
        return '💰';
      case 'payment_response':
        return '✅';
      case 'friend_request':
        return '👥';
      case 'debt_request':
        return '💳';
      default:
        return '🔔';
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Ahora';
    if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)} h`;
    return date.toLocaleDateString();
  };

  return (
    <div className={styles.container} ref={panelRef}>
      <button 
        className={styles.bellButton}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notificaciones"
      >
        <span className={styles.bellIcon}>🔔</span>
        {unreadCount > 0 && (
          <span className={styles.badge}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <h3>Notificaciones</h3>
            {unreadCount > 0 && (
              <button 
                className={styles.markAllRead}
                onClick={markAllAsRead}
              >
                Marcar todo como leído
              </button>
            )}
          </div>

          <div className={styles.notificationsList}>
            {loading ? (
              <div className={styles.loading}>
                <div className="loading-spinner"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}>🔕</span>
                <p>No hay notificaciones</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`${styles.notification} ${!notification.read ? styles.unread : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <span className={styles.notificationIcon}>
                    {getNotificationIcon(notification.type)}
                  </span>
                  
                  <div className={styles.notificationContent}>
                    <h4>{notification.title}</h4>
                    <p>{notification.message}</p>
                    <span className={styles.time}>{formatTime(notification.created_at)}</span>
                    
                    {/* Botones de acción para confirmación de pago */}
                    {notification.action_required && notification.action_type === 'confirm_payment' && (
                      <div className={styles.actionButtons}>
                        <button
                          className={`${styles.actionBtn} ${styles.confirm}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConfirmPayment(notification, true);
                          }}
                          disabled={respondingTo === notification.id}
                        >
                          {respondingTo === notification.id ? '...' : '✓ Sí, pagó'}
                        </button>
                        <button
                          className={`${styles.actionBtn} ${styles.reject}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConfirmPayment(notification, false);
                          }}
                          disabled={respondingTo === notification.id}
                        >
                          {respondingTo === notification.id ? '...' : '✗ No pagó'}
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notification.id);
                    }}
                    aria-label="Eliminar"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsPanel;
