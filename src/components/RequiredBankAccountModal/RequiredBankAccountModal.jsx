/**
 * RequiredBankAccountModal - Modal para obligar creación de primera cuenta bancaria
 */
import { useState } from 'react';
import Modal from '../Modal';
import Input from '../Input';
import Select from '../Select';
import Button from '../Button';
import { CURRENCIES } from '../CurrencySelect';
import styles from './RequiredBankAccountModal.module.css';

const RequiredBankAccountModal = ({ isOpen, onCreateAccount }) => {
  const [formData, setFormData] = useState({
    name: '',
    currency: 'ARS',
    currency_symbol: '$',
    initial_balance: '0'
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCurrencyChange = (e) => {
    const currencyCode = e.target.value;
    const selectedCurrency = CURRENCIES.find(c => c.value === currencyCode);
    setFormData(prev => ({
      ...prev,
      currency: currencyCode,
      currency_symbol: selectedCurrency?.symbol || '$'
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onCreateAccount(formData);
    setLoading(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}} // No permitir cerrar
      title="🏦 ¡Bienvenido! Crea tu primera cuenta"
      size="md"
      closeOnEscape={false}
      closeOnClickOutside={false}
    >
      <div className={styles.container}>
        <div className={styles.message}>
          <p className={styles.intro}>
            Para comenzar a gestionar tus finanzas, necesitas crear al menos una cuenta bancaria.
          </p>
          <p className={styles.benefit}>
            💡 Esto te permitirá:
          </p>
          <ul className={styles.benefitsList}>
            <li>✅ Registrar tus gastos</li>
            <li>✅ Vincular deudas</li>
            <li>✅ Ver estadísticas en tiempo real</li>
            <li>✅ Controlar tu balance</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <Input
            label="Nombre de la cuenta *"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="ej: Cuenta Sueldo, Caja de Ahorro..."
            required
            autoFocus
          />

          <Select
            label="Moneda *"
            name="currency"
            value={formData.currency}
            onChange={handleCurrencyChange}
            required
          >
            {CURRENCIES.map(currency => (
              <option key={currency.value} value={currency.value}>
                {currency.label}
              </option>
            ))}
          </Select>

          <Input
            label="Balance inicial"
            name="initial_balance"
            type="number"
            step="0.01"
            value={formData.initial_balance}
            onChange={handleChange}
            placeholder="0.00"
            helperText="¿Cuánto dinero tienes actualmente en esta cuenta?"
          />

          <div className={styles.actions}>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              fullWidth
            >
              {loading ? 'Creando cuenta...' : '✨ Crear mi primera cuenta'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default RequiredBankAccountModal;
