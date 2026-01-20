/**
 * PaymentMethodSelect - Selector de métodos de pago con opción de agregar nuevos
 */
import { useState, useEffect } from 'react';
import { useAuth, useUI } from '../../context';
import { Select, Button, Modal, Input } from '../';
import paymentMethodsService from '../../services/paymentMethodsService';
import styles from './PaymentMethodSelect.module.css';

const PaymentMethodSelect = ({ value, onChange, label = 'Método de Pago', required = false }) => {
  const { user } = useAuth();
  const { showSuccess, showError } = useUI();
  
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'other',
    icon: '💳',
    color: '#6366f1'
  });

  useEffect(() => {
    loadMethods();
  }, [user]);

  const loadMethods = async () => {
    if (!user) return;
    setLoading(true);
    const result = await paymentMethodsService.getPaymentMethods(user.id);
    setMethods(result.methods || []);
    setLoading(false);
  };

  const handleAddMethod = async (e) => {
    e.preventDefault();
    setSaving(true);

    const result = await paymentMethodsService.createPaymentMethod(user.id, formData);
    
    setSaving(false);

    if (!result.error) {
      showSuccess('Método de pago agregado');
      setShowModal(false);
      setFormData({ name: '', type: 'other', icon: '💳', color: '#6366f1' });
      await loadMethods();
      
      // Seleccionar el nuevo método automáticamente
      if (onChange && result.method) {
        onChange({ target: { value: result.method.id } });
      }
    } else {
      showError('Error al agregar método de pago');
    }
  };

  const typeIcons = {
    bank: '🏦',
    cash: '💵',
    card: '💳',
    digital_wallet: '📱',
    other: '💰'
  };

  return (
    <div className={styles.container}>
      <div className={styles.selectWrapper}>
        <Select
          label={label}
          value={value}
          onChange={onChange}
          required={required}
          disabled={loading}
        >
          <option value="">Selecciona un método</option>
          {methods.map(method => (
            <option key={method.id} value={method.id}>
              {method.icon} {method.name}
            </option>
          ))}
        </Select>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          icon="+"
          onClick={() => setShowModal(true)}
          className={styles.addButton}
          title="Agregar nuevo método"
        />
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Agregar Método de Pago"
        size="sm"
      >
        <form onSubmit={handleAddMethod} className={styles.form}>
          <Input
            label="Nombre"
            placeholder="Ej: Banco Galicia, Uala, etc."
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <Select
            label="Tipo"
            value={formData.type}
            onChange={(e) => {
              const type = e.target.value;
              setFormData({ 
                ...formData, 
                type,
                icon: typeIcons[type] || '💳'
              });
            }}
          >
            <option value="bank">🏦 Banco</option>
            <option value="cash">💵 Efectivo</option>
            <option value="card">💳 Tarjeta</option>
            <option value="digital_wallet">📱 Billetera Digital</option>
            <option value="other">💰 Otro</option>
          </Select>

          <div className={styles.iconSelector}>
            <label>Ícono</label>
            <div className={styles.iconGrid}>
              {['💵', '🏦', '💳', '📱', '💰', '💸', '🤑', '💴', '💶', '💷'].map(icon => (
                <button
                  key={icon}
                  type="button"
                  className={`${styles.iconButton} ${formData.icon === icon ? styles.active : ''}`}
                  onClick={() => setFormData({ ...formData, icon })}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.colorSelector}>
            <label>Color</label>
            <div className={styles.colorGrid}>
              {['#ec0000', '#004481', '#00b1ea', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1'].map(color => (
                <button
                  key={color}
                  type="button"
                  className={`${styles.colorButton} ${formData.color === color ? styles.active : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setFormData({ ...formData, color })}
                />
              ))}
            </div>
          </div>

          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              Agregar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PaymentMethodSelect;
