/**
 * Input Component
 */
import { forwardRef } from 'react';
import styles from './Input.module.css';

const Input = forwardRef(({ 
  label,
  error,
  icon,
  type = 'text',
  className = '',
  ...props 
}, ref) => {
  return (
    <div className={`${styles.inputGroup} ${className}`}>
      {label && (
        <label className={styles.label}>{label}</label>
      )}
      <div className={`${styles.inputWrapper} ${icon ? styles.hasIcon : ''}`}>
        {icon && <span className={styles.icon}>{icon}</span>}
        <input 
          ref={ref}
          type={type}
          className={`${styles.input} ${error ? styles.error : ''}`}
          {...props}
        />
      </div>
      {error && (
        <span className={styles.errorText}>{error}</span>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
