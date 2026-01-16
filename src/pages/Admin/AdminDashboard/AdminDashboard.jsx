/**
 * Admin Dashboard - Panel principal de administración
 */
import { useState, useEffect } from 'react';
import { useAuth, useUI } from '../../../context';
import { adminService } from '../../../services';
import { Card, Loading, StatCard } from '../../../components';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import styles from './AdminDashboard.module.css';

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'];

const AdminDashboard = () => {
  const { profile } = useAuth();
  const { siteConfig } = useUI();

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const currency = siteConfig?.currency || '$';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    
    const [usersResult, statsResult] = await Promise.all([
      adminService.getAllUsers(),
      adminService.getSystemStats()
    ]);

    if (usersResult.success) {
      setUsers(usersResult.users || []);
    }

    if (statsResult.success) {
      setStats(statsResult.stats);
    }

    setLoading(false);
  };

  // Estadísticas de usuarios por mes
  const usersByMonth = users.reduce((acc, user) => {
    const date = new Date(user.created_at);
    const month = date.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
    acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {});

  const userChartData = Object.entries(usersByMonth).map(([month, count]) => ({
    month,
    usuarios: count
  }));

  // Usuarios por país
  const usersByCountry = users.reduce((acc, user) => {
    const country = user.country || 'No especificado';
    acc[country] = (acc[country] || 0) + 1;
    return acc;
  }, {});

  const countryChartData = Object.entries(usersByCountry)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Usuarios recientes
  const recentUsers = [...users]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  if (loading) {
    return <Loading size="lg" text="Cargando panel de administración..." />;
  }

  return (
    <div className={styles.dashboard}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Panel de Administración</h2>
          <p className={styles.subtitle}>Bienvenido, {profile?.first_name}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <StatCard
          title="Total Usuarios"
          value={users.length}
          icon="👥"
          trend={users.filter(u => {
            const date = new Date(u.created_at);
            const now = new Date();
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
          }).length}
          trendLabel="este mes"
        />
        <StatCard
          title="Usuarios Activos"
          value={users.filter(u => u.is_active !== false).length}
          icon="✅"
          color="success"
        />
        <StatCard
          title="Super Admins"
          value={users.filter(u => u.is_superadmin).length}
          icon="👑"
          color="warning"
        />
        <StatCard
          title="Total Gastos"
          value={stats?.totalExpenses || 0}
          icon="💰"
          color="primary"
        />
      </div>

      {/* Charts Row */}
      <div className={styles.chartsRow}>
        <Card className={styles.chartCard}>
          <h3 className={styles.cardTitle}>📈 Registros por Mes</h3>
          {userChartData.length > 0 ? (
            <div className={styles.chartContainer}>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={userChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip 
                    contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px' }}
                  />
                  <Bar dataKey="usuarios" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className={styles.noData}>Sin datos</p>
          )}
        </Card>

        <Card className={styles.chartCard}>
          <h3 className={styles.cardTitle}>🌍 Usuarios por País</h3>
          {countryChartData.length > 0 ? (
            <div className={styles.chartContainer}>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={countryChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {countryChartData.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className={styles.noData}>Sin datos</p>
          )}
        </Card>
      </div>

      {/* Recent Users */}
      <Card>
        <h3 className={styles.cardTitle}>👤 Usuarios Recientes</h3>
        <div className={styles.usersList}>
          {recentUsers.map(user => (
            <div key={user.id} className={styles.userItem}>
              <div className={styles.userAvatar}>
                {user.first_name?.[0]}{user.last_name?.[0]}
              </div>
              <div className={styles.userInfo}>
                <div className={styles.userName}>
                  {user.first_name} {user.last_name}
                  {user.is_superadmin && <span className={styles.adminBadge}>👑</span>}
                </div>
                <div className={styles.userMeta}>
                  <span>@{user.nickname}</span>
                  <span>•</span>
                  <span>{user.email}</span>
                </div>
              </div>
              <div className={styles.userDate}>
                {new Date(user.created_at).toLocaleDateString('es-AR')}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default AdminDashboard;
