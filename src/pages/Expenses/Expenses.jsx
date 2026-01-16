/**
 * Expenses Page - Gestión de gastos
 */
import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth, useExpenses, useFriends, useUI } from '../../context';
import { Button, Card, Input, Select, Modal, Loading, EmptyState } from '../../components';
import virtualFriendsService from '../../services/virtualFriendsService';
import styles from './Expenses.module.css';

const Expenses = () => {
  const { user, profile } = useAuth();
  const { 
    expenses, 
    monthlyStats, 
    loading, 
    categories, 
    paymentSources,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
    createExpense,
    markAsPaid,
    deleteExpense
  } = useExpenses();
  const { friends } = useFriends();
  const { showSuccess, showError, siteConfig } = useUI();
  const location = useLocation();

  const [showModal, setShowModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPaid, setFilterPaid] = useState('');
  
  // Amigos virtuales
  const [virtualFriends, setVirtualFriends] = useState([]);
  const [showNewFriendModal, setShowNewFriendModal] = useState(false);
  const [newFriendType, setNewFriendType] = useState(null);
  const [newVirtualFriend, setNewVirtualFriend] = useState({ name: '', email: '', phone: '' });
  
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    category: '',
    paymentSource: '',
    friendId: '',
    friendType: 'real', // 'real' | 'virtual'
    date: new Date().toISOString().split('T')[0],
    isPaid: false,
    installments: 1,
    customInstallments: ''
  });

  // Cargar amigos virtuales
  useEffect(() => {
    const loadVirtualFriends = async () => {
      if (!user) return;
      const result = await virtualFriendsService.getVirtualFriends(user.id);
      if (!result.error) {
        setVirtualFriends(result.friends || []);
      }
    };
    loadVirtualFriends();
  }, [user]);

  // Abrir modal si viene desde navegación
  useEffect(() => {
    if (location.state?.openNew) {
      setShowModal(true);
      // Limpiar el estado de navegación
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const currency = siteConfig?.currency || '$';
  const formatCurrency = (amount) => {
    return `${currency}${amount.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Crear amigo virtual
  const handleCreateVirtualFriend = async () => {
    if (!newVirtualFriend.name.trim()) {
      showError('El nombre es obligatorio');
      return;
    }

    const result = await virtualFriendsService.createVirtualFriend(user.id, newVirtualFriend);
    if (!result.error) {
      setVirtualFriends(prev => [...prev, result.friend]);
      setFormData(prev => ({ ...prev, friendId: result.friend.id, friendType: 'virtual' }));
      setShowNewFriendModal(false);
      setNewFriendType(null);
      setNewVirtualFriend({ name: '', email: '', phone: '' });
      showSuccess('Contacto agregado');
    } else {
      showError('Error al crear contacto');
    }
  };

  // Abrir modal para nuevo amigo
  const openNewFriendModal = () => {
    setNewFriendType(null);
    setShowNewFriendModal(true);
  };

  // Cerrar modal de nuevo amigo
  const closeNewFriendModal = () => {
    setShowNewFriendModal(false);
    setNewFriendType(null);
    setNewVirtualFriend({ name: '', email: '', phone: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);

    const installments = formData.installments === 'custom' 
      ? parseInt(formData.customInstallments) || 1
      : parseInt(formData.installments);

    const result = await createExpense({
      amount: parseFloat(formData.amount) / installments,
      description: formData.description,
      category: formData.category,
      paymentSource: formData.paymentSource,
      friendId: formData.paymentSource === 'friend' ? formData.friendId : null,
      friendType: formData.friendType,
      date: formData.date,
      isPaid: formData.isPaid,
      installments
    });

    setFormLoading(false);

    if (result.success) {
      showSuccess('Gasto creado exitosamente');
      setShowModal(false);
      resetForm();
    } else {
      showError('Error al crear el gasto');
    }
  };

  const resetForm = () => {
    setFormData({
      amount: '',
      description: '',
      category: '',
      paymentSource: '',
      friendId: '',
      friendType: 'real',
      date: new Date().toISOString().split('T')[0],
      isPaid: false,
      installments: 1,
      customInstallments: ''
    });
  };

  const handleMarkAsPaid = async (expenseId) => {
    const result = await markAsPaid(expenseId);
    if (result.success) {
      showSuccess('Gasto marcado como pagado');
    } else {
      showError('Error al actualizar el gasto');
    }
  };

  const handleDelete = async (expenseId) => {
    if (window.confirm('¿Estás seguro de eliminar este gasto?')) {
      const result = await deleteExpense(expenseId);
      if (result.success) {
        showSuccess('Gasto eliminado');
      } else {
        showError('Error al eliminar el gasto');
      }
    }
  };

  // Filtrar gastos
  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      if (filterCategory && expense.category !== filterCategory) return false;
      if (filterPaid === 'paid' && !expense.is_paid) return false;
      if (filterPaid === 'pending' && expense.is_paid) return false;
      return true;
    });
  }, [expenses, filterCategory, filterPaid]);

  // Calcular cuota
  const installmentAmount = useMemo(() => {
    if (!formData.amount) return 0;
    const installments = formData.installments === 'custom'
      ? parseInt(formData.customInstallments) || 1
      : parseInt(formData.installments);
    return parseFloat(formData.amount) / installments;
  }, [formData.amount, formData.installments, formData.customInstallments]);

  const months = [
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

  if (loading) {
    return <Loading size="lg" text="Cargando gastos..." />;
  }

  return (
    <div className={styles.expenses}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>Mis Gastos</h2>
          <p className={styles.subtitle}>
            Total del mes: <strong>{formatCurrency(monthlyStats?.totalSpent || 0)}</strong>
          </p>
        </div>
        <Button icon="➕" onClick={() => setShowModal(true)}>
          Nuevo Gasto
        </Button>
      </div>

      {/* Filtros */}
      <div className={styles.filters}>
        <div className={styles.dateFilters}>
          <Select
            options={months}
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            placeholder="Mes"
          />
          <Select
            options={[
              { value: 2024, label: '2024' },
              { value: 2025, label: '2025' },
              { value: 2026, label: '2026' }
            ]}
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            placeholder="Año"
          />
        </div>
        <div className={styles.typeFilters}>
          <Select
            options={categories.map(c => ({ value: c.id, label: `${c.icon} ${c.label}` }))}
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            placeholder="Todas las categorías"
          />
          <Select
            options={[
              { value: 'paid', label: '✅ Pagados' },
              { value: 'pending', label: '⏳ Pendientes' }
            ]}
            value={filterPaid}
            onChange={(e) => setFilterPaid(e.target.value)}
            placeholder="Todos los estados"
          />
        </div>
      </div>

      {/* Lista de gastos */}
      {filteredExpenses.length > 0 ? (
        <Card>
          <div className={styles.expensesList}>
            {filteredExpenses.map((expense) => {
              const category = categories.find(c => c.id === expense.category);
              return (
                <div key={expense.id} className={styles.expenseItem}>
                  <div className={styles.expenseIcon}>
                    {category?.icon || '📦'}
                  </div>
                  <div className={styles.expenseInfo}>
                    <div className={styles.expenseDesc}>{expense.description}</div>
                    <div className={styles.expenseMeta}>
                      <span>{new Date(expense.date).toLocaleDateString('es-AR')}</span>
                      <span>•</span>
                      <span>{category?.label || expense.category}</span>
                      {expense.installments > 1 && (
                        <>
                          <span>•</span>
                          <span className={styles.installmentBadge}>
                            Cuota {expense.current_installment}/{expense.installments}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className={styles.expenseRight}>
                    <div className={styles.expenseAmount}>
                      {formatCurrency(expense.amount)}
                    </div>
                    <div className={styles.expenseActions}>
                      {!expense.is_paid && (
                        <button 
                          className={styles.actionBtn}
                          onClick={() => handleMarkAsPaid(expense.id)}
                          title="Marcar como pagado"
                        >
                          ✓
                        </button>
                      )}
                      <button 
                        className={`${styles.actionBtn} ${styles.deleteBtn}`}
                        onClick={() => handleDelete(expense.id)}
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <div className={`${styles.expenseStatus} ${expense.is_paid ? styles.paid : styles.pending}`}>
                    {expense.is_paid ? '✓ Pagado' : '⏳ Pendiente'}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon="💸"
            title="Sin gastos"
            description="No hay gastos registrados para este período"
            action="Agregar gasto"
            onAction={() => setShowModal(true)}
          />
        </Card>
      )}

      {/* Modal de nuevo gasto */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Nuevo Gasto"
        size="md"
      >
        <form className={styles.form} onSubmit={handleSubmit}>
          <Input
            label="Monto Total"
            type="number"
            name="amount"
            placeholder="0.00"
            value={formData.amount}
            onChange={handleChange}
            icon="💰"
            required
          />

          <Input
            label="Descripción"
            name="description"
            placeholder="Descripción del gasto"
            value={formData.description}
            onChange={handleChange}
            required
          />

          <Select
            label="Categoría"
            name="category"
            options={categories.map(c => ({ value: c.id, label: `${c.icon} ${c.label}` }))}
            value={formData.category}
            onChange={handleChange}
            required
          />

          <Select
            label="Fuente de Pago"
            name="paymentSource"
            options={paymentSources.map(s => ({ value: s.id, label: `${s.icon} ${s.label}` }))}
            value={formData.paymentSource}
            onChange={handleChange}
            required
          />

          {formData.paymentSource === 'friend' && (
            <div className={styles.friendSelector}>
              <label className={styles.label}>Amigo</label>
              <div className={styles.selectWithButton}>
                <select
                  name="friendId"
                  value={formData.friendType === 'virtual' ? `virtual_${formData.friendId}` : formData.friendId}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (!value) {
                      setFormData(prev => ({ ...prev, friendId: '', friendType: 'real' }));
                      return;
                    }
                    const isVirtual = value.startsWith('virtual_');
                    setFormData(prev => ({
                      ...prev,
                      friendId: isVirtual ? value.replace('virtual_', '') : value,
                      friendType: isVirtual ? 'virtual' : 'real'
                    }));
                  }}
                  className={styles.select}
                  required
                >
                  <option value="">Selecciona un amigo</option>
                  
                  {friends && friends.length > 0 && (
                    <optgroup label="👥 Amigos con cuenta">
                      {friends.map(f => (
                        <option key={f.friend?.id || f.friendshipId} value={f.friend?.id}>
                          {f.friend?.first_name || 'Sin nombre'} {f.friend?.last_name || ''} (@{f.friend?.nickname || 'usuario'})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  
                  {virtualFriends && virtualFriends.length > 0 && (
                    <optgroup label="📇 Mis contactos">
                      {virtualFriends.map(vf => (
                        <option key={vf.id} value={`virtual_${vf.id}`}>
                          {vf.name} {vf.phone ? `(${vf.phone})` : ''} ⭐
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                
                <button
                  type="button"
                  className={styles.addFriendBtn}
                  onClick={openNewFriendModal}
                  title="Agregar nuevo amigo"
                >
                  ➕
                </button>
              </div>
              
              {(!friends || friends.length === 0) && (!virtualFriends || virtualFriends.length === 0) && (
                <p className={styles.noFriendsHint}>
                  No tienes amigos agregados. <button type="button" onClick={openNewFriendModal} className={styles.linkBtn}>Agrega uno</button>
                </p>
              )}
            </div>
          )}

          <Input
            label="Fecha"
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
          />

          <div className={styles.installmentsSection}>
            <label className={styles.label}>Cuotas</label>
            <div className={styles.installmentOptions}>
              {[1, 3, 6, 12].map(num => (
                <button
                  key={num}
                  type="button"
                  className={`${styles.installmentBtn} ${formData.installments === num ? styles.active : ''}`}
                  onClick={() => setFormData(prev => ({ ...prev, installments: num }))}
                >
                  {num === 1 ? 'Contado' : `${num} cuotas`}
                </button>
              ))}
              <button
                type="button"
                className={`${styles.installmentBtn} ${formData.installments === 'custom' ? styles.active : ''}`}
                onClick={() => setFormData(prev => ({ ...prev, installments: 'custom' }))}
              >
                Otro
              </button>
            </div>
            {formData.installments === 'custom' && (
              <Input
                type="number"
                name="customInstallments"
                placeholder="Número de cuotas"
                value={formData.customInstallments}
                onChange={handleChange}
                min="2"
              />
            )}
            {(formData.installments > 1 || formData.installments === 'custom') && formData.amount && (
              <div className={styles.installmentPreview}>
                Valor por cuota: <strong>{formatCurrency(installmentAmount)}</strong>
              </div>
            )}
          </div>

          <label className={styles.checkbox}>
            <input
              type="checkbox"
              name="isPaid"
              checked={formData.isPaid}
              onChange={handleChange}
            />
            <span>Ya está pagado</span>
          </label>

          <div className={styles.formActions}>
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={formLoading}>
              Guardar Gasto
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal para agregar nuevo amigo */}
      <Modal
        isOpen={showNewFriendModal}
        onClose={closeNewFriendModal}
        title={newFriendType === null ? "Nuevo Amigo" : (newFriendType === 'virtual' ? "Nuevo Contacto Ficticio" : "Agregar Amigo Real")}
        size="sm"
      >
        <div className={styles.friendForm}>
          {/* Paso 1: Seleccionar tipo */}
          {newFriendType === null && (
            <>
              <p className={styles.formHint}>
                ¿Qué tipo de amigo quieres agregar?
              </p>
              <div className={styles.friendTypeButtons}>
                <button
                  type="button"
                  className={styles.friendTypeBtn}
                  onClick={() => setNewFriendType('virtual')}
                >
                  <span className={styles.friendTypeIcon}>📇</span>
                  <span className={styles.friendTypeLabel}>Contacto Ficticio</span>
                  <span className={styles.friendTypeDesc}>Para personas sin cuenta en la app</span>
                </button>
                <button
                  type="button"
                  className={styles.friendTypeBtn}
                  onClick={() => setNewFriendType('real')}
                >
                  <span className={styles.friendTypeIcon}>👤</span>
                  <span className={styles.friendTypeLabel}>Amigo Real</span>
                  <span className={styles.friendTypeDesc}>Buscar por nickname de usuario</span>
                </button>
              </div>
            </>
          )}

          {/* Paso 2a: Crear contacto ficticio */}
          {newFriendType === 'virtual' && (
            <>
              <p className={styles.formHint}>
                Crea un contacto para personas que no tienen cuenta en la app.
              </p>
              <Input
                label="Nombre *"
                placeholder="Nombre del contacto"
                value={newVirtualFriend.name}
                onChange={(e) => setNewVirtualFriend(prev => ({ ...prev, name: e.target.value }))}
                required
              />
              <Input
                label="Teléfono"
                placeholder="Número de teléfono (opcional)"
                value={newVirtualFriend.phone}
                onChange={(e) => setNewVirtualFriend(prev => ({ ...prev, phone: e.target.value }))}
              />
              <Input
                label="Email"
                type="email"
                placeholder="Email (opcional)"
                value={newVirtualFriend.email}
                onChange={(e) => setNewVirtualFriend(prev => ({ ...prev, email: e.target.value }))}
              />
              <div className={styles.formActions}>
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={() => setNewFriendType(null)}
                >
                  ← Volver
                </Button>
                <Button onClick={handleCreateVirtualFriend}>
                  Crear Contacto
                </Button>
              </div>
            </>
          )}

          {/* Paso 2b: Ir a agregar amigo real */}
          {newFriendType === 'real' && (
            <>
              <p className={styles.formHint}>
                Los amigos reales deben agregarse desde la sección de Amigos.
              </p>
              <div className={styles.formActions}>
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={() => setNewFriendType(null)}
                >
                  ← Volver
                </Button>
                <Button onClick={() => { closeNewFriendModal(); window.location.href = '/friends'; }}>
                  Ir a Amigos
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Expenses;
