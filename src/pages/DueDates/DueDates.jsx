/**
 * DueDates - Página de vencimientos y notificaciones
 */
import { useState, useEffect, useMemo } from 'react';
import { useAuth, useNotifications, useUI } from '../../context';
import { Card, Button, Loading } from '../../components';
import remindersService from '../../services/remindersService';
import { 
  Calendar, 
  Clock, 
  Bell, 
  AlertTriangle,
  CheckCircle,
  CreditCard,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Trash2,
  Check,
  RefreshCw,
  MessageSquare,
  Users,
  Mail
} from 'lucide-react';
import styles from './DueDates.module.css';

const DueDates = () => {
  const { user } = useAuth();
  const { notifications, markAsRead, deleteNotification } = useNotifications();
  const { siteConfig, showSuccess } = useUI();
  
  const [loading, setLoading] = useState(false);
  const [upcomingDueDates, setUpcomingDueDates] = useState(null);

  const currency = siteConfig?.currency || '$';

  // Cargar vencimientos próximos
  useEffect(() => {
    if (!user) return;

    const loadDueDates = async () => {
      setLoading(true);
      const result = await remindersService.getUpcomingDueDates(user.id);
      
      if (!result.error && result.dueDates) {
        setUpcomingDueDates(result.dueDates);
      }
      setLoading(false);
    };

    loadDueDates();
    
    // Recargar cada 30 segundos
    const interval = setInterval(loadDueDates, 30000);
    return () => clearInterval(interval);
  }, [user]);

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

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'payment_confirmation':
        return <CheckCircle size={18} />;
      case 'debt_reminder':
      case 'debt_overdue':
        return <Clock size={18} />;
      case 'change_request':
        return <RefreshCw size={18} />;
      case 'friend_request':
        return <Users size={18} />;
      default:
        return <Mail size={18} />;
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>
            <Calendar size={32} className={styles.titleIcon} />
            Vencimientos y Notificaciones
          </h2>
          <p className={styles.subtitle}>
            Mantén el control de tus pagos y alertas pendientes
          </p>
        </div>
        <div className={styles.headerStats}>
          <div className={`${styles.statBadge} ${styles.dueDates}`}>
            <Clock size={18} />
            <span>{totalDueDates} vencimientos</span>
          </div>
          <div className={`${styles.statBadge} ${styles.notifications}`}>
            <Bell size={18} />
            <span>{totalNotifications} notificaciones</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingContainer}>
          <Loading size="lg" text="Cargando datos..." />
        </div>
      ) : (
        <div className={styles.content}>
          {/* Próximos Vencimientos */}
          <div className={styles.sectionColumn}>
            <Card className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>
                  <Clock size={20} className={styles.sectionIcon} />
                  Próximos Vencimientos
                </h3>
                {totalDueDates > 0 && (
                  <span className={styles.badge}>{totalDueDates}</span>
                )}
              </div>

              {totalDueDates > 0 ? (
                <div className={styles.dueDatesList}>
                  {/* Cuotas */}
                  {upcomingDueDates?.installments && upcomingDueDates.installments.length > 0 && (
                    <div className={styles.subsection}>
                      <h4 className={styles.subsectionTitle}>
                        <CreditCard size={16} />
                        Cuotas Pendientes
                      </h4>
                      {upcomingDueDates.installments.map((inst) => {
                        const overdue = isOverdue(inst.due_date);
                        return (
                          <div 
                            key={inst.id} 
                            className={`${styles.dueItem} ${overdue ? styles.overdue : styles.upcoming}`}
                          >
                            <div className={styles.itemIcon}>
                              {overdue ? <AlertTriangle size={20} /> : <Calendar size={20} />}
                            </div>
                            <div className={styles.itemContent}>
                              <div className={styles.itemTitle}>
                                {inst.expense?.description || 'Cuota'}
                              </div>
                              <div className={styles.itemMeta}>
                                Cuota {inst.installment_number} - {formatDate(inst.due_date)}
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
                  {upcomingDueDates?.debtsIOwned && upcomingDueDates.debtsIOwned.length > 0 && (
                    <div className={styles.subsection}>
                      <h4 className={styles.subsectionTitle}>
                        <TrendingDown size={16} />
                        Deudas a Pagar
                      </h4>
                      {upcomingDueDates.debtsIOwned.map((debt) => {
                        const overdue = isOverdue(debt.due_date);
                        return (
                          <div 
                            key={debt.id} 
                            className={`${styles.dueItem} ${overdue ? styles.overdue : styles.upcoming}`}
                          >
                            <div className={styles.itemIcon}>
                              {overdue ? <AlertTriangle size={20} /> : <DollarSign size={20} />}
                            </div>
                            <div className={styles.itemContent}>
                              <div className={styles.itemTitle}>
                                Deuda con {debt.creditor_type === 'virtual' 
                                  ? debt.virtual_friend?.name 
                                  : debt.creditor?.first_name}
                              </div>
                              <div className={styles.itemMeta}>
                                {debt.description} - {formatDate(debt.due_date)}
                              </div>
                            </div>
                            <div className={`${styles.itemAmount} ${styles.expense}`}>
                              {formatCurrency(debt.amount)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Deudas que me deben */}
                  {upcomingDueDates?.debtsOwedToMe && upcomingDueDates.debtsOwedToMe.length > 0 && (
                    <div className={styles.subsection}>
                      <h4 className={styles.subsectionTitle}>
                        <TrendingUp size={16} />
                        Deudas a Cobrar
                      </h4>
                      {upcomingDueDates.debtsOwedToMe.map((debt) => (
                        <div key={debt.id} className={`${styles.dueItem} ${styles.income}`}>
                          <div className={styles.itemIcon}>
                            <DollarSign size={20} />
                          </div>
                          <div className={styles.itemContent}>
                            <div className={styles.itemTitle}>
                              {debt.debtor_type === 'virtual' 
                                ? debt.virtual_friend?.name 
                                : debt.debtor?.first_name} te debe
                            </div>
                            <div className={styles.itemMeta}>
                              {debt.description} - {formatDate(debt.due_date)}
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
              ) : (
                <div className={styles.emptyState}>
                  <CheckCircle size={48} className={styles.emptyIcon} />
                  <h4>Sin vencimientos próximos</h4>
                  <p>No tienes pagos pendientes en los próximos días</p>
                </div>
              )}
            </Card>
          </div>

          {/* Notificaciones */}
          <div className={styles.sectionColumn}>
            <Card className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>
                  <Bell size={20} className={styles.sectionIcon} />
                  Notificaciones
                </h3>
                {totalNotifications > 0 && (
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={handleMarkAllRead}
                    icon={<Check size={16} />}
                  >
                    Marcar todas leídas
                  </Button>
                )}
              </div>

              {totalNotifications > 0 ? (
                <div className={styles.notificationsList}>
                  {/* Confirmaciones de pago */}
                  {groupedNotifications.paymentConfirmations.length > 0 && (
                    <div className={styles.subsection}>
                      <h4 className={styles.subsectionTitle}>
                        <CheckCircle size={16} />
                        Confirmaciones de Pago
                      </h4>
                      {groupedNotifications.paymentConfirmations.map((notif) => (
                        <div 
                          key={notif.id} 
                          className={`${styles.notificationItem} ${notif.read ? styles.read : ''}`}
                          onClick={() => handleNotificationClick(notif)}
                        >
                          <div className={`${styles.notifIcon} ${styles.success}`}>
                            <CheckCircle size={18} />
                          </div>
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
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Recordatorios de deuda */}
                  {groupedNotifications.debtReminders.length > 0 && (
                    <div className={styles.subsection}>
                      <h4 className={styles.subsectionTitle}>
                        <Clock size={16} />
                        Recordatorios
                      </h4>
                      {groupedNotifications.debtReminders.map((notif) => (
                        <div 
                          key={notif.id} 
                          className={`${styles.notificationItem} ${notif.read ? styles.read : ''}`}
                          onClick={() => handleNotificationClick(notif)}
                        >
                          <div className={`${styles.notifIcon} ${styles.warning}`}>
                            <Clock size={18} />
                          </div>
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
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Solicitudes de cambio */}
                  {groupedNotifications.changeRequests.length > 0 && (
                    <div className={styles.subsection}>
                      <h4 className={styles.subsectionTitle}>
                        <RefreshCw size={16} />
                        Solicitudes de Cambio
                      </h4>
                      {groupedNotifications.changeRequests.map((notif) => (
                        <div 
                          key={notif.id} 
                          className={`${styles.notificationItem} ${notif.read ? styles.read : ''}`}
                          onClick={() => handleNotificationClick(notif)}
                        >
                          <div className={`${styles.notifIcon} ${styles.info}`}>
                            <RefreshCw size={18} />
                          </div>
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
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Solicitudes de amistad y otras */}
                  {(groupedNotifications.friendRequests.length > 0 || groupedNotifications.other.length > 0) && (
                    <div className={styles.subsection}>
                      <h4 className={styles.subsectionTitle}>
                        <MessageSquare size={16} />
                        Otras
                      </h4>
                      {[...groupedNotifications.friendRequests, ...groupedNotifications.other].map((notif) => (
                        <div 
                          key={notif.id} 
                          className={`${styles.notificationItem} ${notif.read ? styles.read : ''}`}
                          onClick={() => handleNotificationClick(notif)}
                        >
                          <div className={`${styles.notifIcon} ${styles.neutral}`}>
                            {getNotificationIcon(notif.type)}
                          </div>
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
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <Bell size={48} className={styles.emptyIcon} />
                  <h4>Sin notificaciones</h4>
                  <p>No tienes notificaciones pendientes</p>
                </div>
              )}
            </Card>
          </div>

          {/* Empty State General */}
          {totalNotifications === 0 && totalDueDates === 0 && (
            <Card className={styles.allClearCard}>
              <div className={styles.allClear}>
                <CheckCircle size={64} className={styles.allClearIcon} />
                <h3>Todo al día</h3>
                <p>No tienes vencimientos próximos ni notificaciones pendientes</p>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default DueDates;
