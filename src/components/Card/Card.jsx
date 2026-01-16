/**
 * Card Component
 */
import styles from './Card.module.css';

const Card = ({ 
  children, 
  title,
  subtitle,
  footer,
  variant = 'default',
  className = '',
  ...props 
}) => {
  return (
    <div 
      className={`${styles.card} ${styles[variant]} ${className}`}
      {...props}
    >
      {(title || subtitle) && (
        <div className={styles.header}>
          {title && <h3 className={styles.title}>{title}</h3>}
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
      )}
      <div className={styles.body}>
        {children}
      </div>
      {footer && (
        <div className={styles.footer}>
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;
