/**
 * Statistics Page - Análisis de gastos y finanzas
 */
import { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line, Area, AreaChart
} from 'recharts';
import { useExpenses, useDebts, useUI } from '../../context';
import { Card, Select, Loading, EmptyState, InstallmentsModal, MonthlyExpensesModal } from '../../components';
import { EXPENSE_CATEGORIES, PAYMENT_SOURCES } from '../../services/expensesService';
import styles from './Statistics.module.css';

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6'];

const Statistics = () => {
  const { expenses, loading: expensesLoading, getMonthlyStats } = useExpenses();
  const { summary, loading: debtsLoading } = useDebts();
  const { siteConfig } = useUI();

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(0); // 0 = todos los meses
  const [monthlyData, setMonthlyData] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);
  
  // Estados para modales
  const [selectedInstallmentExpense, setSelectedInstallmentExpense] = useState(null);
  const [showInstallmentsModal, setShowInstallmentsModal] = useState(false);
  const [selectedMonthData, setSelectedMonthData] = useState(null);
  const [showMonthExpensesModal, setShowMonthExpensesModal] = useState(false);

  const currency = siteConfig?.currency || '$';
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    { value: 0, label: 'Todos los meses' },
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' }
  ];

  // Cargar datos mensuales del año
  useEffect(() => {
    const loadMonthlyData = async () => {
      setStatsLoading(true);
      const months = [];
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      
      for (let month = 1; month <= 12; month++) {
        const stats = await getMonthlyStats(month, selectedYear);
        months.push({
          month: monthNames[month - 1],
          total: stats?.total || 0,
          count: stats?.count || 0,
          byCategory: stats?.by_category || {}
        });
      }
      
      setMonthlyData(months);
      setStatsLoading(false);
    };

    loadMonthlyData();
  }, [selectedYear, getMonthlyStats]);

  // Estadísticas por categoría (año completo o mes filtrado)
  const categoryStats = useMemo(() => {
    const totals = {};
    
    if (selectedMonth === 0) {
      // Todas las categorías del año
      monthlyData.forEach(month => {
        Object.entries(month.byCategory || {}).forEach(([category, amount]) => {
          totals[category] = (totals[category] || 0) + amount;
        });
      });
    } else {
      // Solo el mes seleccionado
      const monthData = monthlyData[selectedMonth - 1];
      if (monthData?.byCategory) {
        Object.entries(monthData.byCategory).forEach(([category, amount]) => {
          totals[category] = amount;
        });
      }
    }

    return Object.entries(totals)
      .map(([category, total]) => ({
        name: EXPENSE_CATEGORIES[category] || category,
        value: total
      }))
      .sort((a, b) => b.value - a.value);
  }, [monthlyData, selectedMonth]);

  // Total anual o mensual
  const total = useMemo(() => {
    if (!monthlyData || monthlyData.length === 0) return 0;
    
    if (selectedMonth === 0) {
      return monthlyData.reduce((sum, month) => sum + month.total, 0);
    } else {
      return monthlyData[selectedMonth - 1]?.total || 0;
    }
  }, [monthlyData, selectedMonth]);

  // Promedio mensual
  const monthlyAverage = useMemo(() => {
    if (!monthlyData || monthlyData.length === 0) return 0;
    
    if (selectedMonth === 0) {
      const monthsWithData = monthlyData.filter(m => m.total > 0).length;
      return monthsWithData > 0 ? total / monthsWithData : 0;
    } else {
      return total; // Si es un mes específico, el promedio es el mismo total
    }
  }, [monthlyData, total, selectedMonth]);

  // Mes con más gastos
  const peakMonth = useMemo(() => {
    if (!monthlyData || monthlyData.length === 0) return null;
    return monthlyData.reduce((max, month) => 
      month.total > (max?.total || 0) ? month : max
    , null);
  }, [monthlyData]);

  // Gastos por fuente de pago (filtrado por año y mes)
  const sourceStats = useMemo(() => {
    const filteredExpenses = expenses.filter(exp => {
      const date = new Date(exp.date);
      const matchesYear = date.getFullYear() === selectedYear;
      const matchesMonth = selectedMonth === 0 || date.getMonth() + 1 === selectedMonth;
      return matchesYear && matchesMonth;
    });

    const totals = {};
    filteredExpenses.forEach(exp => {
      const source = exp.payment_source || 'other';
      totals[source] = (totals[source] || 0) + exp.amount;
    });

    return Object.entries(totals)
      .map(([source, total]) => ({
        name: PAYMENT_SOURCES[source] || source,
        value: total
      }))
      .sort((a, b) => b.value - a.value);
  }, [expenses, selectedYear, selectedMonth]);

  // Gastos con cuotas del año (filtrado por mes si se selecciona)
  const installmentExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const date = new Date(exp.date);
      const matchesYear = date.getFullYear() === selectedYear;
      const matchesMonth = selectedMonth === 0 || date.getMonth() + 1 === selectedMonth;
      return exp.installments > 1 && matchesYear && matchesMonth;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [expenses, selectedYear, selectedMonth]);

  // Handlers para modales
  const handleOpenInstallmentsModal = (expense) => {
    setSelectedInstallmentExpense(expense);
    setShowInstallmentsModal(true);
  };

  const handleCloseInstallmentsModal = () => {
    setShowInstallmentsModal(false);
    setSelectedInstallmentExpense(null);
  };

  const handleOpenMonthModal = (monthData, monthIndex) => {
    setSelectedMonthData({
      monthName: monthData.month,
      monthNumber: monthIndex,
      year: selectedYear
    });
    setShowMonthExpensesModal(true);
  };

  const handleCloseMonthModal = () => {
    setShowMonthExpensesModal(false);
    setSelectedMonthData(null);
  };

  const formatCurrency = (value) => {
    return `${currency}${value.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  };

  if (expensesLoading || debtsLoading) {
    return <Loading size="lg" text="Cargando estadísticas..." />;
  }

  return (
    <div className={styles.statistics}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>Estadísticas</h2>
          <p className={styles.subtitle}>Análisis de tus finanzas</p>
        </div>
        <div className={styles.filters}>
          <Select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            options={months}
          />
          <Select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            options={years.map(y => ({ value: y, label: y.toString() }))}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className={styles.summaryGrid}>
        <Card className={styles.summaryCard}>
          <div className={styles.summaryIcon}>💰</div>
          <div className={styles.summaryContent}>
            <span className={styles.summaryLabel}>
              {selectedMonth === 0 ? 'Total Anual' : 'Total del Mes'}
            </span>
            <span className={styles.summaryValue}>{formatCurrency(total)}</span>
          </div>
        </Card>
        <Card className={styles.summaryCard}>
          <div className={styles.summaryIcon}>📊</div>
          <div className={styles.summaryContent}>
            <span className={styles.summaryLabel}>Promedio Mensual</span>
            <span className={styles.summaryValue}>{formatCurrency(monthlyAverage)}</span>
          </div>
        </Card>
        <Card className={styles.summaryCard}>
          <div className={styles.summaryIcon}>📈</div>
          <div className={styles.summaryContent}>
            <span className={styles.summaryLabel}>Mes Pico</span>
            <span className={styles.summaryValue}>
              {peakMonth?.month || '-'} ({formatCurrency(peakMonth?.total || 0)})
            </span>
          </div>
        </Card>
        <Card className={styles.summaryCard}>
          <div className={styles.summaryIcon}>⚖️</div>
          <div className={styles.summaryContent}>
            <span className={styles.summaryLabel}>Balance Deudas</span>
            <span className={`${styles.summaryValue} ${(summary.owed - summary.owe) >= 0 ? styles.positive : styles.negative}`}>
              {formatCurrency(summary.owed - summary.owe)}
            </span>
          </div>
        </Card>
      </div>

      {statsLoading ? (
        <Loading text="Calculando estadísticas..." />
      ) : (
        <div className={styles.chartsGrid}>
          {/* Gráfico de gastos mensuales */}
          <Card className={styles.chartCard}>
            <h3 className={styles.chartTitle}>📅 Gastos Mensuales {selectedYear}</h3>
            {monthlyData.some(m => m.total > 0) ? (
              <div className={styles.chartContainer}>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={monthlyData} onClick={(data) => {
                    if (data?.activePayload?.[0]) {
                      const monthIndex = monthlyData.findIndex(m => m.month === data.activePayload[0].payload.month);
                      handleOpenMonthModal(data.activePayload[0].payload, monthIndex);
                    }
                  }}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="month" stroke="#9ca3af" style={{ cursor: 'pointer' }} />
                    <YAxis stroke="#9ca3af" tickFormatter={(v) => `${currency}${(v/1000).toFixed(0)}k`} />
                    <Tooltip 
                      formatter={(value) => [formatCurrency(value), 'Total']}
                      contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="total" 
                      stroke="#6366f1" 
                      fill="url(#colorTotal)"
                      strokeWidth={2}
                      style={{ cursor: 'pointer' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <p className={styles.chartHint}>💡 Haz click en un mes para ver detalles</p>
              </div>
            ) : (
              <EmptyState
                icon="📊"
                title="Sin datos"
                description="No hay gastos registrados para este año"
              />
            )}
          </Card>

          {/* Gráfico por categoría */}
          <Card className={styles.chartCard}>
            <h3 className={styles.chartTitle}>🏷️ Por Categoría</h3>
            {categoryStats.length > 0 ? (
              <div className={styles.chartContainer}>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {categoryStats.map((entry, index) => (
                        <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => formatCurrency(value)}
                      contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState icon="🏷️" title="Sin datos" description="No hay categorías" />
            )}
          </Card>

          {/* Top Categorías */}
          <Card className={styles.chartCard}>
            <h3 className={styles.chartTitle}>🏆 Top Categorías</h3>
            {categoryStats.length > 0 ? (
              <div className={styles.topList}>
                {categoryStats.slice(0, 5).map((cat, index) => (
                  <div key={cat.name} className={styles.topItem}>
                    <div className={styles.topRank}>#{index + 1}</div>
                    <div className={styles.topInfo}>
                      <span className={styles.topName}>{cat.name}</span>
                      <div className={styles.topBar}>
                        <div 
                          className={styles.topBarFill}
                          style={{ 
                            width: `${(cat.value / categoryStats[0].value) * 100}%`,
                            background: COLORS[index]
                          }}
                        />
                      </div>
                    </div>
                    <span className={styles.topValue}>{formatCurrency(cat.value)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon="🏆" title="Sin datos" />
            )}
          </Card>

          {/* Por fuente de pago */}
          <Card className={styles.chartCard}>
            <h3 className={styles.chartTitle}>💳 Por Fuente de Pago</h3>
            {sourceStats.length > 0 ? (
              <div className={styles.chartContainer}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={sourceStats} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis type="number" stroke="#9ca3af" tickFormatter={(v) => `${currency}${(v/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" stroke="#9ca3af" width={120} />
                    <Tooltip 
                      formatter={(value) => formatCurrency(value)}
                      contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px' }}
                    />
                    <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState icon="💳" title="Sin datos" description="No hay gastos" />
            )}
          </Card>

          {/* Panel de Cuotas */}
          {installmentExpenses.length > 0 && (
            <Card className={`${styles.chartCard} ${styles.installmentsCard}`}>
              <h3 className={styles.chartTitle}>🔄 Gastos en Cuotas</h3>
              <div className={styles.installmentsList}>
                {installmentExpenses.slice(0, 5).map((exp) => (
                  <div 
                    key={exp.id} 
                    className={styles.installmentItem}
                    onClick={() => handleOpenInstallmentsModal(exp)}
                  >
                    <div className={styles.installmentInfo}>
                      <div className={styles.installmentName}>{exp.description}</div>
                      <div className={styles.installmentMeta}>
                        {exp.installments} cuotas • {formatCurrency(exp.amount)} c/u
                      </div>
                    </div>
                    <div className={styles.installmentTotal}>
                      Total: {formatCurrency(exp.amount * exp.installments)}
                    </div>
                  </div>
                ))}
              </div>
              {installmentExpenses.length > 5 && (
                <div className={styles.showMore}>
                  +{installmentExpenses.length - 5} gastos en cuotas más
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Modales */}
      {selectedInstallmentExpense && (
        <InstallmentsModal
          isOpen={showInstallmentsModal}
          onClose={handleCloseInstallmentsModal}
          expense={selectedInstallmentExpense}
          siteConfig={siteConfig}
        />
      )}
      
      {selectedMonthData && (
        <MonthlyExpensesModal
          isOpen={showMonthExpensesModal}
          onClose={handleCloseMonthModal}
          monthData={selectedMonthData}
          allExpenses={expenses}
          friends={[]}
          virtualFriends={[]}
          siteConfig={siteConfig}
        />
      )}
    </div>
  );
};

export default Statistics;
