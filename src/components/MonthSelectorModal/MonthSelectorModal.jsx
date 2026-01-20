/**
 * MonthSelectorModal - Modal con selector de mes para ver gastos
 */
import { useState, useMemo } from 'react';
import { useExpenses } from '../../context';
import Modal from '../Modal';
import Select from '../Select';
import styles from './MonthSelectorModal.module.css';

const MonthSelectorModal = ({ isOpen, onClose }) => {
  const { expenses } = useExpenses();
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Filtrar gastos por mes y año seleccionado
  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];

    return expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return (
        expenseDate.getMonth() + 1 === parseInt(selectedMonth) &&
        expenseDate.getFullYear() === parseInt(selectedYear)
      );
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [expenses, selectedMonth, selectedYear]);

  // Calcular estadísticas del mes
  const stats = useMemo(() => {
    const total = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const paid = filteredExpenses.filter(exp => exp.is_paid).reduce((sum, exp) => sum + exp.amount, 0);
    const pending = filteredExpenses.filter(exp => !exp.is_paid).reduce((sum, exp) => sum + exp.amount, 0);

    return { total, paid, pending, count: filteredExpenses.length };
  }, [filteredExpenses]);

  // Generar años disponibles (últimos 3 años + año actual + próximo año)
  const availableYears = Array.from(
    { length: 5 },
    (_, i) => currentDate.getFullYear() - 2 + i
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Gastos por Mes"
      size="lg"
    >
      <div className={styles.container}>
        {/* Selectores de mes y año */}
        <div className={styles.filters}>
          <Select
            label="Mes"
            value={String(selectedMonth)}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className={styles.select}
          >
            {MONTHS.map((month, index) => (
              <option key={index + 1} value={index + 1}>
                {month}
              </option>
            ))}
          </Select>

          <Select
            label="Año"
            value={String(selectedYear)}
            onChange={(e) => setSelectedYear(e.target.value)}
            className={styles.select}
          >
            {availableYears.map(year => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </Select>
        </div>

        {/* Estadísticas del mes */}
        <div className={styles.stats}>
          <div className={styles.statCard}>
            <span className={styles.statIcon}>💰</span>
            <div className={styles.statContent}>
              <span className={styles.statLabel}>Total</span>
              <span className={styles.statValue}>
                ${stats.total.toLocaleString('es-AR')}
              </span>
            </div>
          </div>

          <div className={styles.statCard}>
            <span className={styles.statIcon}>✅</span>
            <div className={styles.statContent}>
              <span className={styles.statLabel}>Pagados</span>
              <span className={`${styles.statValue} ${styles.paid}`}>
                ${stats.paid.toLocaleString('es-AR')}
              </span>
            </div>
          </div>

          <div className={styles.statCard}>
            <span className={styles.statIcon}>⏳</span>
            <div className={styles.statContent}>
              <span className={styles.statLabel}>Pendientes</span>
              <span className={`${styles.statValue} ${styles.pending}`}>
                ${stats.pending.toLocaleString('es-AR')}
              </span>
            </div>
          </div>

          <div className={styles.statCard}>
            <span className={styles.statIcon}>📊</span>
            <div className={styles.statContent}>
              <span className={styles.statLabel}>Cantidad</span>
              <span className={styles.statValue}>{stats.count}</span>
            </div>
          </div>
        </div>

        {/* Lista de gastos */}
        <div className={styles.expensesList}>
          {filteredExpenses.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>📭</span>
              <p className={styles.emptyText}>
                No hay gastos en {MONTHS[selectedMonth - 1]} {selectedYear}
              </p>
            </div>
          ) : (
            filteredExpenses.map((expense) => (
              <div
                key={expense.id}
                className={`${styles.expenseItem} ${expense.is_paid ? styles.expensePaid : styles.expensePending}`}
              >
                <div className={styles.expenseHeader}>
                  <span className={styles.expenseDescription}>
                    {expense.description}
                  </span>
                  <span className={styles.expenseStatus}>
                    {expense.is_paid ? '✅ Pagado' : '⏳ Pendiente'}
                  </span>
                </div>

                <div className={styles.expenseDetails}>
                  <span className={styles.expenseAmount}>
                    {expense.currency_symbol || '$'}
                    {expense.amount.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                  </span>
                  <span className={styles.expenseCategory}>{expense.category}</span>
                </div>

                <div className={styles.expenseFooter}>
                  <span className={styles.expenseDate}>
                    {new Date(expense.date).toLocaleDateString('es-AR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                  {expense.has_installments && (
                    <span className={styles.expenseInstallments}>
                      📅 {expense.current_installment}/{expense.total_installments} cuotas
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
};

export default MonthSelectorModal;
