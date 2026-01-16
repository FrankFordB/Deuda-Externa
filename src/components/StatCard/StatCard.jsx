/**
 * StatCard Component - Tarjeta de estadística
 */
import styles from './StatCard.module.css';

const StatCard = ({ 
  icon,
  label,
  value,
  change,
  changeType,
  variant = 'default',
  className = ''
}) => {
  return (
    <div className={`${styles.statCard} ${styles[variant]} ${className}`}>
      {icon && (
        <div className={styles.icon}>{icon}</div>
      )}
      <div className={styles.value}>{value}</div>
      <div className={styles.label}>{label}</div>
      {change !== undefined && (
        <div className={`${styles.change} ${styles[changeType || (change >= 0 ? 'positive' : 'negative')]}`}>
          {change >= 0 ? '↑' : '↓'} {Math.abs(change)}%
        </div>
      )}
    </div>
  );
};

export default StatCard;
