/**
 * AccountDetail - Vista detallada de una cuenta bancaria con filtro de mes
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, useUI } from '../../context';
import { bankAccountsService } from '../../services';
import { deleteExpense } from '../../services/expensesService';
import { supabase } from '../../services/supabase';
import { Card, Button, Select, StatCard, Loading, EmptyState, EditAccountModal, Modal, CURRENCIES } from '../../components';
import styles from './AccountDetail.module.css';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const AccountDetail = () => {
  const { accountId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { showError, showSuccess } = useUI();
  
  const [account, setAccount] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [debts, setDebts] = useState([]);
  const [debtsOwed, setDebtsOwed] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState('expenses'); // 'expenses' | 'debts' | 'owed'
  
  // Modales de confirmación
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [debtToMarkPaid, setDebtToMarkPaid] = useState(null);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [debtToCollect, setDebtToCollect] = useState(null);
  const [collecting, setCollecting] = useState(false);
  
  // Modal para borrar gasto
  const [showDeleteExpenseModal, setShowDeleteExpenseModal] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [deletingExpense, setDeletingExpense] = useState(false);
  
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);

  const loadAccountData = useCallback(async () => {
    setLoading(true);
    
    // Cargar cuenta
    const { account: accountData, error: accountError } = await bankAccountsService.getAccount(accountId);
    if (accountError) {
      showError('Error cargando cuenta');
      navigate('/dashboard');
      return;
    }
    setAccount(accountData);

    // Cargar gastos del mes
    const { expenses: expensesData } = await bankAccountsService.getAccountExpenses(
      accountId, 
      selectedYear, 
      selectedMonth
    );
    setExpenses(expensesData || []);

    // Cargar deudas asociadas a esta cuenta (yo debo)
    const { data: debtsData } = await supabase
      .from('debts')
      .select(`
        *,
        creditor:creditor_id(id, first_name, last_name, nickname),
        virtual_friend:virtual_friends(id, name)
      `)
      .eq('bank_account_id', accountId)
      .eq('debtor_id', user.id)
      .order('created_at', { ascending: false });
    
    setDebts(debtsData || []);

    // Cargar deudas donde me deben (opcional, si quieres mostrarlas)
    const { data: debtsOwedData } = await supabase
      .from('debts')
      .select(`
        *,
        debtor:debtor_id(id, first_name, last_name, nickname),
        virtual_friend:virtual_friends(id, name)
      `)
      .eq('creditor_id', user.id)
      .eq('currency', accountData.currency)
      .order('created_at', { ascending: false });
    
    setDebtsOwed(debtsOwedData || []);

    // Cargar estadísticas
    const { stats: statsData } = await bankAccountsService.getAccountStats(
      accountId, 
      selectedYear, 
      selectedMonth
    );
    setStats(statsData);
    
    setLoading(false);
  }, [accountId, selectedYear, selectedMonth, showError, navigate, user]);

  useEffect(() => {
    loadAccountData();
  }, [loadAccountData]);

  // Suscripción en tiempo real para actualizar cuando cambie la cuenta o sus gastos
  useEffect(() => {
    if (!user || !accountId) return;

    // Suscribirse a cambios en la cuenta
    const accountSubscription = supabase
      .channel(`account_${accountId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bank_accounts',
          filter: `id=eq.${accountId}`
        },
        (payload) => {
          console.log('🏦 Cambio en cuenta:', payload);
          loadAccountData();
        }
      )
      .subscribe();

    // Suscribirse a cambios en gastos de esta cuenta
    const expensesSubscription = supabase
      .channel(`expenses_account_${accountId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expenses',
          filter: `bank_account_id=eq.${accountId}`
        },
        (payload) => {
          console.log('💸 Cambio en gasto de cuenta:', payload);
          loadAccountData();
        }
      )
      .subscribe();

    // Cleanup
    return () => {
      accountSubscription.unsubscribe();
      expensesSubscription.unsubscribe();
    };
  }, [user, accountId, loadAccountData]);

  const handleSaveAccount = async (updates) => {
    const result = await bankAccountsService.updateAccount(accountId, updates);
    if (result.error) {
      showError('Error actualizando cuenta');
      return;
    }
    showSuccess('Cuenta actualizada correctamente');
    loadAccountData(); // Recargar datos
  };

  const handleDeleteAccount = async () => {
    const result = await bankAccountsService.deleteAccount(accountId);
    if (result.error) {
      showError('Error eliminando cuenta');
      return;
    }
    showSuccess('Cuenta eliminada correctamente');
    navigate('/dashboard');
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { label: '⏳ Pendiente', class: 'pending' },
      accepted: { label: '✅ Aceptada', class: 'accepted' },
      paid: { label: '💚 Pagada', class: 'paid' },
      rejected: { label: '❌ Rechazada', class: 'rejected' }
    };
    return badges[status] || badges.pending;
  };

  const getDaysUntilDue = (dueDate) => {
    if (!dueDate) return null;
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Cobrar/Recordar pago
  const handleCollect = (debt) => {
    setDebtToCollect(debt);
    setShowCollectModal(true);
  };

  const confirmCollect = async () => {
    if (!debtToCollect || collecting) return;
    
    setCollecting(true);
    
    try {
      const { createNotification } = await import('../../services/notificationsService');
      
      const result = await createNotification({
        userId: debtToCollect.debtor_id,
        type: 'payment_reminder',
        title: '💰 Recordatorio de Pago',
        message: `Te recuerdan la deuda pendiente: "${debtToCollect.description}" por ${debtToCollect.currency_symbol}${debtToCollect.amount.toLocaleString('es-AR')}`,
        data: {
          debt_id: debtToCollect.id,
          amount: debtToCollect.amount,
          currency: debtToCollect.currency,
          description: debtToCollect.description
        },
        actionRequired: false
      });

      if (!result.error) {
        showSuccess('Recordatorio enviado correctamente');
        setShowCollectModal(false);
        setDebtToCollect(null);
      } else {
        showError('Error al enviar recordatorio');
      }
    } catch (error) {
      showError('Error al enviar recordatorio');
    } finally {
      setCollecting(false);
    }
  };

  // Borrar gasto
  const handleDeleteExpense = (expense) => {
    setExpenseToDelete(expense);
    setShowDeleteExpenseModal(true);
  };

  const confirmDeleteExpense = async () => {
    if (!expenseToDelete || deletingExpense) return;
    
    setDeletingExpense(true);
    
    try {
      const result = await deleteExpense(expenseToDelete.id);
      
      if (!result.error) {
        showSuccess('Gasto eliminado correctamente');
        setShowDeleteExpenseModal(false);
        setExpenseToDelete(null);
        loadAccountData(); // Recargar datos
      } else {
        showError('Error al eliminar gasto: ' + result.error);
      }
    } catch (error) {
      showError('Error al eliminar gasto');
    } finally {
      setDeletingExpense(false);
    }
  };

  if (loading || !account) {
    return <Loading />;
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <Button 
          variant="ghost" 
          onClick={() => navigate('/dashboard')}
          icon="←"
        >
          Volver
        </Button>
        
        <div className={styles.accountInfo}>
          <h1 className={styles.accountName}>
            {location.state?.currency && CURRENCIES.find(c => c.value === location.state.currency)?.label.split(' ')[2]} {account.name}
          </h1>
          <p className={styles.accountBalance}>
            Balance: <span className={account.current_balance >= 0 ? styles.positive : styles.negative}>
              {account.currency_symbol}{account.current_balance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
          </p>
        </div>

        <Button
          onClick={() => setShowEditModal(true)}
          icon="✏️"
        >
          Editar
        </Button>
      </div>

      {/* Filtros de fecha */}
      <Card className={styles.filtersCard}>
        <div className={styles.filters}>
          <Select
            label="Mes"
            value={String(selectedMonth)}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
          >
            {MONTHS.map((month, index) => (
              <option key={index} value={index + 1}>{month}</option>
            ))}
          </Select>

          <Select
            label="Año"
            value={String(selectedYear)}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          >
            {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i).map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </Select>
        </div>
      </Card>

      {/* Estadísticas del mes */}
      {stats && (
        <>
          <h2 className={styles.sectionTitle}>💰 Balance General</h2>
          <div className={styles.statsGrid}>
            <StatCard
              icon="💵"
              label="Balance Actual"
              value={`${stats.currencySymbol}${stats.currentBalance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
              variant={stats.currentBalance >= 0 ? 'success' : 'danger'}
            />
            <StatCard
              icon="🏦"
              label="Balance Inicial"
              value={`${stats.currencySymbol}${stats.initialBalance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
              variant="default"
            />
            <StatCard
              icon="💸"
              label="Total Gastado (mes)"
              value={`${stats.currencySymbol}${stats.totalExpenses.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
              variant="warning"
            />
            <StatCard
              icon="💳"
              label="Deudas (todas)"
              value={`${stats.currencySymbol}${stats.totalDebtsAll.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
              variant="danger"
            />
          </div>

          <h2 className={styles.sectionTitle}>📊 Estadísticas de {MONTHS[selectedMonth - 1]} {selectedYear}</h2>
          <div className={styles.statsGrid}>
            <StatCard
              icon="✅"
              label="Gastos Pagados"
              value={`${stats.currencySymbol}${stats.paidExpenses.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
              variant="success"
            />
            <StatCard
              icon="⏳"
              label="Gastos Pendientes"
              value={`${stats.currencySymbol}${stats.pendingExpenses.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
              variant="info"
            />
            <StatCard
              icon="💳"
              label="Deudas del Mes"
              value={`${stats.currencySymbol}${stats.totalDebtsMonth.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
              variant="warning"
            />
            <StatCard
              icon="📋"
              label="Cantidad"
              value={`${stats.expenseCount} gastos + ${stats.debtCountMonth} deudas`}
              variant="default"
            />
          </div>
        </>
      )}

      {/* Lista de gastos */}
      <Card>
        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'expenses' ? styles.active : ''}`}
            onClick={() => setActiveTab('expenses')}
          >
            💸 Gastos Personales ({expenses.length})
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'debts' ? styles.active : ''}`}
            onClick={() => setActiveTab('debts')}
          >
            💳 Yo Debo ({debts.filter(d => d.status !== 'paid' && d.status !== 'rejected').length})
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'owed' ? styles.active : ''}`}
            onClick={() => setActiveTab('owed')}
          >
            💰 Me Deben ({debtsOwed.filter(d => d.status !== 'paid' && d.status !== 'rejected').length})
          </button>
        </div>

        {/* Contenido de Gastos Personales */}
        {activeTab === 'expenses' && (
          <div className={styles.tabContent}>
            {expenses.length === 0 ? (
              <EmptyState
                icon="📭"
                title="Sin gastos"
                description={`No hay gastos personales registrados en ${MONTHS[selectedMonth - 1]}`}
              />
            ) : (
              <div className={styles.itemsList}>
                {expenses.map(expense => (
                  <div key={expense.id} className={styles.item}>
                    <div className={styles.itemLeft}>
                      <span className={styles.itemIcon}>
                        {expense.category || '📦'}
                      </span>
                      <div>
                        <div className={styles.itemTitle}>{expense.description}</div>
                        <div className={styles.itemMeta}>
                          📅 {formatDate(expense.date)}
                          {expense.payment_method && ` • ${expense.payment_method}`}
                        </div>
                      </div>
                    </div>
                    <div className={styles.itemRight}>
                      <div className={styles.itemAmount}>
                        {account.currency_symbol}{expense.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </div>
                      <div className={styles.itemActions}>
                        <span className={`${styles.statusBadge} ${expense.is_paid ? styles.paid : styles.pending}`}>
                          {expense.is_paid ? '✅ Pagado' : '⏳ Pendiente'}
                        </span>
                        <button 
                          className={styles.deleteBtn}
                          onClick={() => handleDeleteExpense(expense)}
                          title="Eliminar gasto"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Contenido de Yo Debo */}
        {activeTab === 'debts' && (
          <div className={styles.tabContent}>
            {debts.length === 0 ? (
              <EmptyState
                icon="✅"
                title="Sin deudas"
                description="No tienes deudas asociadas a esta cuenta"
              />
            ) : (
              <div className={styles.itemsList}>
                {debts.map(debt => {
                  const status = getStatusBadge(debt.status);
                  const daysUntil = getDaysUntilDue(debt.due_date);
                  const overdue = debt.due_date && isOverdue(debt.due_date) && debt.status !== 'paid';
                  const creditorName = debt.virtual_friend 
                    ? debt.virtual_friend.name 
                    : `${debt.creditor?.first_name || ''} ${debt.creditor?.last_name || ''}`.trim();

                  return (
                    <div key={debt.id} className={`${styles.item} ${overdue ? styles.overdue : ''}`}>
                      <div className={styles.itemLeft}>
                        <span className={styles.itemIcon}>
                          {debt.virtual_friend ? '📇' : '👤'}
                        </span>
                        <div>
                          <div className={styles.itemTitle}>
                            Le debo a {creditorName || 'Desconocido'}
                          </div>
                          <div className={styles.itemDesc}>{debt.description}</div>
                          <div className={styles.itemMeta}>
                            {debt.installments > 1 && (
                              <span className={styles.badge}>🔄 {debt.installments} cuotas</span>
                            )}
                            {debt.due_date && (
                              <span className={`${styles.badge} ${overdue ? styles.badgeOverdue : ''}`}>
                                {overdue ? '⚠️ Vencida' : daysUntil === 0 ? '⚡ Vence hoy' : daysUntil > 0 ? `📅 ${daysUntil} días` : `📅 ${formatDate(debt.due_date)}`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className={styles.itemRight}>
                        <div className={styles.itemAmount}>
                          {debt.currency_symbol}{debt.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </div>
                        <span className={`${styles.statusBadge} ${styles[status.class]}`}>
                          {status.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Contenido de Me Deben */}
        {activeTab === 'owed' && (
          <div className={styles.tabContent}>
            {debtsOwed.length === 0 ? (
              <EmptyState
                icon="💰"
                title="Nadie te debe"
                description="No tienes deudas a cobrar en esta moneda"
              />
            ) : (
              <div className={styles.itemsList}>
                {debtsOwed.map(debt => {
                  const status = getStatusBadge(debt.status);
                  const daysUntil = getDaysUntilDue(debt.due_date);
                  const overdue = debt.due_date && isOverdue(debt.due_date) && debt.status !== 'paid';
                  const debtorName = debt.virtual_friend 
                    ? debt.virtual_friend.name 
                    : `${debt.debtor?.first_name || ''} ${debt.debtor?.last_name || ''}`.trim();

                  return (
                    <div key={debt.id} className={`${styles.item} ${overdue ? styles.overdue : ''}`}>
                      <div className={styles.itemLeft}>
                        <span className={styles.itemIcon}>
                          {debt.virtual_friend ? '📇' : '👤'}
                        </span>
                        <div>
                          <div className={styles.itemTitle}>
                            {debtorName || 'Desconocido'} me debe
                          </div>
                          <div className={styles.itemDesc}>{debt.description}</div>
                          <div className={styles.itemMeta}>
                            {debt.installments > 1 && (
                              <span className={styles.badge}>🔄 {debt.installments} cuotas</span>
                            )}
                            {debt.due_date && (
                              <span className={`${styles.badge} ${overdue ? styles.badgeOverdue : ''}`}>
                                {overdue ? '⚠️ Cobrar' : daysUntil === 0 ? '⚡ Vence hoy' : daysUntil > 0 ? `📅 ${daysUntil} días` : `📅 ${formatDate(debt.due_date)}`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className={styles.itemRight}>
                        <div className={styles.itemAmount}>
                          {debt.currency_symbol}{debt.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </div>
                        <span className={`${styles.statusBadge} ${styles[status.class]}`}>
                          {status.label}
                        </span>
                        {debt.status === 'accepted' && (
                          <div className={styles.itemActions}>
                            {!debt.virtual_friend_id && (
                              <Button 
                                size="sm" 
                                variant="info"
                                onClick={() => handleCollect(debt)}
                              >
                                💰 Cobrar
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Modal Cobrar/Recordar */}
      <Modal
        show={showCollectModal}
        onClose={() => setShowCollectModal(false)}
        title="💰 Enviar Recordatorio de Pago"
      >
        <div className={styles.confirmModal}>
          {debtToCollect && (
            <>
              <p className={styles.confirmText}>
                ¿Enviar un recordatorio para que paguen esta deuda?
              </p>
              <div className={styles.debtInfo}>
                <div className={styles.debtInfoItem}>
                  <span className={styles.label}>👤 Deudor:</span>
                  <span className={styles.value}>
                    {debtToCollect.debtor?.first_name} {debtToCollect.debtor?.last_name}
                  </span>
                </div>
                <div className={styles.debtInfoItem}>
                  <span className={styles.label}>💳 Deuda:</span>
                  <span className={styles.value}>{debtToCollect.description}</span>
                </div>
                <div className={styles.debtInfoItem}>
                  <span className={styles.label}>💰 Monto:</span>
                  <span className={styles.value}>
                    {debtToCollect.currency_symbol}{debtToCollect.amount.toLocaleString('es-AR')}
                  </span>
                </div>
                {debtToCollect.due_date && (
                  <div className={styles.debtInfoItem}>
                    <span className={styles.label}>📅 Vencimiento:</span>
                    <span className={styles.value}>{formatDate(debtToCollect.due_date)}</span>
                  </div>
                )}
              </div>
              <p className={styles.confirmNote}>
                Se enviará una notificación amigable recordándole que tiene una deuda pendiente.
              </p>
              <div className={styles.formActions}>
                <Button variant="secondary" onClick={() => setShowCollectModal(false)} disabled={collecting}>
                  Cancelar
                </Button>
                <Button 
                  variant="info"
                  onClick={confirmCollect}
                  disabled={collecting}
                >
                  {collecting ? '⏳ Enviando...' : '📨 Enviar Recordatorio'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Modal de edición */}
      <EditAccountModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        account={account}
        onSave={handleSaveAccount}
        onDelete={handleDeleteAccount}
      />

      {/* Modal para borrar gasto */}
      <Modal
        isOpen={showDeleteExpenseModal}
        onClose={() => { setShowDeleteExpenseModal(false); setExpenseToDelete(null); }}
        title="🗑️ Eliminar Gasto"
      >
        <div className={styles.modalContent}>
          {expenseToDelete && (
            <>
              <p className={styles.confirmText}>
                ¿Estás seguro de que deseas eliminar este gasto?
              </p>
              <div className={styles.expenseInfo}>
                <div className={styles.debtInfoItem}>
                  <span className={styles.label}>📝 Descripción:</span>
                  <span className={styles.value}>{expenseToDelete.description}</span>
                </div>
                <div className={styles.debtInfoItem}>
                  <span className={styles.label}>💰 Monto:</span>
                  <span className={styles.value}>
                    {account.currency_symbol}{expenseToDelete.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className={styles.debtInfoItem}>
                  <span className={styles.label}>📅 Fecha:</span>
                  <span className={styles.value}>{formatDate(expenseToDelete.date)}</span>
                </div>
              </div>
              <p className={styles.confirmNote}>
                Esta acción no se puede deshacer. El gasto se eliminará permanentemente.
              </p>
              <div className={styles.formActions}>
                <Button 
                  variant="secondary" 
                  onClick={() => { setShowDeleteExpenseModal(false); setExpenseToDelete(null); }} 
                  disabled={deletingExpense}
                >
                  Cancelar
                </Button>
                <Button 
                  variant="danger"
                  onClick={confirmDeleteExpense}
                  disabled={deletingExpense}
                >
                  {deletingExpense ? '⏳ Eliminando...' : '🗑️ Eliminar Gasto'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default AccountDetail;
