/**
 * NotificationsPanel - Panel de notificaciones con pestañas y alertas
 */
import { useState, useRef, useEffect } from 'react';
import { useNotifications, useExpenses, useDebts } from '../../context';
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
  
  const { upcomingPayments: upcomingPaymentsData } = useExpenses();
  const { markInstallmentAsPaid, refreshDebts } = useDebts();
  
  // Extraer el array de pagos del objeto
  const upcomingPayments = upcomingPaymentsData?.payments || [];
  
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('notifications'); // 'notifications' | 'upcoming'
  const [respondingTo, setRespondingTo] = useState(null);
  const [hasPlayedSound, setHasPlayedSound] = useState(false);
  const panelRef = useRef(null);
  const audioRef = useRef(null);

  // Reproducir sonido cuando hay notificaciones nuevas
  useEffect(() => {
    if (unreadCount > 0 && !hasPlayedSound && !loading) {
      playNotificationSound();
      setHasPlayedSound(true);
    }
    if (unreadCount === 0) {
      setHasPlayedSound(false);
    }
  }, [unreadCount, loading, hasPlayedSound]);

  // Crear elemento de audio para notificaciones
  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLaiTcIHW==');
    audioRef.current.volume = 0.5;
  }, []);

  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(() => {
        // Silenciar error de autoplay bloqueado por el navegador
        // El sonido se reproducirá después de la primera interacción del usuario
      });
    }
  };

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
    setRespondingTo(notification.id);
    
    try {
      // Si es una notificación de tipo payment_claim (nuevo sistema de cuotas)
      if (notification.type === 'payment_claim' && notification.data?.installment_id) {
        if (confirmed) {
          // Marcar la cuota como pagada
          const result = await markInstallmentAsPaid(notification.data.installment_id);
          if (result.success) {
            await deleteNotification(notification.id);
            refreshDebts();
          }
        } else {
          // Solo eliminar la notificación si rechaza
          await deleteNotification(notification.id);
        }
      } 
      // Sistema viejo con payment_confirmations
      else if (notification.data?.confirmation_id) {
        await respondPaymentConfirmation(notification.data.confirmation_id, confirmed);
        await deleteNotification(notification.id);
      }
    } finally {
      setRespondingTo(null);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'payment_confirmation':
        return '💰';
      case 'payment_claim':
        return '💵';
      case 'payment_response':
        return '✅';
      case 'friend_request':
        return '👥';
      case 'debt_request':
        return '💳';
      case 'installment_paid':
        return '✅';
      case 'installment_reverted':
        return '↩️';
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

  // Calcular próximos vencimientos (próximos 7 días)
  const nextWeekPayments = upcomingPayments.filter(payment => {
    const daysUntil = payment.daysUntil;
    return daysUntil >= 0 && daysUntil <= 7;
  });

  return (
    <div className={styles.container} ref={panelRef}>
      <button 
        className={styles.bellButton}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notificaciones"
      >
        <span className={styles.bellIcon}>🔔</span>
        {unreadCount > 0 && (
          <>
            <span className={styles.badge}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
            <span className={styles.redDot}></span>
          </>
        )}
      </button>

      {isOpen && (
        <div className={styles.panel}>
          {/* Pestañas */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'notifications' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('notifications')}
            >
              <span>🔔</span>
              Notificaciones
              {unreadCount > 0 && (
                <span className={styles.tabBadge}>{unreadCount}</span>
              )}
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'upcoming' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('upcoming')}
            >
              <span>⏰</span>
              Vencimientos
              {nextWeekPayments.length > 0 && (
                <span className={styles.tabBadge}>{nextWeekPayments.length}</span>
              )}
            </button>
          </div>

          {/* Contenido de Notificaciones */}
          {activeTab === 'notifications' && (
            <>
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
                    <p>Cargando...</p>
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

                      {!notification.read && <div className={styles.unreadDot}></div>}
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* Contenido de Próximos Vencimientos */}
          {activeTab === 'upcoming' && (
            <>
              <div className={styles.header}>
                <h3>Próximos Vencimientos</h3>
                <span className={styles.subtitle}>Próximos 7 días</span>
              </div>

              <div className={styles.notificationsList}>
                {nextWeekPayments.length === 0 ? (
                  <div className={styles.empty}>
                    <span className={styles.emptyIcon}>✅</span>
                    <p>No hay vencimientos próximos</p>
                  </div>
                ) : (
                  nextWeekPayments.map((payment, index) => (
                    <div
                      key={index}
                      className={`${styles.upcomingItem} ${payment.daysUntil === 0 ? styles.today : payment.daysUntil <= 2 ? styles.urgent : ''}`}
                    >
                      <span className={styles.upcomingIcon}>
                        {payment.daysUntil === 0 ? '🚨' : payment.daysUntil <= 2 ? '⚠️' : '📅'}
                      </span>
                      
                      <div className={styles.upcomingContent}>
                        <h4>{payment.description}</h4>
                        <p className={styles.upcomingAmount}>
                          {payment.currency_symbol || '$'}
                          {payment.amount.toLocaleString('es-AR')}
                        </p>
                        <span className={styles.upcomingDate}>
                          {payment.daysUntil === 0 
                            ? '¡Hoy vence!' 
                            : payment.daysUntil === 1 
                            ? 'Vence mañana' 
                            : `Vence en ${payment.daysUntil} días`}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationsPanel;
