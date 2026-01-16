/**
 * Installments Page - Seguimiento de cuotas
 */
import { useMemo } from 'react';
import { useExpenses, useUI } from '../../context';
import { Card, Loading, EmptyState } from '../../components';
import styles from './Installments.module.css';

const Installments = () => {
  const { expenses, loading, markInstallmentPaid } = useExpenses();
  const { showSuccess, showError, siteConfig } = useUI();

  const currency = siteConfig?.currency || '$';

  // Obtener gastos con cuotas
  const installmentExpenses = useMemo(() => {
    return expenses.filter(exp => exp.is_installment && exp.installments?.length > 0);
  }, [expenses]);

  // Agrupar cuotas por estado
  const groupedInstallments = useMemo(() => {
    const pending = [];
    const upcoming = [];
    const paid = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    installmentExpenses.forEach(expense => {
      expense.installments.forEach((inst, index) => {
        const installmentData = {
          ...inst,
          expense,
          installmentNumber: inst.installment_number || index + 1
        };

        if (inst.paid) {
          paid.push(installmentData);
        } else {
          const dueDate = new Date(inst.due_date);
          dueDate.setHours(0, 0, 0, 0);
          
          const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
          
          if (diffDays < 0) {
            // Vencida
            pending.push({ ...installmentData, overdue: true, daysDiff: Math.abs(diffDays) });
          } else if (diffDays <= 7) {
            // Próxima semana
            pending.push({ ...installmentData, overdue: false, daysDiff: diffDays });
          } else {
            upcoming.push({ ...installmentData, daysDiff: diffDays });
          }
        }
      });
    });

    // Ordenar por fecha
    pending.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    upcoming.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    paid.sort((a, b) => new Date(b.paid_at || b.due_date) - new Date(a.paid_at || a.due_date));

    return { pending, upcoming, paid };
  }, [installmentExpenses]);

  // Resumen
  const summary = useMemo(() => {
    const totalPending = groupedInstallments.pending.reduce((sum, i) => sum + i.amount, 0);
    const totalUpcoming = groupedInstallments.upcoming.reduce((sum, i) => sum + i.amount, 0);
    const totalPaid = groupedInstallments.paid.reduce((sum, i) => sum + i.amount, 0);
    const overdue = groupedInstallments.pending.filter(i => i.overdue).length;

    return { totalPending, totalUpcoming, totalPaid, overdue };
  }, [groupedInstallments]);

  const handleMarkPaid = async (installmentId) => {
    const result = await markInstallmentPaid(installmentId);
    if (result.success) {
      showSuccess('Cuota marcada como pagada');
    } else {
      showError('Error al marcar la cuota');
    }
  };

  const formatCurrency = (value) => {
    return `${currency}${value.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return <Loading size="lg" text="Cargando cuotas..." />;
  }

  return (
    <div className={styles.installments}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>Cuotas</h2>
          <p className={styles.subtitle}>Seguimiento de pagos en cuotas</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className={styles.summaryGrid}>
        <Card className={`${styles.summaryCard} ${summary.overdue > 0 ? styles.danger : ''}`}>
          <div className={styles.summaryIcon}>⚠️</div>
          <div className={styles.summaryContent}>
            <span className={styles.summaryLabel}>Vencidas / Próximas</span>
            <span className={styles.summaryValue}>
              {groupedInstallments.pending.length} cuotas
            </span>
            <span className={styles.summarySubtext}>{formatCurrency(summary.totalPending)}</span>
          </div>
        </Card>
        <Card className={styles.summaryCard}>
          <div className={styles.summaryIcon}>📅</div>
          <div className={styles.summaryContent}>
            <span className={styles.summaryLabel}>Próximos Meses</span>
            <span className={styles.summaryValue}>
              {groupedInstallments.upcoming.length} cuotas
            </span>
            <span className={styles.summarySubtext}>{formatCurrency(summary.totalUpcoming)}</span>
          </div>
        </Card>
        <Card className={styles.summaryCard}>
          <div className={styles.summaryIcon}>✅</div>
          <div className={styles.summaryContent}>
            <span className={styles.summaryLabel}>Pagadas</span>
            <span className={styles.summaryValue}>
              {groupedInstallments.paid.length} cuotas
            </span>
            <span className={styles.summarySubtext}>{formatCurrency(summary.totalPaid)}</span>
          </div>
        </Card>
      </div>

      {installmentExpenses.length === 0 ? (
        <Card>
          <EmptyState
            icon="📆"
            title="Sin cuotas"
            description="No tienes gastos en cuotas. Crea un gasto con opción de cuotas desde la página de gastos."
          />
        </Card>
      ) : (
        <>
          {/* Cuotas pendientes / vencidas */}
          {groupedInstallments.pending.length > 0 && (
            <Card>
              <h3 className={styles.sectionTitle}>
                🔔 Atención Inmediata ({groupedInstallments.pending.length})
              </h3>
              <div className={styles.installmentList}>
                {groupedInstallments.pending.map((inst) => (
                  <div 
                    key={inst.id} 
                    className={`${styles.installmentItem} ${inst.overdue ? styles.overdue : styles.soon}`}
                  >
                    <div className={styles.installmentInfo}>
                      <div className={styles.installmentExpense}>
                        {inst.expense.description}
                      </div>
                      <div className={styles.installmentMeta}>
                        <span>Cuota {inst.installmentNumber} de {inst.expense.total_installments}</span>
                        <span>•</span>
                        <span className={inst.overdue ? styles.overdueBadge : styles.soonBadge}>
                          {inst.overdue 
                            ? `Vencida hace ${inst.daysDiff} día${inst.daysDiff !== 1 ? 's' : ''}`
                            : inst.daysDiff === 0 
                              ? 'Vence hoy'
                              : `Vence en ${inst.daysDiff} día${inst.daysDiff !== 1 ? 's' : ''}`
                          }
                        </span>
                      </div>
                      <div className={styles.installmentDate}>
                        📅 {formatDate(inst.due_date)}
                      </div>
                    </div>
                    <div className={styles.installmentActions}>
                      <span className={styles.installmentAmount}>
                        {formatCurrency(inst.amount)}
                      </span>
                      <button 
                        className={styles.payButton}
                        onClick={() => handleMarkPaid(inst.id)}
                      >
                        ✓ Marcar Pagada
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Próximas cuotas */}
          {groupedInstallments.upcoming.length > 0 && (
            <Card>
              <h3 className={styles.sectionTitle}>
                📅 Próximas Cuotas ({groupedInstallments.upcoming.length})
              </h3>
              <div className={styles.installmentList}>
                {groupedInstallments.upcoming.slice(0, 10).map((inst) => (
                  <div key={inst.id} className={styles.installmentItem}>
                    <div className={styles.installmentInfo}>
                      <div className={styles.installmentExpense}>
                        {inst.expense.description}
                      </div>
                      <div className={styles.installmentMeta}>
                        <span>Cuota {inst.installmentNumber} de {inst.expense.total_installments}</span>
                        <span>•</span>
                        <span className={styles.daysAway}>
                          En {inst.daysDiff} día{inst.daysDiff !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className={styles.installmentDate}>
                        📅 {formatDate(inst.due_date)}
                      </div>
                    </div>
                    <div className={styles.installmentActions}>
                      <span className={styles.installmentAmount}>
                        {formatCurrency(inst.amount)}
                      </span>
                      <button 
                        className={styles.payButton}
                        onClick={() => handleMarkPaid(inst.id)}
                      >
                        ✓ Pagar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {groupedInstallments.upcoming.length > 10 && (
                <div className={styles.showMore}>
                  +{groupedInstallments.upcoming.length - 10} cuotas más
                </div>
              )}
            </Card>
          )}

          {/* Cuotas pagadas */}
          {groupedInstallments.paid.length > 0 && (
            <Card>
              <h3 className={styles.sectionTitle}>
                ✅ Historial de Pagos ({groupedInstallments.paid.length})
              </h3>
              <div className={styles.installmentList}>
                {groupedInstallments.paid.slice(0, 5).map((inst) => (
                  <div key={inst.id} className={`${styles.installmentItem} ${styles.paid}`}>
                    <div className={styles.installmentInfo}>
                      <div className={styles.installmentExpense}>
                        {inst.expense.description}
                      </div>
                      <div className={styles.installmentMeta}>
                        <span>Cuota {inst.installmentNumber} de {inst.expense.total_installments}</span>
                        <span>•</span>
                        <span className={styles.paidBadge}>Pagada</span>
                      </div>
                    </div>
                    <div className={styles.installmentActions}>
                      <span className={styles.installmentAmount}>
                        {formatCurrency(inst.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default Installments;
