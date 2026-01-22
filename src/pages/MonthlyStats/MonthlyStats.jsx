/**
 * MonthlyStats - Página de estadísticas mensuales
 */
import { useState, useEffect, useMemo } from 'react';
import { useAuth, useExpenses, useDebts, useUI } from '../../context';
import { Card, Loading } from '../../components';
import monthlyIncomeService from '../../services/monthlyIncomeService';
import { 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  CreditCard,
  CheckCircle,
  Clock,
  PieChart,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Wallet
} from 'lucide-react';
import styles from './MonthlyStats.module.css';

const MonthlyStats = () => {
  const { user } = useAuth();
  const { expenses, loading: expensesLoading } = useExpenses();
  const { debtsByFriend, summary: debtsSummary, loading: debtsLoading } = useDebts();
  const { siteConfig } = useUI();
  
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Estados para seleccionar mes/año
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const monthName = monthNames[selectedMonth - 1];

  const currency = siteConfig?.currency || '$';

  // Cargar ingreso mensual
  useEffect(() => {
    const loadIncome = async () => {
      if (!user) return;
      
      setLoading(true);
      const result = await monthlyIncomeService.getMonthlyIncome(user.id, selectedYear, selectedMonth);
      if (!result.error && result.income) {
        setMonthlyIncome(result.income.amount);
      } else {
        setMonthlyIncome(0);
      }
      setLoading(false);
    };

    loadIncome();
  }, [user, selectedMonth, selectedYear]);

  // Filtrar gastos del mes
  const monthExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const expDate = new Date(exp.date);
      return expDate.getMonth() + 1 === selectedMonth && expDate.getFullYear() === selectedYear;
    });
  }, [expenses, selectedMonth, selectedYear]);

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
    if (value === null || value === undefined || isNaN(value)) return `${currency}0`;
    return `${currency}${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`;
  };

  // Navegación de meses
  const goToPreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const goToCurrentMonth = () => {
    setSelectedMonth(new Date().getMonth() + 1);
    setSelectedYear(new Date().getFullYear());
  };

  const isLoading = loading || expensesLoading || debtsLoading;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>
            <BarChart3 size={32} className={styles.titleIcon} />
            Resumen Mensual
          </h2>
          <p className={styles.subtitle}>
            Analiza tus finanzas mes a mes
          </p>
        </div>
      </div>

      {/* Selector de Mes */}
      <Card className={styles.monthSelector}>
        <div className={styles.monthNav}>
          <button className={styles.navBtn} onClick={goToPreviousMonth}>
            <ChevronLeft size={24} />
          </button>
          <div className={styles.currentMonth}>
            <Calendar size={24} className={styles.calendarIcon} />
            <span className={styles.monthLabel}>{monthName} {selectedYear}</span>
          </div>
          <button className={styles.navBtn} onClick={goToNextMonth}>
            <ChevronRight size={24} />
          </button>
        </div>
        <button className={styles.todayBtn} onClick={goToCurrentMonth}>
          Ir al mes actual
        </button>
      </Card>

      {isLoading ? (
        <div className={styles.loadingContainer}>
          <Loading size="lg" text="Cargando estadísticas..." />
        </div>
      ) : (
        <>
          {/* Balance General */}
          <div className={styles.balanceGrid}>
            <Card className={`${styles.balanceCard} ${styles.income}`}>
              <div className={styles.cardIcon}>
                <TrendingUp size={28} />
              </div>
              <div className={styles.cardInfo}>
                <span className={styles.cardLabel}>Ingresos</span>
                <span className={styles.cardValue}>{formatCurrency(monthlyIncome)}</span>
              </div>
            </Card>
            
            <Card className={`${styles.balanceCard} ${styles.expense}`}>
              <div className={styles.cardIcon}>
                <TrendingDown size={28} />
              </div>
              <div className={styles.cardInfo}>
                <span className={styles.cardLabel}>Gastos</span>
                <span className={styles.cardValue}>-{formatCurrency(totalExpenses)}</span>
              </div>
            </Card>
            
            <Card className={`${styles.balanceCard} ${styles.debt}`}>
              <div className={styles.cardIcon}>
                <CreditCard size={28} />
              </div>
              <div className={styles.cardInfo}>
                <span className={styles.cardLabel}>Deudas</span>
                <span className={styles.cardValue}>-{formatCurrency(debtsSummary?.totalIOwe || 0)}</span>
              </div>
            </Card>
            
            <Card className={`${styles.balanceCard} ${balance >= 0 ? styles.positive : styles.negative}`}>
              <div className={styles.cardIcon}>
                <Wallet size={28} />
              </div>
              <div className={styles.cardInfo}>
                <span className={styles.cardLabel}>Balance</span>
                <span className={styles.cardValue}>{formatCurrency(balance)}</span>
              </div>
            </Card>
          </div>

          {/* Resumen de Gastos */}
          <div className={styles.sectionGrid}>
            <Card>
              <h3 className={styles.sectionTitle}>
                <DollarSign size={20} className={styles.sectionIcon} />
                Resumen de Gastos
              </h3>
              <div className={styles.statsGrid}>
                <div className={styles.statItem}>
                  <div className={styles.statIcon}>
                    <DollarSign size={20} />
                  </div>
                  <div className={styles.statInfo}>
                    <span className={styles.statLabel}>Total</span>
                    <span className={styles.statValue}>{formatCurrency(totalExpenses)}</span>
                    <span className={styles.statCount}>{monthExpenses.length} gastos</span>
                  </div>
                </div>
                <div className={styles.statItem}>
                  <div className={`${styles.statIcon} ${styles.paidIcon}`}>
                    <CheckCircle size={20} />
                  </div>
                  <div className={styles.statInfo}>
                    <span className={styles.statLabel}>Pagados</span>
                    <span className={styles.statValue}>{formatCurrency(totalPaid)}</span>
                    <span className={styles.statCount}>{paidExpenses.length} gastos</span>
                  </div>
                </div>
                <div className={styles.statItem}>
                  <div className={`${styles.statIcon} ${styles.pendingIcon}`}>
                    <Clock size={20} />
                  </div>
                  <div className={styles.statInfo}>
                    <span className={styles.statLabel}>Pendientes</span>
                    <span className={styles.statValue}>{formatCurrency(totalPending)}</span>
                    <span className={styles.statCount}>{pendingExpenses.length} gastos</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Gastos por Categoría */}
            <Card>
              <h3 className={styles.sectionTitle}>
                <PieChart size={20} className={styles.sectionIcon} />
                Por Categoría
              </h3>
              {expensesByCategory.length > 0 ? (
                <div className={styles.categoryList}>
                  {expensesByCategory.map((cat) => (
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
              ) : (
                <div className={styles.emptyState}>
                  <PieChart size={48} className={styles.emptyIcon} />
                  <p>No hay gastos en este mes</p>
                </div>
              )}
            </Card>
          </div>

          {/* Gastos en Cuotas */}
          {installmentsExpenses.length > 0 && (
            <Card>
              <h3 className={styles.sectionTitle}>
                <RefreshCw size={20} className={styles.sectionIcon} />
                Gastos en Cuotas
              </h3>
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
            </Card>
          )}

          {/* Deudas Activas */}
          {debtsByFriend && debtsByFriend.length > 0 && (
            <Card>
              <h3 className={styles.sectionTitle}>
                <CreditCard size={20} className={styles.sectionIcon} />
                Deudas Activas
              </h3>
              <div className={styles.debtsList}>
                {debtsByFriend.slice(0, 5).map(debt => (
                  <div key={debt.id} className={styles.debtItem}>
                    <div className={styles.debtInfo}>
                      <span className={styles.debtName}>{debt.friendName}</span>
                      <span className={styles.debtStatus}>
                        {debt.status === 'active' ? (
                          <><Clock size={14} /> Activa</>
                        ) : (
                          <><CheckCircle size={14} /> Pagada</>
                        )}
                      </span>
                    </div>
                    <div className={styles.debtAmount}>
                      {formatCurrency(debt.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Lista de Todos los Gastos */}
          <Card>
            <h3 className={styles.sectionTitle}>
              <Wallet size={20} className={styles.sectionIcon} />
              Todos los Gastos ({monthExpenses.length})
            </h3>
            <div className={styles.expensesList}>
              {monthExpenses.length > 0 ? (
                monthExpenses.map(exp => (
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
                        {exp.is_paid ? <CheckCircle size={16} /> : <Clock size={16} />}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.emptyState}>
                  <Wallet size={48} className={styles.emptyIcon} />
                  <p>No hay gastos registrados en este mes</p>
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default MonthlyStats;
