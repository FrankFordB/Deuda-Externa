/**
 * Empty State Component
 */
import styles from './EmptyState.module.css';
import Button from '../Button';

const EmptyState = ({ 
  icon = '📭',
  title,
  description,
  action,
  actionLabel,
  onAction
}) => {
  return (
    <div className={styles.container}>
      <div className={styles.icon}>{icon}</div>
      <h3 className={styles.title}>{title}</h3>
      {description && (
        <p className={styles.description}>{description}</p>
      )}
      {action && (
        <Button onClick={onAction}>
          {actionLabel || action}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
