/**
 * Notification Toast Component
 */
import { useUI } from '../../context';
import styles from './Notifications.module.css';

const Notifications = () => {
  const { notifications, removeNotification } = useUI();

  if (notifications.length === 0) return null;

  const getIcon = (type) => {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '⚠';
      case 'info': return 'ℹ';
      default: return 'ℹ';
    }
  };

  return (
    <div className={styles.container}>
      {notifications.map((notification) => (
        <div 
          key={notification.id}
          className={`${styles.notification} ${styles[notification.type]}`}
        >
          <span className={styles.icon}>{getIcon(notification.type)}</span>
          <span className={styles.message}>{notification.message}</span>
          <button 
            className={styles.closeBtn}
            onClick={() => removeNotification(notification.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};

export default Notifications;
