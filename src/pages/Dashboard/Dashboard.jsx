/**
 * Dashboard Page - Vista principal del usuario
 */
import { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth, useExpenses, useDebts, useFriends, useUI } from '../../context';
import { StatCard, Card, Button, Loading, EmptyState, Modal, Input, Select, CurrencyTabs, BankAccountsPanel, InstallmentsPanel, MonthSelectorModal, RequiredBankAccountModal, CURRENCIES } from '../../components';
import remindersService from '../../services/remindersService';
import monthlyIncomeService from '../../services/monthlyIncomeService';
import styles from './Dashboard.module.css';

const COLORS = ['#0ea5e9', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];

const Dashboard = () => {
  const { user, profile, updateProfile } = useAuth();
  const { 
    monthlyStats, 
    upcomingPayments, 
    loading: expensesLoading, 
    categories,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
    getExpensesByCurrency,
    getAvailableCurrencies: getAvailableExpenseCurrencies,
    getStatsByCurrency
  } = useExpenses();
  const { 
    summary: debtsSummary, 
    debtsByFriend, 
    loading: debtsLoading,
    getAvailableCurrencies: getAvailableDebtCurrencies,
    getSummaryByCurrency
  } = useDebts();
  const { friends } = useFriends();
  const { siteConfig, showSuccess, showError } = useUI();
  const navigate = useNavigate();
  
  // Estado para modal de sueldo
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [salaryInput, setSalaryInput] = useState('');
  const [salaryMonth, setSalaryMonth] = useState(selectedMonth);
  const [salaryYear, setSalaryYear] = useState(selectedYear);
  const [savingSalary, setSavingSalary] = useState(false);
  const [monthlySalary, setMonthlySalary] = useState(0);
  
  // Estado para próximos vencimientos
  const [upcomingDueDates, setUpcomingDueDates] = useState(null);
  
  // Estado para filtro de moneda
  const [selectedCurrency, setSelectedCurrency] = useState('ARS');
  
  // Estado para modal de gastos mensualizados
  const [showMonthModal, setShowMonthModal] = useState(false);
  
  // Estado para verificar cuenta bancaria
  const [needsBankAccount, setNeedsBankAccount] = useState(false);
  const [checkingBankAccount, setCheckingBankAccount] = useState(true);

  const loading = expensesLoading || debtsLoading;

  // Cargar sueldo mensual de la base de datos
  useEffect(() => {
    if (!user) return;
    
    const loadMonthlyIncome = async () => {
      const result = await monthlyIncomeService.getMonthlyIncome(user.id, selectedYear, selectedMonth);
      if (!result.error && result.income) {
        setMonthlySalary(result.income.amount);
      } else {
        setMonthlySalary(0);
      }
    };
    
    loadMonthlyIncome();
  }, [user, selectedYear, selectedMonth]);

  // Verificar si el usuario tiene al menos una cuenta bancaria
  useEffect(() => {
    if (!user) return;
    
    const checkBankAccounts = async () => {
      try {
        const { bankAccountsService } = await import('../../services');
        const result = await bankAccountsService.getUserAccounts(user.id);
        const hasAccounts = result.accounts && result.accounts.length > 0;
        setNeedsBankAccount(!hasAccounts);
        setCheckingBankAccount(false);
      } catch (error) {
        console.error('Error verificando cuentas:', error);
        setCheckingBankAccount(false);
      }
    };
    
    checkBankAccounts();
  }, [user]);

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
  
  // Obtener monedas disponibles
  const availableCurrencies = useMemo(() => {
    const expenseCurrencies = getAvailableExpenseCurrencies();
    const debtCurrencies = getAvailableDebtCurrencies();
    const allCurrencies = new Set([...expenseCurrencies, ...debtCurrencies, 'ARS']);
    return Array.from(allCurrencies);
  }, [getAvailableExpenseCurrencies, getAvailableDebtCurrencies]);

  // Calcular stats filtrados por moneda seleccionada
  const filteredExpenseStats = useMemo(() => 
    getStatsByCurrency(selectedCurrency), 
    [selectedCurrency, getStatsByCurrency]
  );

  const filteredDebtStats = useMemo(() => 
    getSummaryByCurrency(selectedCurrency),
    [selectedCurrency, getSummaryByCurrency]
  );

  // Calcular sueldo restante (sueldo - gastos - deudas que debo) - filtrado por moneda
  const totalGastos = filteredExpenseStats?.totalSpent || 0;
  const totalDeudas = filteredDebtStats?.totalIOwe || 0;
  const sueldoRestante = monthlySalary - totalGastos - totalDeudas;
  const alcanza = sueldoRestante >= 0;

  // Obtener símbolo de moneda actual
  const currentCurrencySymbol = useMemo(() => {
    const currency = CURRENCIES.find(c => c.value === selectedCurrency);
    return currency?.symbol || '$';
  }, [selectedCurrency]);

  // Función helper para formatear con el símbolo correcto
  const formatCurrencyValue = (amount) => {
    return `${currentCurrencySymbol}${amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Guardar sueldo mensual
  const handleSaveSalary = async () => {
    const salary = parseFloat(salaryInput) || 0;
    setSavingSalary(true);
    
    const result = await monthlyIncomeService.setMonthlyIncome(
      user.id, 
      salaryYear, 
      salaryMonth, 
      salary
    );
    
    setSavingSalary(false);
    
    if (!result.error) {
      // Si es el mes actual, actualizar el estado local
      if (salaryMonth === selectedMonth && salaryYear === selectedYear) {
        setMonthlySalary(salary);
      }
      showSuccess(`Sueldo guardado para ${getMonthName(salaryMonth)} ${salaryYear}`);
      setShowSalaryModal(false);
    } else {
      showError('Error al guardar sueldo');
    }
  };

  const openSalaryModal = () => {
    // Calcular mes siguiente por defecto
    const nextMonth = selectedMonth === 12 ? 1 : selectedMonth + 1;
    const nextYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear;
    
    setSalaryMonth(nextMonth);
    setSalaryYear(nextYear);
    setSalaryInput(monthlySalary > 0 ? monthlySalary.toString() : '');
    setShowSalaryModal(true);
  };

  // Crear primera cuenta bancaria
  const handleCreateFirstAccount = async (accountData) => {
    try {
      const { bankAccountsService } = await import('../../services');
      const result = await bankAccountsService.createAccount(user.id, accountData);
      
      if (result.error) {
        showError(result.error);
        return;
      }
      
      showSuccess('¡Cuenta creada exitosamente! Ya puedes comenzar a gestionar tus finanzas.');
      setNeedsBankAccount(false);
      
      // Recargar la página para actualizar todos los componentes
      window.location.reload();
    } catch (error) {
      showError('Error al crear la cuenta');
      console.error(error);
    }
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

  // Si está verificando cuentas bancarias, mostrar loading
  if (checkingBankAccount) {
    return <Loading size="lg" text="Verificando configuración..." />;
  }

  // Si no tiene cuenta bancaria, mostrar modal obligatorio
  if (needsBankAccount) {
    return (
      <RequiredBankAccountModal
        isOpen={true}
        onCreateAccount={handleCreateFirstAccount}
      />
    );
  }

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
        <div className={styles.headerActions}>
          {/* Selector de mes/año */}
          <div className={styles.dateSelector}>
            <Select
              value={String(selectedMonth)}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              style={{ width: '130px' }}
            >
              <option value="1">Enero</option>
              <option value="2">Febrero</option>
              <option value="3">Marzo</option>
              <option value="4">Abril</option>
              <option value="5">Mayo</option>
              <option value="6">Junio</option>
              <option value="7">Julio</option>
              <option value="8">Agosto</option>
              <option value="9">Septiembre</option>
              <option value="10">Octubre</option>
              <option value="11">Noviembre</option>
              <option value="12">Diciembre</option>
            </Select>
            <Select
              value={String(selectedYear)}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              style={{ width: '100px' }}
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                <option key={year} value={String(year)}>{year}</option>
              ))}
            </Select>
          </div>
          <Button icon="➕" onClick={() => navigate('/expenses', { state: { openNew: true } })}>
            Nuevo Gasto
          </Button>
        </div>
      </div>

      {/* Tabs de monedas */}
      <CurrencyTabs
        selectedCurrency={selectedCurrency}
        onCurrencyChange={setSelectedCurrency}
        availableCurrencies={availableCurrencies}
      />

      {/* Panel de Cuentas Bancarias */}
      <BankAccountsPanel />

      {/* Paneles de Cuotas y Gastos Mensualizados */}
      <div className={styles.quickAccessPanels}>
        <InstallmentsPanel />
        
        <Card className={styles.monthSelectorCard}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>
              <span className={styles.cardIcon}>📊</span>
              Gastos por Mes
            </h3>
          </div>
          <p className={styles.cardDescription}>
            Selecciona un mes para ver todos tus gastos detallados
          </p>
          <Button
            onClick={() => setShowMonthModal(true)}
            variant="primary"
            fullWidth
          >
            📅 Ver Gastos por Mes
          </Button>
        </Card>
      </div>

      {/* Sueldo del mes */}
      <div className={styles.salarySection}>
        <Card className={styles.salaryCard}>
          <div className={styles.salaryContent}>
            <div className={styles.salaryInfo}>
              <div className={styles.salaryHeader}>
                <span className={styles.salaryIcon}>💵</span>
                <div>
                  <h3 className={styles.salaryTitle}>Sueldo de {getMonthName(selectedMonth)}</h3>
                  <p className={styles.salaryValue}>
                    {monthlySalary > 0 ? formatCurrencyValue(monthlySalary) : 'No configurado'}
                  </p>
                </div>
              </div>
              {monthlySalary > 0 && (
                <div className={styles.salaryDetails}>
                  <div className={styles.salaryDetail}>
                    <span>Gastos:</span>
                    <span className={styles.expense}>-{formatCurrencyValue(totalGastos)}</span>
                  </div>
                  <div className={styles.salaryDetail}>
                    <span>Deudas:</span>
                    <span className={styles.expense}>-{formatCurrencyValue(totalDeudas)}</span>
                  </div>
                  <div className={`${styles.salaryDetail} ${styles.remaining}`}>
                    <span>Restante:</span>
                    <span className={alcanza ? styles.positive : styles.negative}>
                      {formatCurrencyValue(sueldoRestante)}
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
          value={formatCurrencyValue(monthlyStats?.income || 0)}
          variant="primary"
        />
        <StatCard
          icon="💸"
          label="Total Gastado"
          value={formatCurrencyValue(totalGastos)}
          variant="warning"
        />
        <StatCard
          icon="📊"
          label="Balance"
          value={formatCurrencyValue(monthlyStats?.balance || 0)}
          variant={monthlyStats?.balance >= 0 ? 'success' : 'default'}
        />
        <StatCard
          icon="📋"
          label="Gastos Pendientes"
          value={formatCurrencyValue(filteredExpenseStats?.totalPending || 0)}
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
                      Debes pagar <strong>{debt.currency_symbol || '$'}{debt.amount.toLocaleString('es-AR')}</strong> a {debt.creditor?.first_name || 'Alguien'}
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
                      } te debe <strong>{debt.currency_symbol || '$'}{debt.amount.toLocaleString('es-AR')}</strong>
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
                      {payment.currency_symbol || '$'}{payment.amount.toLocaleString('es-AR')}
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
                  {formatCurrencyValue(filteredDebtStats?.totalOwedToMe || 0)}
                </span>
              </div>
              <div className={styles.debtItem}>
                <span className={styles.debtLabel}>Yo debo</span>
                <span className={`${styles.debtValue} ${styles.negative}`}>
                  {formatCurrencyValue(filteredDebtStats?.totalIOwe || 0)}
                </span>
              </div>
              <div className={styles.debtDivider}></div>
              <div className={styles.debtItem}>
                <span className={styles.debtLabel}>Balance neto</span>
                <span className={`${styles.debtValue} ${((filteredDebtStats?.totalOwedToMe || 0) - (filteredDebtStats?.totalIOwe || 0)) >= 0 ? styles.positive : styles.negative}`}>
                  {formatCurrencyValue((filteredDebtStats?.totalOwedToMe || 0) - (filteredDebtStats?.totalIOwe || 0))}
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
        title="Configurar Sueldo"
        size="sm"
      >
        <div className={styles.salaryForm}>
          <p className={styles.salaryFormHint}>
            Configura tu sueldo mensual para calcular si te alcanza el dinero.
          </p>
          
          {/* Selectores de mes y año */}
          <div className={styles.dateSelectors}>
            <Select
              label="Mes"
              value={String(salaryMonth)}
              onChange={(e) => setSalaryMonth(parseInt(e.target.value))}
              options={[
                { value: '1', label: 'Enero' },
                { value: '2', label: 'Febrero' },
                { value: '3', label: 'Marzo' },
                { value: '4', label: 'Abril' },
                { value: '5', label: 'Mayo' },
                { value: '6', label: 'Junio' },
                { value: '7', label: 'Julio' },
                { value: '8', label: 'Agosto' },
                { value: '9', label: 'Septiembre' },
                { value: '10', label: 'Octubre' },
                { value: '11', label: 'Noviembre' },
                { value: '12', label: 'Diciembre' }
              ]}
            />
            <Select
              label="Año"
              value={String(salaryYear)}
              onChange={(e) => setSalaryYear(parseInt(e.target.value))}
              options={Array.from({ length: 5 }, (_, i) => {
                const year = new Date().getFullYear() - 1 + i;
                return { value: String(year), label: String(year) };
              })}
            />
          </div>

          <Input
            label="Sueldo Mensual"
            type="number"
            placeholder="Ej: 500000"
            value={salaryInput}
            onChange={(e) => setSalaryInput(e.target.value)}
            icon="💵"
          />
          
          <div className={styles.salaryFormHint2}>
            💡 Los sueldos se suman automáticamente en tus ingresos totales
          </div>
          
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

      {/* Modal de gastos mensualizados */}
      <MonthSelectorModal
        isOpen={showMonthModal}
        onClose={() => setShowMonthModal(false)}
      />
    </div>
  );
};

// Helper para obtener nombre del mes
const getMonthName = (month) => {
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return months[month - 1];
};

export default Dashboard;
