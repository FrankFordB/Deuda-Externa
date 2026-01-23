/**
 * NumberInput - Input de número con formato de miles (puntos)
 */
import { forwardRef, useState, useEffect } from 'react';
import styles from '../Input/Input.module.css';

/**
 * Formatea un número con puntos como separador de miles
 * @param {string|number} value - Valor a formatear
 * @returns {string} Valor formateado
 */
export const formatNumberWithDots = (value) => {
  if (value === '' || value === null || value === undefined) return '';
  
  // Convertir a string y limpiar
  let numStr = String(value).replace(/[^\d,.-]/g, '');
  
  // Manejar decimales (coma)
  const parts = numStr.split(',');
  let intPart = parts[0].replace(/\./g, ''); // Quitar puntos existentes
  const decPart = parts[1];
  
  // Manejar negativo
  const isNegative = intPart.startsWith('-');
  if (isNegative) intPart = intPart.slice(1);
  
  // Agregar puntos de miles
  intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  // Reconstruir
  let result = isNegative ? '-' + intPart : intPart;
  if (decPart !== undefined) {
    result += ',' + decPart;
  }
  
  return result;
};

/**
 * Parsea un string formateado a número
 * @param {string} formattedValue - Valor formateado con puntos
 * @returns {number} Valor numérico
 */
export const parseFormattedNumber = (formattedValue) => {
  if (!formattedValue) return 0;
  // Quitar puntos de miles y reemplazar coma decimal por punto
  const cleaned = String(formattedValue).replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

const NumberInput = forwardRef(({ 
  label,
  error,
  icon,
  value,
  onChange,
  onValueChange,
  allowDecimals = true,
  allowNegative = false,
  className = '',
  hint,
  ...props 
}, ref) => {
  const [displayValue, setDisplayValue] = useState('');

  // Sincronizar displayValue con value prop
  useEffect(() => {
    if (value !== undefined && value !== null) {
      // Si el valor es un número, formatearlo
      if (typeof value === 'number') {
        setDisplayValue(formatNumberWithDots(value.toString().replace('.', ',')));
      } else {
        setDisplayValue(formatNumberWithDots(value));
      }
    } else {
      setDisplayValue('');
    }
  }, [value]);

  const handleChange = (e) => {
    let inputValue = e.target.value;
    
    // Permitir campo vacío
    if (inputValue === '') {
      setDisplayValue('');
      if (onValueChange) onValueChange(0);
      if (onChange) onChange({ target: { value: '', name: props.name } });
      return;
    }

    // Filtrar caracteres permitidos
    let allowedChars = '0-9.';
    if (allowDecimals) allowedChars += ',';
    if (allowNegative) allowedChars += '-';
    
    const regex = new RegExp(`[^${allowedChars}]`, 'g');
    inputValue = inputValue.replace(regex, '');

    // Evitar múltiples comas decimales
    const commaCount = (inputValue.match(/,/g) || []).length;
    if (commaCount > 1) {
      const lastCommaIndex = inputValue.lastIndexOf(',');
      inputValue = inputValue.slice(0, lastCommaIndex) + inputValue.slice(lastCommaIndex + 1);
    }

    // Limitar decimales a 2
    if (allowDecimals && inputValue.includes(',')) {
      const [int, dec] = inputValue.split(',');
      if (dec && dec.length > 2) {
        inputValue = int + ',' + dec.slice(0, 2);
      }
    }

    // Formatear
    const formatted = formatNumberWithDots(inputValue);
    setDisplayValue(formatted);

    // Parsear valor numérico
    const numericValue = parseFormattedNumber(formatted);
    
    // Callbacks
    if (onValueChange) onValueChange(numericValue);
    if (onChange) {
      onChange({ 
        target: { 
          value: numericValue, 
          name: props.name,
          formattedValue: formatted
        } 
      });
    }
  };

  return (
    <div className={`${styles.inputGroup} ${className}`}>
      {label && (
        <label className={styles.label}>{label}</label>
      )}
      <div className={`${styles.inputWrapper} ${icon ? styles.hasIcon : ''}`}>
        {icon && <span className={styles.icon}>{icon}</span>}
        <input 
          ref={ref}
          type="text"
          inputMode="decimal"
          className={`${styles.input} ${error ? styles.error : ''}`}
          value={displayValue}
          onChange={handleChange}
          {...props}
        />
      </div>
      {hint && !error && (
        <span className={styles.hint}>{hint}</span>
      )}
      {error && (
        <span className={styles.errorText}>{typeof error === 'string' ? error : ''}</span>
      )}
    </div>
  );
});

NumberInput.displayName = 'NumberInput';

export default NumberInput;
