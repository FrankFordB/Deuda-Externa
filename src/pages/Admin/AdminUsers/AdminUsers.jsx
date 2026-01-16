/**
 * Admin Users - Gestión de usuarios
 */
import { useState, useEffect, useMemo } from 'react';
import { useUI } from '../../../context';
import { adminService } from '../../../services';
import { Button, Card, Input, Modal, Select, Loading, EmptyState } from '../../../components';
import styles from './AdminUsers.module.css';

const AdminUsers = () => {
  const { showSuccess, showError } = useUI();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const result = await adminService.getAllUsers();
    if (result.success) {
      setUsers(result.users || []);
    }
    setLoading(false);
  };

  // Filtrar usuarios
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = !searchQuery || 
        user.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.nickname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCountry = !filterCountry || user.country === filterCountry;

      return matchesSearch && matchesCountry;
    });
  }, [users, searchQuery, filterCountry]);

  // Países únicos para el filtro
  const countries = [...new Set(users.map(u => u.country).filter(Boolean))];

  const handleEdit = (user) => {
    setSelectedUser({
      ...user,
      is_active: user.is_active !== false,
      is_superadmin: user.is_superadmin || false
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await adminService.updateUser(selectedUser.id, {
      first_name: selectedUser.first_name,
      last_name: selectedUser.last_name,
      country: selectedUser.country,
      is_superadmin: selectedUser.is_superadmin,
      is_active: selectedUser.is_active
    });
    setSaving(false);

    if (result.success) {
      showSuccess('Usuario actualizado');
      setShowModal(false);
      loadUsers();
    } else {
      showError('Error al actualizar usuario');
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('¿Estás seguro de eliminar este usuario? Esta acción es irreversible.')) {
      return;
    }

    const result = await adminService.deleteUser(userId);
    if (result.success) {
      showSuccess('Usuario eliminado');
      loadUsers();
    } else {
      showError('Error al eliminar usuario');
    }
  };

  const handleToggleAdmin = async (user) => {
    const result = await adminService.updateUser(user.id, {
      is_superadmin: !user.is_superadmin
    });

    if (result.success) {
      showSuccess(user.is_superadmin ? 'Privilegios de admin removidos' : 'Usuario promovido a admin');
      loadUsers();
    } else {
      showError('Error al actualizar usuario');
    }
  };

  if (loading) {
    return <Loading size="lg" text="Cargando usuarios..." />;
  }

  return (
    <div className={styles.adminUsers}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Gestión de Usuarios</h2>
          <p className={styles.subtitle}>{users.length} usuarios registrados</p>
        </div>
      </div>

      {/* Filters */}
      <Card className={styles.filters}>
        <div className={styles.filterRow}>
          <Input
            placeholder="Buscar por nombre, nickname o email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon="🔍"
          />
          <Select
            value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value)}
            options={[
              { value: '', label: 'Todos los países' },
              ...countries.map(c => ({ value: c, label: c }))
            ]}
          />
        </div>
      </Card>

      {/* Users Table */}
      <Card>
        {filteredUsers.length > 0 ? (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Nickname</th>
                  <th>Email</th>
                  <th>País</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Registro</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div className={styles.userCell}>
                        <div className={styles.userAvatar}>
                          {user.first_name?.[0]}{user.last_name?.[0]}
                        </div>
                        <span>{user.first_name} {user.last_name}</span>
                      </div>
                    </td>
                    <td className={styles.nickname}>@{user.nickname}</td>
                    <td>{user.email}</td>
                    <td>{user.country || '-'}</td>
                    <td>
                      <span className={`${styles.roleBadge} ${user.is_superadmin ? styles.admin : styles.user}`}>
                        {user.is_superadmin ? '👑 Admin' : '👤 Usuario'}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${user.is_active !== false ? styles.active : styles.inactive}`}>
                        {user.is_active !== false ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>{new Date(user.created_at).toLocaleDateString('es-AR')}</td>
                    <td>
                      <div className={styles.actions}>
                        <button 
                          className={styles.actionBtn} 
                          onClick={() => handleEdit(user)}
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button 
                          className={styles.actionBtn} 
                          onClick={() => handleToggleAdmin(user)}
                          title={user.is_superadmin ? 'Quitar admin' : 'Hacer admin'}
                        >
                          {user.is_superadmin ? '👤' : '👑'}
                        </button>
                        <button 
                          className={`${styles.actionBtn} ${styles.danger}`} 
                          onClick={() => handleDelete(user.id)}
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="👥"
            title="Sin usuarios"
            description="No se encontraron usuarios con los filtros aplicados"
          />
        )}
      </Card>

      {/* Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Editar Usuario"
        size="md"
      >
        {selectedUser && (
          <div className={styles.form}>
            <div className={styles.formRow}>
              <Input
                label="Nombre"
                value={selectedUser.first_name}
                onChange={(e) => setSelectedUser(prev => ({ ...prev, first_name: e.target.value }))}
              />
              <Input
                label="Apellido"
                value={selectedUser.last_name}
                onChange={(e) => setSelectedUser(prev => ({ ...prev, last_name: e.target.value }))}
              />
            </div>

            <Input
              label="Email"
              value={selectedUser.email}
              disabled
            />

            <Input
              label="Nickname"
              value={selectedUser.nickname}
              disabled
            />

            <Select
              label="País"
              value={selectedUser.country || ''}
              onChange={(e) => setSelectedUser(prev => ({ ...prev, country: e.target.value }))}
              options={[
                { value: '', label: 'No especificado' },
                { value: 'AR', label: '🇦🇷 Argentina' },
                { value: 'CL', label: '🇨🇱 Chile' },
                { value: 'UY', label: '🇺🇾 Uruguay' },
                { value: 'MX', label: '🇲🇽 México' },
                { value: 'ES', label: '🇪🇸 España' },
                { value: 'US', label: '🇺🇸 Estados Unidos' },
                { value: 'OTHER', label: '🌍 Otro' }
              ]}
            />

            <div className={styles.toggleGroup}>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={selectedUser.is_superadmin}
                  onChange={(e) => setSelectedUser(prev => ({ ...prev, is_superadmin: e.target.checked }))}
                />
                <span>Super Admin</span>
              </label>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={selectedUser.is_active}
                  onChange={(e) => setSelectedUser(prev => ({ ...prev, is_active: e.target.checked }))}
                />
                <span>Usuario Activo</span>
              </label>
            </div>

            <div className={styles.formActions}>
              <Button variant="ghost" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} loading={saving}>
                Guardar Cambios
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminUsers;
