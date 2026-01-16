/**
 * Dashboard Page - Vista principal del usuario
 */
import { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth, useExpenses, useDebts, useFriends, useUI } from '../../context';
import { StatCard, Card, Button, Loading, EmptyState, Modal, Input } from '../../components';
import remindersService from '../../services/remindersService';
import styles from './Dashboard.module.css';

const COLORS = ['#0ea5e9', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];

const Dashboard = () => {
  const { user, profile, updateProfile } = useAuth();
  const { monthlyStats, upcomingPayments, loading: expensesLoading, categories } = useExpenses();
  const { summary: debtsSummary, debtsByFriend, loading: debtsLoading } = useDebts();
  const { friends } = useFriends();
  const { siteConfig, showSuccess, showError } = useUI();
  const navigate = useNavigate();

  // Estado para modal de sueldo
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [salaryInput, setSalaryInput] = useState('');
  const [savingSalary, setSavingSalary] = useState(false);
  
  // Estado para próximos vencimientos
  const [upcomingDueDates, setUpcomingDueDates] = useState(null);

  const loading = expensesLoading || debtsLoading;

  // Cargar recordatorios y próximos vencimientos al montar
  useEffect(() => {
    if (!user) return;
    
    const loadReminders = async () => {
      // Generar recordatorios automáticos
      await remindersService.checkAndGenerateReminders(user.id);
      
      // Cargar próximos vencimientos
      const result = await remindersService.getUpcomingDueDates(user.id);
      if (!result.error) {
        setUpcomingDueDates(result);
      }
    };
    
    loadReminders();
  }, [user]);

  // Sueldo mensual del perfil
  const monthlySalary = profile?.monthly_income || 0;
  
  // Calcular sueldo restante (sueldo - gastos - deudas que debo)
  const totalGastos = (monthlyStats?.totalSpent || 0);
  const totalDeudas = (debtsSummary?.totalIOwe || 0);
  const sueldoRestante = monthlySalary - totalGastos - totalDeudas;
  const alcanza = sueldoRestante >= 0;

  // Guardar sueldo
  const handleSaveSalary = async () => {
    const salary = parseFloat(salaryInput) || 0;
    setSavingSalary(true);
    
    console.log('Guardando sueldo:', salary);
    const result = await updateProfile({ monthly_income: salary });
    console.log('Resultado:', result);
    
    setSavingSalary(false);
    
    if (result.success) {
      showSuccess('Sueldo actualizado correctamente');
      setShowSalaryModal(false);
    } else {
      console.error('Error guardando sueldo:', result.error);
      showError(result.error?.message || 'Error al guardar sueldo. Verifica que la columna monthly_income exista en la tabla profiles.');
    }
  };

  const openSalaryModal = () => {
    setSalaryInput(monthlySalary > 0 ? monthlySalary.toString() : '');
    setShowSalaryModal(true);
  };

  // Datos para el gráfico de categorías
  const categoryData = useMemo(() => {
    if (!monthlyStats?.byCategory) return [];
    return Object.entries(monthlyStats.byCategory).map(([key, value]) => {
      const category = categories.find(c => c.id === key);
      return {
        name: category?.label || key,
        value,
        icon: category?.icon || '📦'
      };
    });
  }, [monthlyStats, categories]);

  // Datos para el gráfico de fuentes de pago
  const sourceData = useMemo(() => {
    if (!monthlyStats?.bySource) return [];
    const sourceLabels = {
      bank: 'Banco',
      card: 'Tarjeta',
      cash: 'Efectivo',
      friend: 'Amigo'
    };
    return Object.entries(monthlyStats.bySource).map(([key, value]) => ({
      name: sourceLabels[key] || key,
      value
    }));
  }, [monthlyStats]);

  const currency = siteConfig?.currency || '$';
  const formatCurrency = (amount) => {
    return `${currency}${amount.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`;
  };

  if (loading) {
    return <Loading size="lg" text="Cargando dashboard..." />;
  }

  return (
    <div className={styles.dashboard}>
      {/* Header de bienvenida */}
      <div className={styles.welcome}>
        <div>
          <h2 className={styles.welcomeTitle}>
            ¡Hola, {profile?.first_name || profile?.full_name?.split(' ')[0] || 'Usuario'}! 👋
          </h2>
          <p className={styles.welcomeText}>
            Aquí está el resumen de tus finanzas este mes.
          </p>
        </div>
        <Button icon="➕" onClick={() => navigate('/expenses', { state: { openNew: true } })}>
          Nuevo Gasto
        </Button>
      </div>

      {/* Sueldo del mes */}
      <div className={styles.salarySection}>
        <Card className={styles.salaryCard}>
          <div className={styles.salaryContent}>
            <div className={styles.salaryInfo}>
              <div className={styles.salaryHeader}>
                <span className={styles.salaryIcon}>💵</span>
                <div>
                  <h3 className={styles.salaryTitle}>Sueldo del Mes</h3>
                  <p className={styles.salaryValue}>
                    {monthlySalary > 0 ? formatCurrency(monthlySalary) : 'No configurado'}
                  </p>
                </div>
              </div>
              {monthlySalary > 0 && (
                <div className={styles.salaryDetails}>
                  <div className={styles.salaryDetail}>
                    <span>Gastos:</span>
                    <span className={styles.expense}>-{formatCurrency(totalGastos)}</span>
                  </div>
                  <div className={styles.salaryDetail}>
                    <span>Deudas:</span>
                    <span className={styles.expense}>-{formatCurrency(totalDeudas)}</span>
                  </div>
                  <div className={`${styles.salaryDetail} ${styles.remaining}`}>
                    <span>Restante:</span>
                    <span className={alcanza ? styles.positive : styles.negative}>
                      {formatCurrency(sueldoRestante)}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className={styles.salaryStatus}>
              {monthlySalary > 0 ? (
                <div className={`${styles.statusBadge} ${alcanza ? styles.ok : styles.warning}`}>
                  {alcanza ? '✅ Te alcanza' : '⚠️ No te alcanza'}
                </div>
              ) : null}
              <Button size="sm" variant="secondary" onClick={openSalaryModal}>
                {monthlySalary > 0 ? '✏️ Editar' : '➕ Configurar'}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Stats principales */}
      <div className={styles.statsGrid}>
        <StatCard
          icon="💰"
          label="Ingresos Mensuales"
          value={formatCurrency(monthlyStats?.income || 0)}
          variant="primary"
        />
        <StatCard
          icon="💸"
          label="Total Gastado"
          value={formatCurrency(monthlyStats?.totalSpent || 0)}
          variant="warning"
        />
        <StatCard
          icon="📊"
          label="Balance"
          value={formatCurrency(monthlyStats?.balance || 0)}
          variant={monthlyStats?.balance >= 0 ? 'success' : 'default'}
        />
        <StatCard
          icon="📋"
          label="Gastos Pendientes"
          value={formatCurrency(monthlyStats?.totalPending || 0)}
          variant="info"
        />
      </div>

      {/* Alertas de próximos vencimientos */}
      {upcomingDueDates && (upcomingDueDates.debtsIOwe.length > 0 || upcomingDueDates.debtsOwedToMe.length > 0) && (
        <div className={styles.alertsSection}>
          <Card className={styles.alertCard}>
            <div className={styles.alertHeader}>
              <span className={styles.alertIcon}>⏰</span>
              <h3 className={styles.alertTitle}>Próximos Vencimientos</h3>
            </div>
            <div className={styles.alertsList}>
              {upcomingDueDates.debtsIOwe.map(debt => (
                <div key={debt.id} className={`${styles.alertItem} ${styles.alertWarning}`}>
                  <span className={styles.alertEmoji}>💸</span>
                  <div className={styles.alertInfo}>
                    <span className={styles.alertText}>
                      Debes pagar <strong>{formatCurrency(debt.amount)}</strong> a {debt.creditor?.first_name || 'Alguien'}
                    </span>
                    <span className={styles.alertDate}>
                      Vence: {new Date(debt.due_date).toLocaleDateString('es-AR')}
                    </span>
                  </div>
                </div>
              ))}
              {upcomingDueDates.debtsOwedToMe.map(debt => (
                <div key={debt.id} className={`${styles.alertItem} ${styles.alertSuccess}`}>
                  <span className={styles.alertEmoji}>💰</span>
                  <div className={styles.alertInfo}>
                    <span className={styles.alertText}>
                      {debt.debtor_type === 'virtual' 
                        ? debt.virtual_friend?.name 
                        : debt.debtor?.first_name || 'Alguien'
                      } te debe <strong>{formatCurrency(debt.amount)}</strong>
                    </span>
                    <span className={styles.alertDate}>
                      Vence: {new Date(debt.due_date).toLocaleDateString('es-AR')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Contenido principal */}
      <div className={styles.mainContent}>
        {/* Columna izquierda */}
        <div className={styles.leftColumn}>
          {/* Próximos pagos */}
          <Card title="Próximos Pagos" subtitle={`${upcomingPayments.count} pendientes este mes`}>
            {upcomingPayments.payments.length > 0 ? (
              <div className={styles.paymentsList}>
                {upcomingPayments.payments.slice(0, 5).map((payment) => (
                  <div key={payment.id} className={styles.paymentItem}>
                    <div className={styles.paymentInfo}>
                      <span className={styles.paymentCategory}>
                        {categories.find(c => c.id === payment.category)?.icon || '📦'}
                      </span>
                      <div>
                        <div className={styles.paymentDesc}>{payment.description}</div>
                        <div className={styles.paymentDate}>
                          {new Date(payment.date).toLocaleDateString('es-AR')}
                        </div>
                      </div>
                    </div>
                    <div className={styles.paymentAmount}>
                      {formatCurrency(payment.amount)}
                    </div>
                  </div>
                ))}
                {upcomingPayments.payments.length > 5 && (
                  <Link to="/expenses" className={styles.viewMore}>
                    Ver todos los pagos →
                  </Link>
                )}
              </div>
            ) : (
              <EmptyState
                icon="✅"
                title="Sin pagos pendientes"
                description="No tienes pagos pendientes este mes"
              />
            )}
          </Card>

          {/* Gastos por categoría */}
          <Card title="Gastos por Categoría">
            {categoryData.length > 0 ? (
              <div className={styles.chartContainer}>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => formatCurrency(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className={styles.legend}>
                  {categoryData.map((entry, index) => (
                    <div key={entry.name} className={styles.legendItem}>
                      <span 
                        className={styles.legendColor}
                        style={{ background: COLORS[index % COLORS.length] }}
                      />
                      <span>{entry.icon} {entry.name}</span>
                      <span className={styles.legendValue}>{formatCurrency(entry.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                icon="📊"
                title="Sin datos"
                description="Aún no hay gastos registrados este mes"
              />
            )}
          </Card>
        </div>

        {/* Columna derecha */}
        <div className={styles.rightColumn}>
          {/* Resumen de deudas */}
          <Card title="Resumen de Deudas">
            <div className={styles.debtsSummary}>
              <div className={styles.debtItem}>
                <span className={styles.debtLabel}>Me deben</span>
                <span className={`${styles.debtValue} ${styles.positive}`}>
                  {formatCurrency(debtsSummary?.totalOwedToMe || 0)}
                </span>
              </div>
              <div className={styles.debtItem}>
                <span className={styles.debtLabel}>Yo debo</span>
                <span className={`${styles.debtValue} ${styles.negative}`}>
                  {formatCurrency(debtsSummary?.totalIOwe || 0)}
                </span>
              </div>
              <div className={styles.debtDivider}></div>
              <div className={styles.debtItem}>
                <span className={styles.debtLabel}>Balance neto</span>
                <span className={`${styles.debtValue} ${(debtsSummary?.netBalance || 0) >= 0 ? styles.positive : styles.negative}`}>
                  {formatCurrency(debtsSummary?.netBalance || 0)}
                </span>
              </div>
            </div>
            
            {(debtsSummary?.pendingToAccept > 0) && (
              <div className={styles.debtAlert}>
                🔔 Tienes {debtsSummary.pendingToAccept} deuda(s) pendiente(s) de aceptar
                <Link to="/debts">Ver →</Link>
              </div>
            )}
          </Card>

          {/* Deudas por amigo */}
          <Card title="Deudas por Amigo">
            {debtsByFriend.length > 0 ? (
              <div className={styles.friendDebtsList}>
                {debtsByFriend.slice(0, 5).map((item) => (
                  <div key={item.friend.id} className={styles.friendDebtItem}>
                    <div className={styles.friendInfo}>
                      <div className={styles.friendAvatar}>
                        {item.friend.first_name?.[0]}{item.friend.last_name?.[0]}
                      </div>
                      <div>
                        <div className={styles.friendName}>
                          {item.friend.first_name} {item.friend.last_name}
                        </div>
                        <div className={styles.friendNickname}>@{item.friend.nickname}</div>
                      </div>
                    </div>
                    <div className={`${styles.friendBalance} ${item.netBalance >= 0 ? styles.positive : styles.negative}`}>
                      {item.netBalance >= 0 ? '+' : ''}{formatCurrency(item.netBalance)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="👥"
                title="Sin deudas"
                description="No tienes deudas con amigos"
              />
            )}
          </Card>

          {/* Amigos */}
          <Card title="Mis Amigos" subtitle={`${friends.length} amigos`}>
            {friends.length > 0 ? (
              <div className={styles.friendsList}>
                {friends.slice(0, 4).map(({ friend }) => (
                  <div key={friend.id} className={styles.friendChip}>
                    <div className={styles.friendAvatar}>
                      {friend.first_name?.[0]}{friend.last_name?.[0]}
                    </div>
                    <span>@{friend.nickname}</span>
                  </div>
                ))}
                {friends.length > 4 && (
                  <Link to="/friends" className={styles.friendChip}>
                    +{friends.length - 4} más
                  </Link>
                )}
              </div>
            ) : (
              <EmptyState
                icon="👥"
                title="Sin amigos"
                description="Agrega amigos usando su nickname"
                action="Agregar amigo"
                onAction={() => navigate('/friends', { state: { openNew: true } })}
              />
            )}
          </Card>
        </div>
      </div>

      {/* Modal de Sueldo */}
      <Modal
        isOpen={showSalaryModal}
        onClose={() => setShowSalaryModal(false)}
        title="Configurar Sueldo Mensual"
        size="sm"
      >
        <div className={styles.salaryForm}>
          <p className={styles.salaryFormHint}>
            Ingresa tu sueldo mensual para calcular si te alcanza el dinero.
          </p>
          <Input
            label="Sueldo Mensual"
            type="number"
            placeholder="Ej: 500000"
            value={salaryInput}
            onChange={(e) => setSalaryInput(e.target.value)}
            icon="💵"
          />
          <div className={styles.salaryFormActions}>
            <Button variant="secondary" onClick={() => setShowSalaryModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveSalary} loading={savingSalary}>
              Guardar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Dashboard;
