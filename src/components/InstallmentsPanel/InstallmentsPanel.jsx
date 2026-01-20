/**
 * InstallmentsPanel - Panel de cuotas del mes actual
 */
import { useState, useEffect } from 'react';
import { useAuth, useExpenses } from '../../context';
import Card from '../Card';
import styles from './InstallmentsPanel.module.css';

const InstallmentsPanel = () => {
  const { user } = useAuth();
  const { expenses } = useExpenses();
  const [installmentsThisMonth, setInstallmentsThisMonth] = useState([]);

  useEffect(() => {
    if (!expenses) return;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Filtrar gastos en cuotas del mes actual
    const installments = expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return (
        expense.has_installments &&
        expenseDate.getMonth() === currentMonth &&
        expenseDate.getFullYear() === currentYear
      );
    });

    setInstallmentsThisMonth(installments);
  }, [expenses]);

  if (installmentsThisMonth.length === 0) {
    return (
      <Card className={styles.emptyPanel}>
        <div className={styles.emptyIcon}>📅</div>
        <p className={styles.emptyText}>No hay cuotas este mes</p>
      </Card>
    );
  }

  return (
    <Card className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          <span className={styles.icon}>📅</span>
          Cuotas de Este Mes
        </h3>
        <span className={styles.badge}>{installmentsThisMonth.length}</span>
      </div>

      <div className={styles.list}>
        {installmentsThisMonth.map((expense) => (
          <div 
            key={expense.id} 
            className={`${styles.item} ${expense.is_paid ? styles.paid : styles.pending}`}
          >
            <div className={styles.itemHeader}>
              <span className={styles.itemDescription}>{expense.description}</span>
              <span className={styles.itemStatus}>
                {expense.is_paid ? '✅' : '⏳'}
              </span>
            </div>
            
            <div className={styles.itemDetails}>
              <span className={styles.itemAmount}>
                {expense.currency_symbol || '$'}
                {expense.amount.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
              </span>
              
              <span className={styles.itemInstallments}>
                Cuota {expense.current_installment || 1}/{expense.total_installments || 1}
              </span>
            </div>

            <div className={styles.itemFooter}>
              <span className={styles.itemCategory}>{expense.category}</span>
              <span className={styles.itemDate}>
                {new Date(expense.date).toLocaleDateString('es-AR')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default InstallmentsPanel;
