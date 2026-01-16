/**
 * Debts Page - Gestión de deudas entre amigos
 */
import { useState, useEffect } from 'react';
import { useAuth, useDebts, useFriends, useUI, useNotifications } from '../../context';
import { Button, Card, Input, Select, Modal, Loading, EmptyState } from '../../components';
import virtualFriendsService from '../../services/virtualFriendsService';
import debtsService from '../../services/debtsService';
import styles from './Debts.module.css';

const Debts = () => {
  const { user, profile } = useAuth();
  const { 
    debtsAsCreditor, 
    debtsAsDebtor, 
    pendingDebts,
    summary,
    loading,
    createDebt,
    acceptDebt,
    rejectDebt,
    markAsPaid
  } = useDebts();
  const { friends } = useFriends();
  const { showSuccess, showError, siteConfig } = useUI();
  const { requestPaymentConfirmation } = useNotifications();

  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [debtInstallments, setDebtInstallments] = useState([]);
  const [loadingInstallments, setLoadingInstallments] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const [confirmingPayment, setConfirmingPayment] = useState(null);
  
  // Amigos virtuales
  const [virtualFriends, setVirtualFriends] = useState([]);
  const [showNewFriendModal, setShowNewFriendModal] = useState(false);
  const [newFriendType, setNewFriendType] = useState(null); // 'real' | 'virtual' | null (selector)
  const [newVirtualFriend, setNewVirtualFriend] = useState({ name: '', email: '', phone: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    debtorId: '',
    debtorType: 'real', // 'real' | 'virtual'
    amount: '',
    description: '',
    category: 'other',
    installments: 1,
    purchaseDate: '', // Fecha de compra (opcional)
    dueDate: '' // Fecha de vencimiento del primer pago
  });

  // Cargar amigos virtuales
  useEffect(() => {
    const loadVirtualFriends = async () => {
      if (!user) return;
      const result = await virtualFriendsService.getVirtualFriends(user.id);
      if (!result.error) {
        setVirtualFriends(result.friends);
      }
    };
    loadVirtualFriends();
  }, [user]);

  // Ver detalle de una deuda (cargar cuotas)
  const handleViewDebtDetail = async (debt) => {
    setSelectedDebt(debt);
    setShowDetailModal(true);
    
    if (debt.installments > 1) {
      setLoadingInstallments(true);
      const result = await debtsService.getDebtInstallments(debt.id);
      setDebtInstallments(result.installments || []);
      setLoadingInstallments(false);
    } else {
      setDebtInstallments([]);
    }
  };

  // Marcar una cuota como pagada
  const handleMarkInstallmentPaid = async (installmentId) => {
    const result = await debtsService.markInstallmentAsPaid(installmentId);
    if (!result.error) {
      showSuccess('Cuota marcada como pagada');
      // Recargar cuotas
      if (selectedDebt) {
        const refreshed = await debtsService.getDebtInstallments(selectedDebt.id);
        setDebtInstallments(refreshed.installments || []);
      }
    } else {
      showError('Error al marcar la cuota');
    }
  };

  // Formatear fecha
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-AR', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  // Verificar si una fecha ya venció
  const isOverdue = (dateStr) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  const currency = siteConfig?.currency || '$';
  const formatCurrency = (amount) => {
    return `${currency}${amount.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);

    const result = await createDebt({
      debtorId: formData.debtorId,
      debtorType: formData.debtorType,
      amount: parseFloat(formData.amount),
      description: formData.description,
      category: formData.category,
      installments: parseInt(formData.installments) || 1,
      purchaseDate: formData.purchaseDate || null,
      dueDate: formData.dueDate || null
    });

    setFormLoading(false);

    if (result.success) {
      showSuccess('Deuda registrada exitosamente');
      setShowModal(false);
      setFormData({ 
        debtorId: '', 
        debtorType: 'real', 
        amount: '', 
        description: '', 
        category: 'other',
        installments: 1,
        purchaseDate: '',
        dueDate: ''
      });
    } else {
      showError('Error al registrar la deuda');
    }
  };

  const handleAccept = async (debtId) => {
    const result = await acceptDebt(debtId);
    if (result.success) {
      showSuccess('Deuda aceptada y agregada a tus gastos');
    } else {
      showError('Error al aceptar la deuda');
    }
  };

  const handleReject = async (debtId) => {
    if (window.confirm('¿Estás seguro de rechazar esta deuda?')) {
      const result = await rejectDebt(debtId);
      if (result.success) {
        showSuccess('Deuda rechazada');
      } else {
        showError('Error al rechazar la deuda');
      }
    }
  };

  // Solicitar confirmación de pago al acreedor
  const handleRequestPaymentConfirmation = async (debt) => {
    setConfirmingPayment(debt.id);
    
    const result = await requestPaymentConfirmation(debt.id, debt.creditor_id);
    
    if (!result.error) {
      showSuccess('Solicitud enviada. Tu amigo recibirá una notificación para confirmar.');
    } else {
      showError('Error al enviar solicitud');
    }
    
    setConfirmingPayment(null);
  };

  // Marcar como pagado (para deudas con amigos virtuales)
  const handleMarkPaid = async (debtId) => {
    const result = await markAsPaid(debtId);
    if (result.success) {
      showSuccess('Deuda marcada como pagada');
    } else {
      showError('Error al actualizar la deuda');
    }
  };

  // Buscar amigos reales
  const handleSearchFriend = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    // Usamos el contexto de friends
    const result = await fetch(`/api/search?q=${searchQuery}`).catch(() => ({ users: [] }));
    setSearchResults(result.users || []);
    setSearchLoading(false);
  };

  // Crear amigo virtual rápido
  const handleCreateVirtualFriend = async () => {
    if (!newVirtualFriend.name.trim()) {
      showError('El nombre es obligatorio');
      return;
    }

    const result = await virtualFriendsService.createVirtualFriend(user.id, newVirtualFriend);
    if (!result.error) {
      setVirtualFriends(prev => [...prev, result.friend]);
      setFormData(prev => ({ ...prev, debtorId: result.friend.id, debtorType: 'virtual' }));
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
    setSearchQuery('');
    setSearchResults([]);
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { label: '⏳ Pendiente', class: 'pending' },
      accepted: { label: '✅ Aceptada', class: 'accepted' },
      rejected: { label: '❌ Rechazada', class: 'rejected' },
      paid: { label: '💰 Pagada', class: 'paid' }
    };
    return badges[status] || badges.pending;
  };

  if (loading) {
    return <Loading size="lg" text="Cargando deudas..." />;
  }

  return (
    <div className={styles.debts}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>Deudas</h2>
          <p className={styles.subtitle}>
            Gestiona las deudas con tus amigos
          </p>
        </div>
        <Button icon="➕" onClick={() => setShowModal(true)}>
          Nueva Deuda
        </Button>
      </div>

      {/* Resumen */}
      <div className={styles.summaryGrid}>
        <Card variant="success">
          <div className={styles.summaryItem}>
            <span className={styles.summaryIcon}>💰</span>
            <div>
              <div className={styles.summaryValue}>{formatCurrency(summary?.totalOwedToMe || 0)}</div>
              <div className={styles.summaryLabel}>Me deben</div>
            </div>
          </div>
        </Card>
        <Card variant="warning">
          <div className={styles.summaryItem}>
            <span className={styles.summaryIcon}>💸</span>
            <div>
              <div className={styles.summaryValue}>{formatCurrency(summary?.totalIOwe || 0)}</div>
              <div className={styles.summaryLabel}>Yo debo</div>
            </div>
          </div>
        </Card>
        <Card variant={summary?.netBalance >= 0 ? 'gradient' : 'dark'}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryIcon}>📊</span>
            <div>
              <div className={styles.summaryValue}>{formatCurrency(summary?.netBalance || 0)}</div>
              <div className={styles.summaryLabel}>Balance Neto</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'pending' ? styles.active : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pendientes de Aceptar
          {pendingDebts.length > 0 && (
            <span className={styles.tabBadge}>{pendingDebts.length}</span>
          )}
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'owe' ? styles.active : ''}`}
          onClick={() => setActiveTab('owe')}
        >
          Lo que Debo
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'owed' ? styles.active : ''}`}
          onClick={() => setActiveTab('owed')}
        >
          Me Deben
        </button>
      </div>

      {/* Content */}
      <Card>
        {activeTab === 'pending' && (
          pendingDebts.length > 0 ? (
            <div className={styles.debtsList}>
              {pendingDebts.map((debt) => (
                <div key={debt.id} className={styles.debtItem}>
                  <div className={styles.debtInfo}>
                    <div className={styles.debtAvatar}>
                      {debt.creditor?.first_name?.[0]}{debt.creditor?.last_name?.[0]}
                    </div>
                    <div>
                      <div className={styles.debtName}>
                        {debt.creditor?.first_name} {debt.creditor?.last_name}
                      </div>
                      <div className={styles.debtNickname}>@{debt.creditor?.nickname}</div>
                      <div className={styles.debtDesc}>{debt.description}</div>
                    </div>
                  </div>
                  <div className={styles.debtRight}>
                    <div className={styles.debtAmount}>{formatCurrency(debt.amount)}</div>
                    <div className={styles.debtActions}>
                      <Button 
                        size="sm" 
                        variant="success"
                        onClick={() => handleAccept(debt.id)}
                      >
                        Aceptar
                      </Button>
                      <Button 
                        size="sm" 
                        variant="danger"
                        onClick={() => handleReject(debt.id)}
                      >
                        Rechazar
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="✅"
              title="Sin deudas pendientes"
              description="No tienes deudas pendientes de aceptar"
            />
          )
        )}

        {activeTab === 'owe' && (
          debtsAsDebtor.filter(d => d.status !== 'pending').length > 0 ? (
            <div className={styles.debtsList}>
              {debtsAsDebtor.filter(d => d.status !== 'pending').map((debt) => {
                const status = getStatusBadge(debt.status);
                const isVirtualDebt = debt.virtual_friend_id != null;
                const hasInstallments = debt.installments > 1;
                return (
                  <div key={debt.id} className={styles.debtItem}>
                    <div className={styles.debtInfo}>
                      <div className={styles.debtAvatar}>
                        {debt.creditor?.first_name?.[0]}{debt.creditor?.last_name?.[0]}
                      </div>
                      <div>
                        <div className={styles.debtName}>
                          {debt.creditor?.first_name} {debt.creditor?.last_name}
                        </div>
                        <div className={styles.debtNickname}>@{debt.creditor?.nickname}</div>
                        <div className={styles.debtDesc}>{debt.description}</div>
                        {hasInstallments && (
                          <div className={styles.installmentsBadge}>
                            🔄 {debt.installments} cuotas de {formatCurrency(debt.installment_amount || debt.amount / debt.installments)}
                          </div>
                        )}
                        {debt.due_date && (
                          <div className={`${styles.dueDateBadge} ${isOverdue(debt.due_date) && debt.status !== 'paid' ? styles.overdue : ''}`}>
                            📅 Vence: {formatDate(debt.due_date)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={styles.debtRight}>
                      <div className={styles.debtAmount}>{formatCurrency(debt.amount)}</div>
                      <span className={`${styles.statusBadge} ${styles[status.class]}`}>
                        {status.label}
                      </span>
                      <div className={styles.debtActions}>
                        {hasInstallments && (
                          <Button size="sm" variant="ghost" onClick={() => handleViewDebtDetail(debt)}>
                            📋 Ver Cuotas
                          </Button>
                        )}
                        {debt.status === 'accepted' && (
                          isVirtualDebt ? (
                            <Button size="sm" variant="success" onClick={() => handleMarkPaid(debt.id)}>
                              💰 Pagada
                            </Button>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="primary"
                              onClick={() => handleRequestPaymentConfirmation(debt)}
                              disabled={confirmingPayment === debt.id}
                            >
                              {confirmingPayment === debt.id ? '⏳' : '📨 Pagué'}
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon="✅"
              title="No debes nada"
              description="No tienes deudas activas"
            />
          )
        )}

        {activeTab === 'owed' && (
          debtsAsCreditor.length > 0 ? (
            <div className={styles.debtsList}>
              {debtsAsCreditor.map((debt) => {
                const status = getStatusBadge(debt.status);
                const hasInstallments = debt.installments > 1;
                return (
                  <div key={debt.id} className={styles.debtItem}>
                    <div className={styles.debtInfo}>
                      <div className={styles.debtAvatar}>
                        {debt.debtor?.first_name?.[0]}{debt.debtor?.last_name?.[0]}
                      </div>
                      <div>
                        <div className={styles.debtName}>
                          {debt.debtor?.first_name} {debt.debtor?.last_name}
                        </div>
                        <div className={styles.debtNickname}>@{debt.debtor?.nickname}</div>
                        <div className={styles.debtDesc}>{debt.description}</div>
                        {hasInstallments && (
                          <div className={styles.installmentsBadge}>
                            🔄 {debt.installments} cuotas de {formatCurrency(debt.installment_amount || debt.amount / debt.installments)}
                          </div>
                        )}
                        {debt.due_date && (
                          <div className={`${styles.dueDateBadge} ${isOverdue(debt.due_date) && debt.status !== 'paid' ? styles.overdue : ''}`}>
                            📅 Vence: {formatDate(debt.due_date)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={styles.debtRight}>
                      <div className={styles.debtAmount}>{formatCurrency(debt.amount)}</div>
                      <span className={`${styles.statusBadge} ${styles[status.class]}`}>
                        {status.label}
                      </span>
                      {hasInstallments && (
                        <Button size="sm" variant="ghost" onClick={() => handleViewDebtDetail(debt)}>
                          📋 Ver Cuotas
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon="💰"
              title="Nadie te debe"
              description="No tienes deudas a cobrar"
              action="Crear deuda"
              onAction={() => setShowModal(true)}
            />
          )
        )}
      </Card>

      {/* Modal de nueva deuda */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Nueva Deuda"
        size="md"
      >
        <form className={styles.form} onSubmit={handleSubmit}>
          {/* Selector de amigos (reales + virtuales) */}
          <div className={styles.friendSelector}>
            <label className={styles.label}>¿Quién te debe?</label>
            
            <div className={styles.selectWithButton}>
              <select
                name="debtorId"
                value={formData.debtorType === 'virtual' ? `virtual_${formData.debtorId}` : formData.debtorId}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) {
                    setFormData(prev => ({ ...prev, debtorId: '', debtorType: 'real' }));
                    return;
                  }
                  const isVirtual = value.startsWith('virtual_');
                  setFormData(prev => ({
                    ...prev,
                    debtorId: isVirtual ? value.replace('virtual_', '') : value,
                    debtorType: isVirtual ? 'virtual' : 'real'
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
            
            {/* Mensaje si no hay amigos */}
            {(!friends || friends.length === 0) && (!virtualFriends || virtualFriends.length === 0) && (
              <p className={styles.noFriendsHint}>
                No tienes amigos agregados. <button type="button" onClick={openNewFriendModal} className={styles.linkBtn}>Agrega uno</button>
              </p>
            )}
          </div>

          <Input
            label="Monto"
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
            placeholder="¿Por qué te deben?"
            value={formData.description}
            onChange={handleChange}
            required
          />

          {/* Cuotas */}
          <div className={styles.installmentsSection}>
            <label className={styles.label}>Número de cuotas</label>
            <div className={styles.installmentsInput}>
              <button 
                type="button" 
                className={styles.installmentBtn}
                onClick={() => setFormData(prev => ({ ...prev, installments: Math.max(1, prev.installments - 1) }))}
                disabled={formData.installments <= 1}
              >
                −
              </button>
              <span className={styles.installmentValue}>{formData.installments}</span>
              <button 
                type="button" 
                className={styles.installmentBtn}
                onClick={() => setFormData(prev => ({ ...prev, installments: Math.min(48, prev.installments + 1) }))}
                disabled={formData.installments >= 48}
              >
                +
              </button>
            </div>
            {formData.installments > 1 && (
              <p className={styles.installmentHint}>
                {formData.installments} cuotas de {currency}{(parseFloat(formData.amount || 0) / formData.installments).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            )}
          </div>

          {/* Fechas */}
          <div className={styles.datesSection}>
            <Input
              label="Fecha de compra (opcional)"
              type="date"
              name="purchaseDate"
              value={formData.purchaseDate}
              onChange={handleChange}
              hint="Cuándo se realizó la compra"
            />
            <Input
              label="Fecha de vencimiento *"
              type="date"
              name="dueDate"
              value={formData.dueDate}
              onChange={handleChange}
              hint="Cuándo vence el primer pago (se usa para recordatorios)"
              required={formData.installments > 1}
            />
          </div>

          <div className={styles.formActions}>
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={formLoading}>
              Enviar Deuda
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal para agregar contacto - Selección de tipo */}
      <Modal
        isOpen={showNewFriendModal}
        onClose={closeNewFriendModal}
        title={newFriendType === null ? "Nuevo Contacto" : (newFriendType === 'virtual' ? "Nuevo Contacto Ficticio" : "Buscar Amigo Real")}
        size="sm"
      >
        <div className={styles.virtualFriendForm}>
          {/* Paso 1: Seleccionar tipo */}
          {newFriendType === null && (
            <>
              <p className={styles.formHint}>
                ¿Qué tipo de contacto quieres agregar?
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

          {/* Paso 2b: Buscar amigo real */}
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

      {/* Modal de detalle de deuda con cuotas */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedDebt(null);
          setDebtInstallments([]);
        }}
        title="Detalle de Deuda"
        size="md"
      >
        {selectedDebt && (
          <div className={styles.debtDetail}>
            <div className={styles.debtDetailHeader}>
              <h3>{selectedDebt.description}</h3>
              <div className={styles.debtDetailAmount}>
                {formatCurrency(selectedDebt.amount)}
              </div>
            </div>

            <div className={styles.debtDetailInfo}>
              {selectedDebt.purchase_date && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>🛒 Fecha de compra:</span>
                  <span className={styles.detailValue}>{formatDate(selectedDebt.purchase_date)}</span>
                </div>
              )}
              {selectedDebt.due_date && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>📅 Primer vencimiento:</span>
                  <span className={`${styles.detailValue} ${isOverdue(selectedDebt.due_date) && selectedDebt.status !== 'paid' ? styles.overdue : ''}`}>
                    {formatDate(selectedDebt.due_date)}
                  </span>
                </div>
              )}
              {selectedDebt.installments > 1 && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>🔄 Cuotas:</span>
                  <span className={styles.detailValue}>
                    {selectedDebt.installments} cuotas de {formatCurrency(selectedDebt.installment_amount || selectedDebt.amount / selectedDebt.installments)}
                  </span>
                </div>
              )}
            </div>

            {/* Lista de cuotas */}
            {selectedDebt.installments > 1 && (
              <div className={styles.installmentsList}>
                <h4 className={styles.installmentsTitle}>📋 Plan de pagos</h4>
                
                {loadingInstallments ? (
                  <Loading size="sm" text="Cargando cuotas..." />
                ) : debtInstallments.length > 0 ? (
                  debtInstallments.map((inst) => {
                    const isInstOverdue = isOverdue(inst.due_date) && !inst.paid;
                    return (
                      <div 
                        key={inst.id} 
                        className={`${styles.installmentItem} ${inst.paid ? styles.paid : ''} ${isInstOverdue ? styles.overdue : ''}`}
                      >
                        <div className={styles.installmentInfo}>
                          <span className={styles.installmentNumber}>
                            Cuota {inst.installment_number}/{selectedDebt.installments}
                          </span>
                          <span className={styles.installmentDueDate}>
                            Vence: {formatDate(inst.due_date)}
                          </span>
                        </div>
                        <div className={styles.installmentAmount}>
                          {formatCurrency(inst.amount)}
                        </div>
                        <span className={`${styles.installmentStatus} ${inst.paid ? styles.paid : isInstOverdue ? styles.overdue : styles.pending}`}>
                          {inst.paid ? '✅ Pagada' : isInstOverdue ? '⚠️ Vencida' : '⏳ Pendiente'}
                        </span>
                        {!inst.paid && selectedDebt.creditor_id === user?.id && (
                          <Button 
                            size="sm" 
                            variant="success"
                            onClick={() => handleMarkInstallmentPaid(inst.id)}
                          >
                            ✓
                          </Button>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className={styles.noInstallments}>
                    No se encontraron cuotas registradas para esta deuda.
                  </p>
                )}
              </div>
            )}

            <div className={styles.formActions}>
              <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Debts;
