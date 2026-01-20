/**
 * CurrencySelect - Selector de moneda con banderas
 */
import Select from '../Select';
import styles from './CurrencySelect.module.css';

export const CURRENCIES = [
  { value: 'ARS', label: 'Peso Argentino 🇦🇷', symbol: '$', country: 'AR' },
  { value: 'USD', label: 'Dólar 🇺🇸', symbol: 'US$', country: 'US' },
  { value: 'EUR', label: 'Euro 🇪🇺', symbol: '€', country: 'EU' },
  { value: 'BRL', label: 'Real 🇧🇷', symbol: 'R$', country: 'BR' },
  { value: 'CLP', label: 'Peso Chileno 🇨🇱', symbol: 'CLP$', country: 'CL' },
  { value: 'COP', label: 'Peso Colombiano 🇨🇴', symbol: 'COL$', country: 'CO' },
  { value: 'MXN', label: 'Peso Mexicano 🇲🇽', symbol: 'MX$', country: 'MX' },
  { value: 'UYU', label: 'Peso Uruguayo 🇺🇾', symbol: '$U', country: 'UY' }
];

const CurrencySelect = ({ value, onChange, error, label = 'Moneda', ...props }) => {
  const options = CURRENCIES.map(c => ({
    value: c.value,
    label: c.label
  }));

  return (
    <div className={styles.currencySelect}>
      <Select
        label={label}
        value={value}
        onChange={onChange}
        options={options}
        error={error}
        {...props}
      />
      {value && (
        <div className={styles.currencyInfo}>
          <span className={styles.symbol}>
            {CURRENCIES.find(c => c.value === value)?.symbol}
          </span>
        </div>
      )}
    </div>
  );
};

export default CurrencySelect;
