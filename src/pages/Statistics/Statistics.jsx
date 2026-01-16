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
import { Card, Select, Loading, EmptyState } from '../../components';
import { EXPENSE_CATEGORIES, PAYMENT_SOURCES } from '../../services/expensesService';
import styles from './Statistics.module.css';

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6'];

const Statistics = () => {
  const { expenses, loading: expensesLoading, getMonthlyStats } = useExpenses();
  const { summary, loading: debtsLoading } = useDebts();
  const { siteConfig } = useUI();

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [monthlyData, setMonthlyData] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);

  const currency = siteConfig?.currency || '$';
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

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

  // Estadísticas por categoría (año completo)
  const categoryStats = useMemo(() => {
    const totals = {};
    
    monthlyData.forEach(month => {
      Object.entries(month.byCategory || {}).forEach(([category, amount]) => {
        totals[category] = (totals[category] || 0) + amount;
      });
    });

    return Object.entries(totals)
      .map(([category, total]) => ({
        name: EXPENSE_CATEGORIES[category] || category,
        value: total
      }))
      .sort((a, b) => b.value - a.value);
  }, [monthlyData]);

  // Total anual
  const annualTotal = useMemo(() => {
    return monthlyData.reduce((sum, month) => sum + month.total, 0);
  }, [monthlyData]);

  // Promedio mensual
  const monthlyAverage = useMemo(() => {
    const monthsWithData = monthlyData.filter(m => m.total > 0).length;
    return monthsWithData > 0 ? annualTotal / monthsWithData : 0;
  }, [monthlyData, annualTotal]);

  // Mes con más gastos
  const peakMonth = useMemo(() => {
    return monthlyData.reduce((max, month) => 
      month.total > (max?.total || 0) ? month : max
    , null);
  }, [monthlyData]);

  // Gastos por fuente de pago
  const sourceStats = useMemo(() => {
    const filteredExpenses = expenses.filter(exp => {
      const date = new Date(exp.date);
      return date.getFullYear() === selectedYear;
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
  }, [expenses, selectedYear]);

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
        <Select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          options={years.map(y => ({ value: y, label: y.toString() }))}
        />
      </div>

      {/* Summary Cards */}
      <div className={styles.summaryGrid}>
        <Card className={styles.summaryCard}>
          <div className={styles.summaryIcon}>💰</div>
          <div className={styles.summaryContent}>
            <span className={styles.summaryLabel}>Total Anual</span>
            <span className={styles.summaryValue}>{formatCurrency(annualTotal)}</span>
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
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="month" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" tickFormatter={(v) => `${currency}${(v/1000).toFixed(0)}k`} />
                    <Tooltip 
                      formatter={(value) => [formatCurrency(value), 'Total']}
                      contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="total" 
                      stroke="#6366f1" 
                      fill="url(#colorTotal)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
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
        </div>
      )}
    </div>
  );
};

export default Statistics;
