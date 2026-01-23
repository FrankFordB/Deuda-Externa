/**
 * RecurringExpenseForm - Formulario para crear/editar gastos recurrentes
 */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Input, Select, Button, CurrencySelect } from '../';
import styles from './RecurringExpenseForm.module.css';

const CATEGORIES = [
  { value: 'gym', label: '🏋️ Gimnasio' },
  { value: 'sports', label: '⚽ Deportes' },
  { value: 'subscriptions', label: '📺 Suscripciones' },
  { value: 'insurance', label: '🛡️ Seguros' },
  { value: 'rent', label: '🏠 Alquiler' },
  { value: 'utilities', label: '💡 Servicios' },
  { value: 'education', label: '📚 Educación' },
  { value: 'health', label: '⚕️ Salud' },
  { value: 'transport', label: '🚗 Transporte' },
  { value: 'other', label: '📌 Otro' }
];

const FREQUENCIES = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'yearly', label: 'Anual' }
];

const RecurringExpenseForm = ({ 
  initialData = null, 
  bankAccounts = [],
  onSubmit, 
  onCancel,
  loading = false 
}) => {
  // Obtener cuenta por defecto (la primera disponible si no hay datos iniciales)
  const defaultAccountId = initialData?.bank_account_id || (bankAccounts.length > 0 ? bankAccounts[0].id : '');
  
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    amount: initialData?.amount || '',
    currency: initialData?.currency || 'ARS',
    currency_symbol: initialData?.currency_symbol || '$',
    category: initialData?.category || 'gym',
    frequency: initialData?.frequency || 'monthly',
    day_of_month: initialData?.day_of_month || 1,
    start_date: initialData?.start_date || new Date().toISOString().split('T')[0],
    end_date: initialData?.end_date || '',
    bank_account_id: defaultAccountId
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCurrencyChange = (e) => {
    const currencyCode = e.target.value;
    const currencies = {
      'ARS': '$',
      'USD': 'US$',
      'EUR': '€',
      'BRL': 'R$'
    };
    setFormData(prev => ({
      ...prev,
      currency: currencyCode,
      currency_symbol: currencies[currencyCode] || '$'
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  // Generar opciones de días del mes
  const dayOptions = [];
  for (let i = 1; i <= 31; i++) {
    dayOptions.push({ value: i, label: `Día ${i}` });
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          {initialData ? '✏️ Editar Gasto Fijo' : '➕ Nuevo Gasto Fijo'}
        </h3>
        <p className={styles.subtitle}>
          Los gastos fijos se generan automáticamente cada período
        </p>
      </div>

      <div className={styles.grid}>
        <Input
          label="Nombre del gasto *"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="ej: Gimnasio, Netflix, etc."
          required
        />

        <Select
          label="Categoría"
          name="category"
          value={formData.category}
          onChange={handleChange}
          options={CATEGORIES}
        />
      </div>

      <Input
        label="Descripción (opcional)"
        name="description"
        value={formData.description}
        onChange={handleChange}
        placeholder="Detalles adicionales..."
      />

      <div className={styles.grid}>
        <Input
          label="Monto *"
          name="amount"
          type="number"
          step="0.01"
          min="0"
          value={formData.amount}
          onChange={handleChange}
          placeholder="0.00"
          required
        />

        <CurrencySelect
          label="Moneda"
          name="currency"
          value={formData.currency}
          onChange={handleCurrencyChange}
        />
      </div>

      <div className={styles.divider}>
        <span className={styles.dividerText}>⏰ Configuración de Recurrencia</span>
      </div>

      <div className={styles.grid}>
        <Select
          label="Frecuencia *"
          name="frequency"
          value={formData.frequency}
          onChange={handleChange}
          options={FREQUENCIES}
        />

        {formData.frequency === 'monthly' && (
          <Select
            label="Día del mes"
            name="day_of_month"
            value={formData.day_of_month}
            onChange={handleChange}
            options={dayOptions}
          />
        )}
      </div>

      <div className={styles.grid}>
        <Input
          label="Fecha de inicio *"
          name="start_date"
          type="date"
          value={formData.start_date}
          onChange={handleChange}
          required
        />

        <Input
          label="Fecha de fin (opcional)"
          name="end_date"
          type="date"
          value={formData.end_date}
          onChange={handleChange}
          min={formData.start_date}
        />
      </div>

      {bankAccounts.length > 0 && (
        <Select
          label="Cuenta bancaria *"
          name="bank_account_id"
          value={formData.bank_account_id}
          onChange={handleChange}
          required
          options={[
            ...bankAccounts.map(acc => ({
              value: acc.id,
              label: `${acc.name} (${acc.currency_symbol}${acc.current_balance.toFixed(2)})`
            }))
          ]}
        />
      )}

      <div className={styles.infoBox}>
        <span className={styles.infoIcon}>ℹ️</span>
        <div>
          <strong>Próxima generación:</strong>
          <p className={styles.infoText}>
            Este gasto se creará automáticamente el {' '}
            {formData.frequency === 'monthly' && `día ${formData.day_of_month} de cada mes`}
            {formData.frequency === 'weekly' && 'cada semana'}
            {formData.frequency === 'yearly' && 'cada año'}
            {formData.end_date && ` hasta el ${new Date(formData.end_date).toLocaleDateString('es-AR')}`}
          </p>
        </div>
      </div>

      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? '⏳ Guardando...' : initialData ? '💾 Actualizar' : '✅ Crear Gasto Fijo'}
        </Button>
      </div>
    </form>
  );
};

RecurringExpenseForm.propTypes = {
  initialData: PropTypes.object,
  bankAccounts: PropTypes.array,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  loading: PropTypes.bool
};

export default RecurringExpenseForm;
