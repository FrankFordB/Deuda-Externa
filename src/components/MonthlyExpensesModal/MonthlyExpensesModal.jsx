/**
 * Monthly Expenses Modal - Modal con detalles de gastos del mes
 */
import { useMemo, useState } from 'react';
import { Modal, Button, ExpenseEditModal } from '../';
import styles from './MonthlyExpensesModal.module.css';

const MonthlyExpensesModal = ({ isOpen, onClose, monthData, allExpenses, friends, virtualFriends, siteConfig }) => {
  const currency = siteConfig?.currency || '$';
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const handleExpenseClick = (expense) => {
    setSelectedExpense(expense);
    setShowEditModal(true);
  };

  const handleEditSuccess = () => {
    // Recargar gastos si es necesario
    setShowEditModal(false);
    setSelectedExpense(null);
  };

  const monthExpenses = useMemo(() => {
    if (!monthData || !allExpenses) return [];
    
    // Filtrar gastos del mes
    return allExpenses.filter(exp => {
      const expDate = new Date(exp.date);
      return expDate.getMonth() === monthData.monthNumber && 
             expDate.getFullYear() === monthData.year;
    });
  }, [monthData, allExpenses]);

  const expensesByFriend = useMemo(() => {
    const byFriend = {};
    
    monthExpenses.forEach(exp => {
      if (exp.friend_id) {
        if (!byFriend[exp.friend_id]) {
          byFriend[exp.friend_id] = {
            friend: exp.friend,
            expenses: [],
            total: 0
          };
        }
        byFriend[exp.friend_id].expenses.push(exp);
        byFriend[exp.friend_id].total += exp.amount;
      }
    });
    
    return Object.values(byFriend);
  }, [monthExpenses]);

  const stats = useMemo(() => {
    const paid = monthExpenses.filter(e => e.is_paid);
    const pending = monthExpenses.filter(e => !e.is_paid);
    
    return {
      totalEarned: paid.reduce((sum, e) => sum + e.amount, 0),
      totalPending: pending.reduce((sum, e) => sum + e.amount, 0),
      totalExpenses: monthExpenses.reduce((sum, e) => sum + e.amount, 0),
      paidCount: paid.length,
      pendingCount: pending.length
    };
  }, [monthExpenses]);

  const formatCurrency = (value) => {
    return `${currency}${value.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short'
    });
  };

  if (!monthData) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`📊 Gastos de ${monthData.monthName} ${monthData.year}`}
      size="lg"
    >
      <div className={styles.modalContent}>
        {/* Resumen */}
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryIcon}>💰</div>
            <div className={styles.summaryInfo}>
              <span className={styles.summaryLabel}>Total del Mes</span>
              <span className={styles.summaryValue}>{formatCurrency(stats.totalExpenses)}</span>
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div className={`${styles.summaryIcon} ${styles.success}`}>✅</div>
            <div className={styles.summaryInfo}>
              <span className={styles.summaryLabel}>Pagado ({stats.paidCount})</span>
              <span className={`${styles.summaryValue} ${styles.success}`}>{formatCurrency(stats.totalEarned)}</span>
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div className={`${styles.summaryIcon} ${styles.warning}`}>⏳</div>
            <div className={styles.summaryInfo}>
              <span className={styles.summaryLabel}>Pendiente ({stats.pendingCount})</span>
              <span className={`${styles.summaryValue} ${styles.warning}`}>{formatCurrency(stats.totalPending)}</span>
            </div>
          </div>
        </div>

        {/* Gastos por amigo */}
        {expensesByFriend.length > 0 && (
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>👥 Gastos por Amigo</h4>
            <div className={styles.friendsList}>
              {expensesByFriend.map((item) => (
                <div key={item.friend.id} className={styles.friendCard}>
                  <div className={styles.friendHeader}>
                    {item.friend.avatar_url && (
                      <img src={item.friend.avatar_url} alt={item.friend.name} className={styles.friendAvatar} />
                    )}
                    <div className={styles.friendInfo}>
                      <span className={styles.friendName}>{item.friend.name}</span>
                      <span className={styles.friendExpenseCount}>{item.expenses.length} gastos</span>
                    </div>
                    <span className={styles.friendTotal}>{formatCurrency(item.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lista completa de gastos */}
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>📋 Todos los Gastos</h4>
          <div className={styles.expensesList}>
            {monthExpenses.length > 0 ? (
              monthExpenses.map((exp) => (
                <div 
                  key={exp.id} 
                  className={styles.expenseItem}
                  onClick={() => handleExpenseClick(exp)}
                  role="button"
                  tabIndex={0}
                >
                  <div className={styles.expenseLeft}>
                    <div className={styles.expenseIcon}>
                      {exp.category_icon || '📦'}
                    </div>
                    <div className={styles.expenseInfo}>
                      <div className={styles.expenseName}>{exp.description}</div>
                      <div className={styles.expenseMeta}>
                        <span>{formatDate(exp.date)}</span>
                        <span>•</span>
                        <span>{exp.category_label || exp.category}</span>
                        {exp.friend && (
                          <>
                            <span>•</span>
                            <span>👤 {exp.friend.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={styles.expenseRight}>
                    <div className={styles.expenseAmount}>{formatCurrency(exp.amount)}</div>
                    <div className={`${styles.expenseStatus} ${exp.is_paid ? styles.paid : styles.pending}`}>
                      {exp.is_paid ? '✅ Pagado' : '⏳ Pendiente'}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📭</div>
                <p>No hay gastos registrados para este mes</p>
              </div>
            )}
          </div>
        </div>

        <div className={styles.modalActions}>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>

      {/* Modal de edición */}
      {selectedExpense && (
        <ExpenseEditModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedExpense(null);
          }}
          expense={selectedExpense}
          onSuccess={handleEditSuccess}
        />
      )}
    </Modal>
  );
};

export default MonthlyExpensesModal;
