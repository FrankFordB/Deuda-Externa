/**
 * Select Component
 */
import { forwardRef } from 'react';
import styles from './Select.module.css';

const Select = forwardRef(({ 
  label,
  error,
  options = [],
  placeholder = 'Seleccionar...',
  className = '',
  ...props 
}, ref) => {
  return (
    <div className={`${styles.selectGroup} ${className}`}>
      {label && (
        <label className={styles.label}>{label}</label>
      )}
      <div className={styles.selectWrapper}>
        <select 
          ref={ref}
          className={`${styles.select} ${error ? styles.error : ''}`}
          {...props}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className={styles.arrow}>▼</span>
      </div>
      {error && (
        <span className={styles.errorText}>{error}</span>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;
