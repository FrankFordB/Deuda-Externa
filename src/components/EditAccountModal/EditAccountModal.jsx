/**
 * EditAccountModal - Modal para editar cuenta bancaria
 */
import { useState } from 'react';
import Modal from '../Modal';
import Input from '../Input';
import Select from '../Select';
import Button from '../Button';
import { CURRENCIES } from '../CurrencySelect';
import styles from './EditAccountModal.module.css';

const EditAccountModal = ({ isOpen, onClose, account, onSave, onDelete }) => {
  const [formData, setFormData] = useState({
    name: account?.name || '',
    initial_balance: account?.initial_balance || 0,
    currency: account?.currency || 'ARS',
    currency_symbol: account?.currency_symbol || '$'
  });
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCurrencyChange = (e) => {
    const selectedCurrency = CURRENCIES.find(c => c.value === e.target.value);
    setFormData(prev => ({
      ...prev,
      currency: selectedCurrency.value,
      currency_symbol: selectedCurrency.symbol
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error guardando cuenta:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await onDelete();
      onClose();
    } catch (error) {
      console.error('Error eliminando cuenta:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!account) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Editar Cuenta Bancaria"
      size="md"
    >
      {!showDeleteConfirm ? (
        <form onSubmit={handleSubmit} className={styles.form}>
          <Input
            label="Nombre de la Cuenta"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Ej: Cuenta Sueldo"
            required
            icon="🏦"
          />

          <div className={styles.row}>
            <Input
              label="Balance Inicial"
              name="initial_balance"
              type="number"
              step="0.01"
              value={formData.initial_balance}
              onChange={handleChange}
              required
              icon="💰"
            />

            <Select
              label="Moneda"
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
          </div>

          <div className={styles.info}>
            <span className={styles.infoIcon}>ℹ️</span>
            <p>
              Balance actual: <strong>{account.currency_symbol}{account.current_balance.toLocaleString('es-AR')}</strong>
            </p>
          </div>

          <div className={styles.actions}>
            <Button
              type="button"
              variant="danger"
              onClick={() => setShowDeleteConfirm(true)}
            >
              🗑️ Eliminar Cuenta
            </Button>
            
            <div className={styles.rightActions}>
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
              >
                {loading ? 'Guardando...' : '💾 Guardar Cambios'}
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <div className={styles.confirmDelete}>
          <div className={styles.warningIcon}>⚠️</div>
          <h3>¿Eliminar cuenta "{account.name}"?</h3>
          <p>Esta acción no se puede deshacer. Los gastos asociados a esta cuenta no se eliminarán.</p>
          
          <div className={styles.confirmActions}>
            <Button
              variant="secondary"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? 'Eliminando...' : 'Sí, Eliminar'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default EditAccountModal;
