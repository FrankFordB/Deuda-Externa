import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { recurringExpensesService } from '../../services';
import { RecurringExpenseForm, Button, Card, Modal } from '../';
import styles from './RecurringExpensesPanel.module.css';

const RecurringExpensesPanel = ({ userId, bankAccounts }) => {
  const [recurringExpenses, setRecurringExpenses] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (userId) {
      loadRecurringExpenses();
      loadStats();
    }
  }, [userId]);

  const loadRecurringExpenses = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await recurringExpensesService.getUserRecurringExpenses(userId);
      setRecurringExpenses(data);
    } catch (error) {
      console.error('Error loading recurring expenses:', error);
      setError('No se pudieron cargar los gastos recurrentes. Es posible que la tabla no exista.');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await recurringExpensesService.getRecurringStats(userId);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleCreate = async (data) => {
    try {
      console.log('Creating recurring expense with data:', data);
      await recurringExpensesService.createRecurringExpense(userId, data);
      await loadRecurringExpenses();
      await loadStats();
      setShowForm(false);
      setError(null);
    } catch (error) {
      console.error('Error creating recurring expense:', error);
      setError(`Error al crear gasto recurrente: ${error.message || 'Error desconocido'}`);
    }
  };

  const handleEdit = async (id, updates) => {
    try {
      await recurringExpensesService.updateRecurringExpense(id, updates);
      await loadRecurringExpenses();
      await loadStats();
      setEditingExpense(null);
    } catch (error) {
      console.error('Error updating recurring expense:', error);
      alert('Error al actualizar gasto recurrente');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este gasto recurrente? Los gastos ya generados no se eliminarán.')) {
      return;
    }
    try {
      await recurringExpensesService.deleteRecurringExpense(id);
      await loadRecurringExpenses();
      await loadStats();
    } catch (error) {
      console.error('Error deleting recurring expense:', error);
      alert('Error al eliminar gasto recurrente');
    }
  };

  const handleToggle = async (id, isActive) => {
    try {
      await recurringExpensesService.toggleRecurringExpense(id, !isActive);
      await loadRecurringExpenses();
      await loadStats();
    } catch (error) {
      console.error('Error toggling recurring expense:', error);
      alert('Error al cambiar estado');
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const result = await recurringExpensesService.generateRecurringExpenses(userId);
      alert(`✅ ${result.generated} gastos generados automáticamente`);
      await loadStats();
    } catch (error) {
      console.error('Error generating expenses:', error);
      alert('Error al generar gastos');
    } finally {
      setGenerating(false);
    }
  };

  const getFrequencyLabel = (frequency) => {
    const labels = {
      monthly: 'Mensual',
      weekly: 'Semanal',
      yearly: 'Anual'
    };
    return labels[frequency] || frequency;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatCurrency = (amount, currency) => {
    const symbols = { USD: '$', EUR: '€', ARS: 'AR$', BRL: 'R$' };
    return `${symbols[currency] || '$'}${amount.toFixed(2)}`;
  };

  if (loading) {
    return <div className={styles.loading}>Cargando gastos recurrentes...</div>;
  }

  return (
    <div className={styles.panel}>
      {/* Error Message */}
      {error && (
        <div className={styles.errorBanner}>
          <span className={styles.errorIcon}>⚠️</span>
          <span>{error}</span>
          <button 
            className={styles.errorClose}
            onClick={() => setError(null)}
          >
            ✕
          </button>
        </div>
      )}
      
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h2 className={styles.title}>💳 Gastos Recurrentes</h2>
          <p className={styles.subtitle}>Gastos automáticos mensuales</p>
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={handleGenerate} disabled={generating}>
            {generating ? '⏳ Generando...' : '🔄 Generar Ahora'}
          </Button>
          <Button variant="primary" onClick={() => setShowForm(true)}>
            + Nuevo Gasto Fijo
          </Button>
        </div>
      </div>

      {stats && (
        <div className={styles.statsGrid}>
          <Card variant="gradient" className={styles.statCard}>
            <div className={styles.statIcon}>💰</div>
            <div className={styles.statContent}>
              <div className={styles.statLabel}>Total Mensual</div>
              <div className={styles.statValue}>{formatCurrency(stats.totalMonthly, 'USD')}</div>
            </div>
          </Card>
          <Card variant="success" className={styles.statCard}>
            <div className={styles.statIcon}>📅</div>
            <div className={styles.statContent}>
              <div className={styles.statLabel}>Total Anual</div>
              <div className={styles.statValue}>{formatCurrency(stats.totalYearly, 'USD')}</div>
            </div>
          </Card>
          <Card variant="warning" className={styles.statCard}>
            <div className={styles.statIcon}>🔄</div>
            <div className={styles.statContent}>
              <div className={styles.statLabel}>Gastos Activos</div>
              <div className={styles.statValue}>{stats.activeCount}</div>
            </div>
          </Card>
        </div>
      )}

      {(showForm || editingExpense) && (
        <Modal
          isOpen={showForm || !!editingExpense}
          onClose={() => {
            setShowForm(false);
            setEditingExpense(null);
          }}
          title={editingExpense ? '✏️ Editar Gasto Fijo' : '➕ Nuevo Gasto Fijo'}
          size="md"
        >
          <RecurringExpenseForm
            bankAccounts={bankAccounts}
            initialData={editingExpense}
            onSubmit={(data) => {
              if (editingExpense) {
                handleEdit(editingExpense.id, data);
              } else {
                handleCreate(data);
              }
            }}
            onCancel={() => {
              setShowForm(false);
              setEditingExpense(null);
            }}
          />
        </Modal>
      )}

      <div className={styles.list}>
        {recurringExpenses.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📭</div>
            <h3>No hay gastos recurrentes</h3>
            <p>Crea tu primer gasto fijo como gym, streaming, etc.</p>
            <Button variant="primary" onClick={() => setShowForm(true)}>
              + Crear Primer Gasto
            </Button>
          </div>
        ) : (
          <div className={styles.grid}>
            {recurringExpenses.map((expense) => (
              <Card 
                key={expense.id} 
                className={`${styles.expenseCard} ${!expense.is_active ? styles.inactive : ''}`}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitle}>
                    <span className={styles.categoryIcon}>{expense.category === 'gym' ? '🏋️' : expense.category === 'sports' ? '⚽' : expense.category === 'subscriptions' ? '📺' : expense.category === 'insurance' ? '🛡️' : expense.category === 'rent' ? '🏠' : expense.category === 'utilities' ? '💡' : expense.category === 'education' ? '📚' : expense.category === 'health' ? '⚕️' : expense.category === 'transport' ? '🚗' : '📌'}</span>
                    <div>
                      <h4>{expense.name}</h4>
                      {expense.description && (
                        <p className={styles.description}>{expense.description}</p>
                      )}
                    </div>
                  </div>
                  <div className={styles.statusBadge}>
                    {expense.is_active ? (
                      <span className={styles.active}>● Activo</span>
                    ) : (
                      <span className={styles.paused}>● Pausado</span>
                    )}
                  </div>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                      <span className={styles.label}>Monto</span>
                      <span className={styles.amount}>{formatCurrency(expense.amount, expense.currency)}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.label}>Frecuencia</span>
                      <span className={styles.value}>{getFrequencyLabel(expense.frequency)}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.label}>Día del mes</span>
                      <span className={styles.value}>{expense.day_of_month}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.label}>Próxima generación</span>
                      <span className={styles.value}>{formatDate(expense.next_generation_date)}</span>
                    </div>
                  </div>

                  {(expense.start_date || expense.end_date) && (
                    <div className={styles.dates}>
                      {expense.start_date && (
                        <span>📅 Desde: {formatDate(expense.start_date)}</span>
                      )}
                      {expense.end_date && (
                        <span>🏁 Hasta: {formatDate(expense.end_date)}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className={styles.cardActions}>
                  <Button 
                    variant="ghost" 
                    onClick={() => setEditingExpense(expense)}
                    className={styles.actionButton}
                  >
                    ✏️ Editar
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleToggle(expense.id, expense.is_active)}
                    className={styles.actionButton}
                  >
                    {expense.is_active ? '⏸️ Pausar' : '▶️ Activar'}
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleDelete(expense.id)}
                    className={styles.actionButton}
                  >
                    🗑️ Eliminar
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

RecurringExpensesPanel.propTypes = {
  userId: PropTypes.string.isRequired,
  bankAccounts: PropTypes.array.isRequired,
};

export default RecurringExpensesPanel;
