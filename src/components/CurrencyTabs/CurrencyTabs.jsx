/**
 * CurrencyTabs - Tabs para filtrar por moneda
 */
import { CURRENCIES } from '../CurrencySelect';
import styles from './CurrencyTabs.module.css';

const CurrencyTabs = ({ selectedCurrency, onCurrencyChange, availableCurrencies = [] }) => {
  // Mostrar solo las monedas que el usuario tiene datos
  const activeCurrencies = CURRENCIES.filter(c => 
    availableCurrencies.includes(c.value)
  );

  // Si no hay monedas disponibles, mostrar todas
  const currenciesToShow = activeCurrencies.length > 0 ? activeCurrencies : [CURRENCIES[0]];

  return (
    <div className={styles.currencyTabs}>
      {currenciesToShow.map(currency => (
        <button
          key={currency.value}
          className={`${styles.tab} ${selectedCurrency === currency.value ? styles.active : ''}`}
          onClick={() => onCurrencyChange(currency.value)}
        >
          <span className={styles.symbol}>{currency.symbol}</span>
          <span className={styles.code}>{currency.value}</span>
        </button>
      ))}
    </div>
  );
};

export default CurrencyTabs;
