/**
 * MonthlyStatsPanel - Panel lateral con estadísticas mensuales
 */
import { useState, useEffect, useMemo } from 'react';
import { useAuth, useExpenses, useDebts } from '../../context';
import monthlyIncomeService from '../../services/monthlyIncomeService';
import styles from './MonthlyStatsPanel.module.css';

const MonthlyStatsPanel = ({ isOpen, onClose, month, year }) => {
  const { user } = useAuth();
  const { expenses, loading: expensesLoading } = useExpenses();
  const { debtsByFriend, summary: debtsSummary, loading: debtsLoading } = useDebts();
  
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [loading, setLoading] = useState(true);

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const monthName = monthNames[month - 1];

  // Cargar ingreso mensual
  useEffect(() => {
    const loadIncome = async () => {
      if (!user) return;
      
      setLoading(true);
      const result = await monthlyIncomeService.getMonthlyIncome(user.id, year, month);
      if (!result.error && result.income) {
        setMonthlyIncome(result.income.amount);
      } else {
        setMonthlyIncome(0);
      }
      setLoading(false);
    };

    loadIncome();
  }, [user, month, year]);

  // Filtrar gastos del mes
  const monthExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const expDate = new Date(exp.date);
      return expDate.getMonth() + 1 === month && expDate.getFullYear() === year;
    });
  }, [expenses, month, year]);

  // Calcular totales
  const totalExpenses = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const paidExpenses = monthExpenses.filter(exp => exp.is_paid);
  const pendingExpenses = monthExpenses.filter(exp => !exp.is_paid);
  const totalPaid = paidExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const totalPending = pendingExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  // Gastos por categoría
  const expensesByCategory = useMemo(() => {
    const categories = {};
    monthExpenses.forEach(exp => {
      if (!categories[exp.category]) {
        categories[exp.category] = { total: 0, count: 0 };
      }
      categories[exp.category].total += exp.amount;
      categories[exp.category].count += 1;
    });
    return Object.entries(categories)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [monthExpenses]);

  // Cuotas del mes
  const installmentsExpenses = monthExpenses.filter(exp => exp.installments > 1);

  // Balance
  const balance = monthlyIncome - totalExpenses - (debtsSummary?.totalIOwe || 0);

  const formatCurrency = (value) => {
    if (value === null || value === undefined || isNaN(value)) return '$0';
    return `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className={styles.overlay} onClick={onClose} />
      
      {/* Panel */}
      <div className={styles.panel}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <h2 className={styles.title}>📊 Resumen de {monthName} {year}</h2>
            <button className={styles.closeBtn} onClick={onClose} title="Cerrar">
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {loading || expensesLoading || debtsLoading ? (
            <div className={styles.loading}>
              <div className="loading-spinner"></div>
              <span>Cargando datos...</span>
            </div>
          ) : (
            <>
              {/* Balance General */}
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>💰 Balance General</h3>
                <div className={styles.balanceGrid}>
                  <div className={styles.balanceCard}>
                    <span className={styles.balanceLabel}>Ingresos</span>
                    <span className={`${styles.balanceValue} ${styles.income}`}>
                      {formatCurrency(monthlyIncome)}
                    </span>
                  </div>
                  <div className={styles.balanceCard}>
                    <span className={styles.balanceLabel}>Gastos</span>
                    <span className={`${styles.balanceValue} ${styles.expense}`}>
                      -{formatCurrency(totalExpenses)}
                    </span>
                  </div>
                  <div className={styles.balanceCard}>
                    <span className={styles.balanceLabel}>Deudas</span>
                    <span className={`${styles.balanceValue} ${styles.expense}`}>
                      -{formatCurrency(debtsSummary?.totalIOwe || 0)}
                    </span>
                  </div>
                  <div className={`${styles.balanceCard} ${styles.balanceTotal}`}>
                    <span className={styles.balanceLabel}>Balance</span>
                    <span className={`${styles.balanceValue} ${balance >= 0 ? styles.positive : styles.negative}`}>
                      {formatCurrency(balance)}
                    </span>
                  </div>
                </div>
              </section>

              {/* Resumen de Gastos */}
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>💸 Resumen de Gastos</h3>
                <div className={styles.statsGrid}>
                  <div className={styles.statItem}>
                    <span className={styles.statIcon}>💰</span>
                    <div className={styles.statInfo}>
                      <span className={styles.statLabel}>Total</span>
                      <span className={styles.statValue}>{formatCurrency(totalExpenses)}</span>
                    </div>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statIcon}>✅</span>
                    <div className={styles.statInfo}>
                      <span className={styles.statLabel}>Pagados</span>
                      <span className={styles.statValue}>{formatCurrency(totalPaid)}</span>
                      <span className={styles.statCount}>{paidExpenses.length} gastos</span>
                    </div>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statIcon}>⏳</span>
                    <div className={styles.statInfo}>
                      <span className={styles.statLabel}>Pendientes</span>
                      <span className={styles.statValue}>{formatCurrency(totalPending)}</span>
                      <span className={styles.statCount}>{pendingExpenses.length} gastos</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Gastos por Categoría */}
              {expensesByCategory.length > 0 && (
                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>📁 Por Categoría</h3>
                  <div className={styles.categoryList}>
                    {expensesByCategory.map((cat, index) => (
                      <div key={cat.name} className={styles.categoryItem}>
                        <div className={styles.categoryHeader}>
                          <span className={styles.categoryName}>{cat.name}</span>
                          <span className={styles.categoryValue}>{formatCurrency(cat.total)}</span>
                        </div>
                        <div className={styles.categoryBar}>
                          <div 
                            className={styles.categoryBarFill}
                            style={{ width: `${(cat.total / totalExpenses) * 100}%` }}
                          />
                        </div>
                        <span className={styles.categoryCount}>{cat.count} gastos</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Gastos en Cuotas */}
              {installmentsExpenses.length > 0 && (
                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>🔄 Gastos en Cuotas</h3>
                  <div className={styles.installmentsList}>
                    {installmentsExpenses.map(exp => (
                      <div key={exp.id} className={styles.installmentItem}>
                        <div className={styles.installmentInfo}>
                          <span className={styles.installmentName}>{exp.description}</span>
                          <span className={styles.installmentMeta}>
                            Cuota {exp.current_installment}/{exp.installments}
                          </span>
                        </div>
                        <div className={styles.installmentAmount}>
                          {formatCurrency(exp.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Deudas Activas */}
              {debtsByFriend && debtsByFriend.length > 0 && (
                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>💳 Deudas Activas</h3>
                  <div className={styles.debtsList}>
                    {debtsByFriend.slice(0, 5).map(debt => (
                      <div key={debt.id} className={styles.debtItem}>
                        <div className={styles.debtInfo}>
                          <span className={styles.debtName}>{debt.friendName}</span>
                          <span className={styles.debtStatus}>
                            {debt.status === 'active' ? '⏳ Activa' : '✅ Pagada'}
                          </span>
                        </div>
                        <div className={styles.debtAmount}>
                          {formatCurrency(debt.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Lista de Todos los Gastos */}
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>📋 Todos los Gastos ({monthExpenses.length})</h3>
                <div className={styles.expensesList}>
                  {monthExpenses.map(exp => (
                    <div key={exp.id} className={styles.expenseItem}>
                      <div className={styles.expenseInfo}>
                        <span className={styles.expenseName}>{exp.description}</span>
                        <span className={styles.expenseDate}>
                          {new Date(exp.date).toLocaleDateString('es-AR')}
                        </span>
                      </div>
                      <div className={styles.expenseDetails}>
                        <span className={styles.expenseAmount}>{formatCurrency(exp.amount)}</span>
                        <span className={`${styles.expenseStatus} ${exp.is_paid ? styles.paid : styles.pending}`}>
                          {exp.is_paid ? '✓' : '⏳'}
                        </span>
                      </div>
                    </div>
                  ))}
                  {monthExpenses.length === 0 && (
                    <div className={styles.emptyState}>
                      <span className={styles.emptyIcon}>📭</span>
                      <span className={styles.emptyText}>No hay gastos en este mes</span>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default MonthlyStatsPanel;
