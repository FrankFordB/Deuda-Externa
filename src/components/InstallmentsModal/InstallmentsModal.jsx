/**
 * Installments Modal - Modal detallado de cuotas
 */
import { useMemo } from 'react';
import { Modal, Button, Avatar } from '../';
import styles from './InstallmentsModal.module.css';

const InstallmentsModal = ({ isOpen, onClose, expense, siteConfig }) => {
  const currency = siteConfig?.currency || '$';

  const installmentData = useMemo(() => {
    if (!expense || !expense.installments) return null;

    const allInstallments = expense.installments || [];
    const paid = allInstallments.filter(i => i.paid);
    const pending = allInstallments.filter(i => !i.paid);
    const totalPaid = paid.reduce((sum, i) => sum + i.amount, 0);
    const totalPending = pending.reduce((sum, i) => sum + i.amount, 0);
    const totalDebt = totalPaid + totalPending;

    return {
      allInstallments,
      paid,
      pending,
      totalPaid,
      totalPending,
      totalDebt
    };
  }, [expense]);

  const formatCurrency = (value) => {
    return `${currency}${value.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  if (!installmentData) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`📋 Detalle de Cuotas`}
      size="md"
    >
      <div className={styles.modalContent}>
        {/* Información del gasto */}
        <div className={styles.expenseInfo}>
          <div className={styles.expenseHeader}>
            <h3 className={styles.expenseName}>{expense.description}</h3>
            {expense.friend && (
              <div className={styles.friendBadge}>
                <Avatar 
                  src={expense.friend.avatar_url}
                  name={expense.friend.name}
                  size="xs"
                />
                <span>Le debo a: {expense.friend.name}</span>
              </div>
            )}
          </div>
          <div className={styles.expenseCategory}>
            {expense.category_icon || '📦'} {expense.category_label || expense.category}
          </div>
        </div>

        {/* Resumen financiero */}
        <div className={styles.financialSummary}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Total de la Deuda</span>
            <span className={styles.summaryValue}>{formatCurrency(installmentData.totalDebt)}</span>
          </div>
          <div className={`${styles.summaryItem} ${styles.success}`}>
            <span className={styles.summaryLabel}>✅ Total Pagado</span>
            <span className={styles.summaryValue}>{formatCurrency(installmentData.totalPaid)}</span>
          </div>
          <div className={`${styles.summaryItem} ${styles.warning}`}>
            <span className={styles.summaryLabel}>⏳ Falta Pagar</span>
            <span className={styles.summaryValue}>{formatCurrency(installmentData.totalPending)}</span>
          </div>
        </div>

        {/* Lista de cuotas */}
        <div className={styles.installmentsList}>
          <h4 className={styles.sectionTitle}>Plan de Pagos</h4>
          
          {installmentData.allInstallments.map((installment, index) => {
            const isOverdue = new Date(installment.due_date) < new Date() && !installment.paid;
            
            return (
              <div 
                key={installment.id} 
                className={`${styles.installmentCard} ${installment.paid ? styles.paid : ''} ${isOverdue ? styles.overdue : ''}`}
              >
                <div className={styles.installmentLeft}>
                  <div className={styles.installmentNumber}>
                    Cuota {index + 1}/{installmentData.allInstallments.length}
                  </div>
                  <div className={styles.installmentDate}>
                    📅 {formatDate(installment.due_date)}
                  </div>
                  {installment.paid && installment.paid_date && (
                    <div className={styles.paidDate}>
                      Pagada el {formatDate(installment.paid_date)}
                    </div>
                  )}
                </div>
                <div className={styles.installmentRight}>
                  <div className={styles.installmentAmount}>
                    {formatCurrency(installment.amount)}
                  </div>
                  <div className={`${styles.installmentStatus} ${installment.paid ? styles.statusPaid : isOverdue ? styles.statusOverdue : styles.statusPending}`}>
                    {installment.paid ? '✅ Pagada' : isOverdue ? '⚠️ Vencida' : '⏳ Pendiente'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progreso */}
        <div className={styles.progressSection}>
          <div className={styles.progressLabel}>
            Progreso: {installmentData.paid.length} de {installmentData.allInstallments.length} cuotas pagadas
          </div>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill}
              style={{ width: `${(installmentData.paid.length / installmentData.allInstallments.length) * 100}%` }}
            />
          </div>
          <div className={styles.progressPercentage}>
            {Math.round((installmentData.paid.length / installmentData.allInstallments.length) * 100)}%
          </div>
        </div>

        <div className={styles.modalActions}>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default InstallmentsModal;
