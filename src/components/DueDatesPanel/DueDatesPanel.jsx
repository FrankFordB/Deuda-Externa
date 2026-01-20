/**
 * Due Dates Panel - Panel lateral con vencimientos y notificaciones
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth, useExpenses, useDebts, useNotifications, useUI } from '../../context';
import { Button, Loading } from '../';
import remindersService from '../../services/remindersService';
import styles from './DueDatesPanel.module.css';

const DueDatesPanel = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { expenses } = useExpenses();
  const { debts } = useDebts();
  const { notifications, markAsRead, deleteNotification } = useNotifications();
  const { siteConfig, showSuccess } = useUI();
  const [loading, setLoading] = useState(false);
  const [upcomingDueDates, setUpcomingDueDates] = useState(null);
  const [hasNewItems, setHasNewItems] = useState(false);
  const audioRef = useRef(null);

  const currency = siteConfig?.currency || '$';

  // Cargar vencimientos próximos
  useEffect(() => {
    if (!user || !isOpen) return;

    const loadDueDates = async () => {
      setLoading(true);
      const result = await remindersService.getUpcomingDueDates(user.id);
      
      if (!result.error && result.dueDates) {
        const oldCount = upcomingDueDates ? 
          (upcomingDueDates.installments?.length || 0) + 
          (upcomingDueDates.debtsIOwned?.length || 0) + 
          (upcomingDueDates.debtsOwedToMe?.length || 0) : 0;
        
        const newCount = 
          (result.dueDates?.installments?.length || 0) +
          (result.dueDates?.debtsIOwned?.length || 0) +
          (result.dueDates?.debtsOwedToMe?.length || 0);

        if (newCount > oldCount) {
          setHasNewItems(true);
          // Reproducir sonido de notificación
          if (audioRef.current) {
            audioRef.current.play().catch(() => {});
          }
        }

        setUpcomingDueDates(result.dueDates);
      }
      setLoading(false);
    };

    loadDueDates();
    
    // Recargar cada 30 segundos para datos en tiempo real
    const interval = setInterval(loadDueDates, 30000);
    return () => clearInterval(interval);
  }, [user, isOpen]);

  // Agrupar notificaciones por tipo
  const groupedNotifications = useMemo(() => {
    const grouped = {
      paymentConfirmations: [],
      debtReminders: [],
      changeRequests: [],
      friendRequests: [],
      other: []
    };

    notifications.forEach(notif => {
      switch (notif.type) {
        case 'payment_confirmation':
          grouped.paymentConfirmations.push(notif);
          break;
        case 'debt_reminder':
        case 'debt_overdue':
          grouped.debtReminders.push(notif);
          break;
        case 'change_request':
          grouped.changeRequests.push(notif);
          break;
        case 'friend_request':
          grouped.friendRequests.push(notif);
          break;
        default:
          grouped.other.push(notif);
      }
    });

    return grouped;
  }, [notifications]);

  const totalNotifications = notifications.length;
  const totalDueDates = upcomingDueDates ? 
    (upcomingDueDates.installments?.length || 0) + 
    (upcomingDueDates.debtsIOwned?.length || 0) + 
    (upcomingDueDates.debtsOwedToMe?.length || 0) : 0;

  const formatCurrency = (value) => {
    return `${currency}${value.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`;
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const diffDays = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Mañana';
    if (diffDays < 7) return `En ${diffDays} días`;
    
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short'
    });
  };

  const isOverdue = (dateStr) => {
    return new Date(dateStr) < new Date();
  };

  const handleMarkAllRead = () => {
    notifications.forEach(notif => {
      if (!notif.read) markAsRead(notif.id);
    });
    showSuccess('Notificaciones marcadas como leídas');
  };

  const handleNotificationClick = (notif) => {
    if (!notif.read) {
      markAsRead(notif.id);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Audio para notificación */}
      <audio ref={audioRef} src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZQQ0OV67o7K1aFApCmuD1v3QiBS99zu/ajDgGG2y57+OYQQ8OVrDm7a5eEwpAl9f0v3UjBi5+0O/Zij0HHWy47eGZRBENVK7n7KxcFApAmNj1wHklBjF+0e/YjjoHHm647uOZRQ8OIAA/H/AABCByRN..." preload="auto" />
      
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <h2 className={styles.title}>
                📅 Vencimientos y Notificaciones
                {(totalNotifications > 0 || hasNewItems) && (
                  <span className={styles.badge}>{totalNotifications + totalDueDates}</span>
                )}
              </h2>
            </div>
            <button className={styles.closeBtn} onClick={onClose}>×</button>
          </div>

          {loading ? (
            <div className={styles.loading}>
              <Loading size="md" text="Cargando..." />
            </div>
          ) : (
            <div className={styles.content}>
              {/* Próximos Vencimientos */}
              {upcomingDueDates && totalDueDates > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>⏰ Próximos Vencimientos</h3>
                    <span className={styles.count}>{totalDueDates}</span>
                  </div>

                  {/* Cuotas */}
                  {upcomingDueDates.installments && upcomingDueDates.installments.length > 0 && (
                    <div className={styles.subsection}>
                      <h4 className={styles.subsectionTitle}>💳 Cuotas Pendientes</h4>
                      {upcomingDueDates.installments.map((inst) => {
                        const overdue = isOverdue(inst.due_date);
                        return (
                          <div 
                            key={inst.id} 
                            className={`${styles.item} ${overdue ? styles.overdue : styles.upcoming}`}
                          >
                            <div className={styles.itemIcon}>
                              {overdue ? '⚠️' : '📅'}
                            </div>
                            <div className={styles.itemContent}>
                              <div className={styles.itemTitle}>
                                {inst.expense?.description || 'Cuota'}
                              </div>
                              <div className={styles.itemMeta}>
                                Cuota {inst.installment_number} • {formatDate(inst.due_date)}
                              </div>
                            </div>
                            <div className={styles.itemAmount}>
                              {formatCurrency(inst.amount)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Deudas que tengo */}
                  {upcomingDueDates.debtsIOwned && upcomingDueDates.debtsIOwned.length > 0 && (
                    <div className={styles.subsection}>
                      <h4 className={styles.subsectionTitle}>💸 Deudas a Pagar</h4>
                      {upcomingDueDates.debtsIOwned.map((debt) => {
                        const overdue = isOverdue(debt.due_date);
                        return (
                          <div 
                            key={debt.id} 
                            className={`${styles.item} ${overdue ? styles.overdue : styles.upcoming}`}
                          >
                            <div className={styles.itemIcon}>
                              {overdue ? '⚠️' : '💸'}
                            </div>
                            <div className={styles.itemContent}>
                              <div className={styles.itemTitle}>
                                Deuda con {debt.creditor_type === 'virtual' 
                                  ? debt.virtual_friend?.name 
                                  : debt.creditor?.first_name}
                              </div>
                              <div className={styles.itemMeta}>
                                {debt.description} • {formatDate(debt.due_date)}
                              </div>
                            </div>
                            <div className={styles.itemAmount}>
                              {formatCurrency(debt.amount)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Deudas que me deben */}
                  {upcomingDueDates.debtsOwedToMe && upcomingDueDates.debtsOwedToMe.length > 0 && (
                    <div className={styles.subsection}>
                      <h4 className={styles.subsectionTitle}>💰 Deudas a Cobrar</h4>
                      {upcomingDueDates.debtsOwedToMe.map((debt) => (
                        <div key={debt.id} className={`${styles.item} ${styles.income}`}>
                          <div className={styles.itemIcon}>💰</div>
                          <div className={styles.itemContent}>
                            <div className={styles.itemTitle}>
                              {debt.debtor_type === 'virtual' 
                                ? debt.virtual_friend?.name 
                                : debt.debtor?.first_name} te debe
                            </div>
                            <div className={styles.itemMeta}>
                              {debt.description} • {formatDate(debt.due_date)}
                            </div>
                          </div>
                          <div className={`${styles.itemAmount} ${styles.positive}`}>
                            +{formatCurrency(debt.amount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Notificaciones */}
              {totalNotifications > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>🔔 Notificaciones</h3>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={handleMarkAllRead}
                    >
                      Marcar todas leídas
                    </Button>
                  </div>

                  {/* Confirmaciones de pago */}
                  {groupedNotifications.paymentConfirmations.length > 0 && (
                    <div className={styles.subsection}>
                      <h4 className={styles.subsectionTitle}>✅ Confirmaciones de Pago</h4>
                      {groupedNotifications.paymentConfirmations.map((notif) => (
                        <div 
                          key={notif.id} 
                          className={`${styles.notification} ${notif.read ? styles.read : ''}`}
                          onClick={() => handleNotificationClick(notif)}
                        >
                          <div className={styles.notifIcon}>✅</div>
                          <div className={styles.notifContent}>
                            <div className={styles.notifTitle}>{notif.title}</div>
                            <div className={styles.notifMessage}>{notif.message}</div>
                            <div className={styles.notifTime}>
                              {new Date(notif.created_at).toLocaleDateString('es-AR')}
                            </div>
                          </div>
                          <button 
                            className={styles.deleteBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notif.id);
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Recordatorios de deuda */}
                  {groupedNotifications.debtReminders.length > 0 && (
                    <div className={styles.subsection}>
                      <h4 className={styles.subsectionTitle}>⏰ Recordatorios</h4>
                      {groupedNotifications.debtReminders.map((notif) => (
                        <div 
                          key={notif.id} 
                          className={`${styles.notification} ${notif.read ? styles.read : ''}`}
                          onClick={() => handleNotificationClick(notif)}
                        >
                          <div className={styles.notifIcon}>⏰</div>
                          <div className={styles.notifContent}>
                            <div className={styles.notifTitle}>{notif.title}</div>
                            <div className={styles.notifMessage}>{notif.message}</div>
                            <div className={styles.notifTime}>
                              {new Date(notif.created_at).toLocaleDateString('es-AR')}
                            </div>
                          </div>
                          <button 
                            className={styles.deleteBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notif.id);
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Solicitudes de cambio */}
                  {groupedNotifications.changeRequests.length > 0 && (
                    <div className={styles.subsection}>
                      <h4 className={styles.subsectionTitle}>🔄 Solicitudes de Cambio</h4>
                      {groupedNotifications.changeRequests.map((notif) => (
                        <div 
                          key={notif.id} 
                          className={`${styles.notification} ${notif.read ? styles.read : ''}`}
                          onClick={() => handleNotificationClick(notif)}
                        >
                          <div className={styles.notifIcon}>🔄</div>
                          <div className={styles.notifContent}>
                            <div className={styles.notifTitle}>{notif.title}</div>
                            <div className={styles.notifMessage}>{notif.message}</div>
                            <div className={styles.notifTime}>
                              {new Date(notif.created_at).toLocaleDateString('es-AR')}
                            </div>
                          </div>
                          <button 
                            className={styles.deleteBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notif.id);
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Otras notificaciones */}
                  {(groupedNotifications.friendRequests.length > 0 || groupedNotifications.other.length > 0) && (
                    <div className={styles.subsection}>
                      <h4 className={styles.subsectionTitle}>📬 Otras</h4>
                      {[...groupedNotifications.friendRequests, ...groupedNotifications.other].map((notif) => (
                        <div 
                          key={notif.id} 
                          className={`${styles.notification} ${notif.read ? styles.read : ''}`}
                          onClick={() => handleNotificationClick(notif)}
                        >
                          <div className={styles.notifIcon}>📬</div>
                          <div className={styles.notifContent}>
                            <div className={styles.notifTitle}>{notif.title}</div>
                            <div className={styles.notifMessage}>{notif.message}</div>
                            <div className={styles.notifTime}>
                              {new Date(notif.created_at).toLocaleDateString('es-AR')}
                            </div>
                          </div>
                          <button 
                            className={styles.deleteBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notif.id);
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Empty State */}
              {totalNotifications === 0 && totalDueDates === 0 && (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>🎉</div>
                  <h3>Todo al día</h3>
                  <p>No tienes vencimientos próximos ni notificaciones pendientes</p>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className={styles.footer}>
            <Button variant="secondary" onClick={onClose} className={styles.fullWidth}>
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default DueDatesPanel;
