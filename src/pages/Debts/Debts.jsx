/**
 * Debts Page - Gestión de deudas entre amigos
 */
import { useState, useEffect } from 'react';
import { useAuth, useDebts, useFriends, useUI, useNotifications } from '../../context';
import { Button, Card, Input, Select, Modal, Loading, EmptyState, CurrencySelect, CURRENCIES } from '../../components';
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
    markAsPaid,
    refreshDebts
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
  
  // Estados de filtrado y ordenamiento
  const [sortBy, setSortBy] = useState('date'); // 'date', 'amount', 'name'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc', 'desc'
  const [filterByDate, setFilterByDate] = useState(''); // fecha específica
  const [searchName, setSearchName] = useState(''); // buscar por nombre
  const [showFilters, setShowFilters] = useState(false);
  
  // Amigos virtuales
  const [virtualFriends, setVirtualFriends] = useState([]);
  const [showNewFriendModal, setShowNewFriendModal] = useState(false);
  const [newFriendType, setNewFriendType] = useState(null); // 'real' | 'virtual' | null (selector)
  const [newVirtualFriend, setNewVirtualFriend] = useState({ name: '', email: '', phone: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // Cuentas bancarias
  const [bankAccounts, setBankAccounts] = useState([]);
  const [showCreateBankModal, setShowCreateBankModal] = useState(false);
  const [newBankAccount, setNewBankAccount] = useState({
    name: '',
    currency: 'ARS',
    initial_balance: '0'
  });
  
  // Sistema de marcado de pago
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [debtToMarkPaid, setDebtToMarkPaid] = useState(null);
  
  // Sistema de cobro/recordatorio
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [debtToCollect, setDebtToCollect] = useState(null);
  const [collecting, setCollecting] = useState(false);
  
  // Contadores de notificaciones
  const [debtorNotifCount, setDebtorNotifCount] = useState(0);
  const [creditorNotifCount, setCreditorNotifCount] = useState(0);
  
  const [formData, setFormData] = useState({
    debtDirection: 'i_owe', // 'i_owe' (yo debo) | 'owed_to_me' (me deben)
    friendId: '', // ID del amigo (puede ser deudor o acreedor según debtDirection)
    friendType: 'real', // 'real' | 'virtual'
    amount: '',
    description: '',
    category: 'other',
    installments: 1,
    purchaseDate: '', // Fecha de compra (opcional)
    dueDate: '', // Fecha de vencimiento del primer pago
    currency: profile?.country || 'ARS',
    currency_symbol: '$',
    bank_account_id: '' // Para vincular con cuenta bancaria si yo debo
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

  // Cargar cuentas bancarias
  useEffect(() => {
    const loadBankAccounts = async () => {
      if (!user) return;
      const { bankAccountsService } = await import('../../services');
      const result = await bankAccountsService.getUserAccounts(user.id);
      if (!result.error) {
        setBankAccounts(result.accounts || []);
      }
    };
    loadBankAccounts();
  }, [user]);

  // Cargar contadores de notificaciones
  useEffect(() => {
    const loadNotificationCounts = async () => {
      if (!user) return;
      
      const { notificationsService } = await import('../../services');
      
      // Cargar ambos contadores en paralelo
      const [debtorResult, creditorResult] = await Promise.all([
        notificationsService.getDebtorNotificationsCount(user.id),
        notificationsService.getCreditorNotificationsCount(user.id)
      ]);
      
      if (!debtorResult.error) {
        setDebtorNotifCount(Number(debtorResult.counts?.unread_count) || 0);
      }
      
      if (!creditorResult.error) {
        setCreditorNotifCount(Number(creditorResult.counts?.unread_count) || 0);
      }
    };
    
    loadNotificationCounts();
    
    // Recargar cada vez que cambien las deudas
    const interval = setInterval(loadNotificationCounts, 30000); // Cada 30 segundos
    
    return () => clearInterval(interval);
  }, [user, debtsAsCreditor, debtsAsDebtor]);

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
    const result = await debtsService.markInstallmentAsPaid(installmentId, user.id);
    if (result.success) {
      showSuccess('Cuota marcada como pagada');
      // Recargar cuotas inmediatamente
      if (selectedDebt) {
        const refreshed = await debtsService.getDebtInstallments(selectedDebt.id);
        if (refreshed.installments) {
          setDebtInstallments(refreshed.installments);
        }
      }
      // Recargar también la lista de deudas para actualizar el contador
      refreshDebts();
    } else {
      showError(result.error?.message || 'Error al marcar la cuota');
    }
  };

  // Revertir pago de una cuota
  const handleRevertInstallmentPayment = async (installmentId) => {
    if (!window.confirm('¿Estás seguro de que quieres revertir este pago?')) {
      return;
    }
    
    const result = await debtsService.revertInstallmentPayment(installmentId, user.id, 'Reversión manual del acreedor');
    if (result.success) {
      showSuccess('Pago revertido correctamente');
      // Recargar cuotas inmediatamente
      if (selectedDebt) {
        const refreshed = await debtsService.getDebtInstallments(selectedDebt.id);
        if (refreshed.installments) {
          setDebtInstallments(refreshed.installments);
        }
      }
      // Recargar también la lista de deudas para actualizar el contador
      refreshDebts();
    } else {
      showError(result.error?.message || 'Error al revertir el pago');
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

  // Función para filtrar y ordenar deudas
  const filterAndSortDebts = (debts) => {
    let filtered = [...debts];
    
    // Filtrar por nombre
    if (searchName.trim()) {
      filtered = filtered.filter(debt => {
        const name = activeTab === 'owe' 
          ? `${debt.creditor?.first_name} ${debt.creditor?.last_name}`.toLowerCase()
          : `${debt.debtor?.first_name} ${debt.debtor?.last_name}`.toLowerCase();
        return name.includes(searchName.toLowerCase());
      });
    }
    
    // Filtrar por fecha
    if (filterByDate) {
      filtered = filtered.filter(debt => {
        const debtDate = new Date(debt.created_at).toISOString().split('T')[0];
        return debtDate === filterByDate;
      });
    }
    
    // Ordenar
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch(sortBy) {
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'name':
          const nameA = activeTab === 'owe'
            ? `${a.creditor?.first_name || ''} ${a.creditor?.last_name || ''}`
            : `${a.debtor?.first_name || ''} ${a.debtor?.last_name || ''}`;
          const nameB = activeTab === 'owe'
            ? `${b.creditor?.first_name || ''} ${b.creditor?.last_name || ''}`
            : `${b.debtor?.first_name || ''} ${b.debtor?.last_name || ''}`;
          comparison = nameA.localeCompare(nameB);
          break;
        case 'date':
        default:
          comparison = new Date(b.created_at) - new Date(a.created_at);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  };

  // Manejar click en tarjetas de resumen
  const handleSummaryClick = (tab) => {
    setActiveTab(tab);
    // Resetear filtros al cambiar de tab
    setSearchName('');
    setFilterByDate('');
    setShowFilters(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Manejar cambio de moneda
  const handleCurrencyChange = (e) => {
    const currencyCode = e.target.value;
    const selectedCurrency = CURRENCIES.find(c => c.value === currencyCode);
    setFormData(prev => ({
      ...prev,
      currency: currencyCode,
      currency_symbol: selectedCurrency?.symbol || '$'
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);

    const isIOwe = formData.debtDirection === 'i_owe';
    const friendId = formData.friendId; // Ya está limpio desde el onChange

    // DEBUG: Ver valores antes de crear deuda
    console.log('🔍 DEBUG - handleSubmit Debts.jsx:');
    console.log('  - formData.debtDirection:', formData.debtDirection);
    console.log('  - isIOwe:', isIOwe);
    console.log('  - formData.friendId (raw):', formData.friendId);
    console.log('  - friendId (limpio):', friendId);
    console.log('  - user.id (yo):', user.id);
    console.log('  - creditorId será:', isIOwe ? friendId : user.id);
    console.log('  - debtorId será:', isIOwe ? user.id : friendId);

    const result = await createDebt({
      // Si "yo debo": yo soy el deudor, el amigo es el acreedor
      // Si "me deben": el amigo es el deudor, yo soy el acreedor
      creditorId: isIOwe ? friendId : user.id,
      debtorId: isIOwe ? user.id : friendId,
      friendId: friendId, // Pasar friendId explícitamente para notificaciones
      friendType: formData.friendType,
      amount: parseFloat(formData.amount),
      description: formData.description,
      category: formData.category,
      installments: parseInt(formData.installments) || 1,
      purchaseDate: formData.purchaseDate || null,
      dueDate: formData.dueDate || null,
      currency: formData.currency,
      currency_symbol: formData.currency_symbol,
      bank_account_id: isIOwe ? (formData.bank_account_id || null) : null,
      direction: formData.debtDirection // Para que el servicio sepa qué hacer
    });

    setFormLoading(false);

    if (result.success) {
      showSuccess(isIOwe ? 'Deuda registrada - Solicitud enviada al amigo' : 'Deuda registrada exitosamente');
      setShowModal(false);
      setFormData({ 
        debtDirection: 'i_owe',
        friendId: '', 
        friendType: 'real', 
        amount: '', 
        description: '', 
        category: 'other',
        installments: 1,
        purchaseDate: '',
        dueDate: '',
        currency: profile?.country || 'ARS',
        currency_symbol: '$',
        bank_account_id: ''
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
    
    // Preparar datos de la deuda para enviar (evita queries problemáticas)
    const debtData = {
      description: debt.description,
      amount: debt.amount,
      requesterName: profile?.full_name || profile?.first_name || user?.email || 'Alguien'
    };
    
    const result = await requestPaymentConfirmation(debt.id, debt.creditor_id, debtData);
    
    if (!result.error) {
      showSuccess('Solicitud enviada. Tu amigo recibirá una notificación para confirmar.');
    } else {
      showError('Error al enviar solicitud: ' + (result.error?.message || 'Error desconocido'));
    }
    
    setConfirmingPayment(null);
  };

  // Marcar deuda como pagada (para el acreedor)
  const handleMarkAsPaid = (debt) => {
    setDebtToMarkPaid(debt);
    setShowMarkPaidModal(true);
  };

  const confirmMarkAsPaid = async () => {
    if (!debtToMarkPaid) return;
    
    const result = await markAsPaid(debtToMarkPaid.id, true); // true = marcado por acreedor
    
    if (result.success) {
      showSuccess(debtToMarkPaid.paid_by_creditor 
        ? 'Pago revertido. Se notificará al deudor.' 
        : 'Deuda marcada como pagada. Se notificará al deudor para confirmar.'
      );
      setShowMarkPaidModal(false);
      setDebtToMarkPaid(null);
    } else {
      showError('Error al marcar como pagada');
    }
  };

  // Crear cuenta bancaria desde debts
  const handleCreateBankAccount = async (e) => {
    e.preventDefault();
    
    try {
      const { supabase } = await import('../../services/supabase');
      const { data, error } = await supabase
        .from('bank_accounts')
        .insert({
          user_id: user.id,
          name: newBankAccount.name,
          currency: newBankAccount.currency || formData.currency,
          initial_balance: parseFloat(newBankAccount.initial_balance) || 0,
          current_balance: parseFloat(newBankAccount.initial_balance) || 0,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      showSuccess('Cuenta bancaria creada exitosamente');
      setBankAccounts(prev => [...prev, data]);
      setFormData(prev => ({ ...prev, bank_account_id: data.id }));
      setShowCreateBankModal(false);
      setNewBankAccount({ name: '', currency: 'ARS', initial_balance: '0' });
    } catch (error) {
      showError('Error al crear cuenta bancaria');
    }
  };

  // Marcar como pagado (para deudas con amigos virtuales)
  const handleMarkPaid = (debt) => {
    setDebtToMarkPaid(debt);
    setShowMarkPaidModal(true);
  };

  const confirmMarkPaidVirtual = async () => {
    if (!debtToMarkPaid) return;
    
    const wasPaid = debtToMarkPaid.status === 'paid';
    const result = await markAsPaid(debtToMarkPaid.id, false); // false = no es por acreedor
    
    if (result.success) {
      showSuccess(wasPaid 
        ? '✅ Deuda reactivada - marcada como pendiente' 
        : '💰 Deuda marcada como pagada'
      );
      setShowMarkPaidModal(false);
      setDebtToMarkPaid(null);
    } else {
      showError('Error al actualizar la deuda');
    }
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
      // Crear notificación de recordatorio
      const { createNotification } = await import('../../services/notificationsService');
      
      const result = await createNotification({
        userId: debtToCollect.debtor_id,
        type: 'payment_reminder',
        title: '💰 Recordatorio de Pago',
        message: `${profile?.full_name || 'Alguien'} te recuerda la deuda pendiente: "${debtToCollect.description}" por ${debtToCollect.currency_symbol}${debtToCollect.amount.toLocaleString('es-AR')}`,
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
    if (!result.error && result.friend) {
      // Agregar a la lista local
      setVirtualFriends(prev => [...prev, result.friend]);
      
      // Pre-seleccionar el nuevo amigo en el formulario
      setFormData(prev => ({ 
        ...prev, 
        debtorId: result.friend.id, 
        debtorType: 'virtual' 
      }));
      
      // Cerrar modal y resetear
      closeNewFriendModal();
      
      showSuccess('Contacto agregado exitosamente');
    } else {
      showError(result.error?.message || 'Error al crear contacto');
    }
  };

  // Abrir modal para nuevo amigo
  const openNewFriendModal = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
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
        <Card variant="success" onClick={() => handleSummaryClick('owed')} style={{ cursor: 'pointer' }}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryIcon}>💰</span>
            <div>
              <div className={styles.summaryValue}>{formatCurrency(summary?.totalOwedToMe || 0)}</div>
              <div className={styles.summaryLabel}>Me deben</div>
            </div>
          </div>
        </Card>
        <Card variant="warning" onClick={() => handleSummaryClick('owe')} style={{ cursor: 'pointer' }}>
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
          {debtorNotifCount > 0 && (
            <span className={styles.notificationBadge}>{debtorNotifCount}</span>
          )}
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'owed' ? styles.active : ''}`}
          onClick={() => setActiveTab('owed')}
        >
          Me Deben
          {creditorNotifCount > 0 && (
            <span className={styles.notificationBadge}>{creditorNotifCount}</span>
          )}
        </button>
      </div>

      {/* Filtros y Ordenamiento */}
      {(activeTab === 'owe' || activeTab === 'owed') && (
        <Card>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => setShowFilters(!showFilters)}
            >
              🔍 {showFilters ? 'Ocultar' : 'Filtros'}
            </Button>
            
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--gray-600)' }}>Ordenar por:</label>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid var(--gray-300)', fontSize: '0.85rem' }}
              >
                <option value="date">Fecha</option>
                <option value="amount">Monto</option>
                <option value="name">Nombre</option>
              </select>
              
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid var(--gray-300)', background: 'white', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                {sortOrder === 'asc' ? '↑ Ascendente' : '↓ Descendente'}
              </button>
            </div>
          </div>
          
          {showFilters && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--gray-200)' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--gray-600)', marginBottom: '0.25rem', display: 'block' }}>Buscar por nombre</label>
                <input
                  type="text"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  placeholder="Nombre del amigo..."
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--gray-300)', fontSize: '0.85rem' }}
                />
              </div>
              
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--gray-600)', marginBottom: '0.25rem', display: 'block' }}>Filtrar por fecha</label>
                <input
                  type="date"
                  value={filterByDate}
                  onChange={(e) => setFilterByDate(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--gray-300)', fontSize: '0.85rem' }}
                />
              </div>
              
              {(searchName || filterByDate) && (
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSearchName('');
                      setFilterByDate('');
                    }}
                  >
                    ✖ Limpiar filtros
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

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
                    <div className={styles.debtAmount}>{debt.currency_symbol || '$'}{debt.amount.toLocaleString('es-AR')}</div>
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
              {filterAndSortDebts(debtsAsDebtor.filter(d => d.status !== 'pending')).map((debt) => {
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
                      <div className={styles.debtAmount}>{debt.currency_symbol || '$'}{debt.amount.toLocaleString('es-AR')}</div>
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
                            <Button 
                              size="sm" 
                              variant={debt.status === 'paid' ? "warning" : "success"}
                              onClick={() => handleMarkPaid(debt)}
                            >
                              {debt.status === 'paid' ? '🔄 No pagó' : '💰 Pagué'}
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
              {filterAndSortDebts(debtsAsCreditor).map((debt) => {
                const status = getStatusBadge(debt.status);
                const hasInstallments = debt.installments > 1;
                const paidInstallments = debt.paid_installments || 0;
                const isOverdueDebt = debt.due_date && isOverdue(debt.due_date) && debt.status !== 'paid';
                
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
                          <>
                            <div className={styles.installmentsBadge}>
                              🔄 {debt.installments} cuotas de {formatCurrency(debt.installment_amount || debt.amount / debt.installments)}
                            </div>
                            <div className={styles.installmentsStatus}>
                              {paidInstallments > 0 && (
                                <span className={styles.paidBadge}>
                                  ✅ {paidInstallments}/{debt.installments} pagadas
                                </span>
                              )}
                              {isOverdueDebt && (
                                <span className={styles.overdueBadge}>
                                  ⚠️ Vencida - Cobrar
                                </span>
                              )}
                            </div>
                          </>
                        )}
                        {debt.due_date && (
                          <div className={`${styles.dueDateBadge} ${isOverdueDebt ? styles.overdue : ''}`}>
                            📅 Vence: {formatDate(debt.due_date)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={styles.debtRight}>
                      <div className={styles.debtAmount}>{debt.currency_symbol || '$'}{debt.amount.toLocaleString('es-AR')}</div>
                      <span className={`${styles.statusBadge} ${styles[status.class]}`}>
                        {status.label}
                      </span>
                      <div className={styles.debtActions}>
                        {hasInstallments && (
                          <Button size="sm" variant="ghost" onClick={() => handleViewDebtDetail(debt)}>
                            📋 Ver Cuotas
                          </Button>
                        )}
                        {debt.status === 'accepted' && !debt.virtual_friend_id && (
                          <Button 
                            size="sm" 
                            variant="info"
                            onClick={() => handleCollect(debt)}
                          >
                            💰 Cobrar
                          </Button>
                        )}
                        {debt.status === 'accepted' && (
                          <Button 
                            size="sm" 
                            variant={debt.paid_by_creditor ? "warning" : "success"}
                            onClick={() => handleMarkAsPaid(debt)}
                          >
                            {debt.paid_by_creditor ? '🔄 Revertir' : '✅ Pagó'}
                          </Button>
                        )}
                      </div>
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
          {/* Selector de dirección de deuda */}
          <div className={styles.debtDirectionSelector}>
            <label className={styles.label}>Tipo de deuda</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="debtDirection"
                  value="owed_to_me"
                  checked={formData.debtDirection === 'owed_to_me'}
                  onChange={handleChange}
                />
                <span>💰 Me deben (alguien me debe dinero)</span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="debtDirection"
                  value="i_owe"
                  checked={formData.debtDirection === 'i_owe'}
                  onChange={handleChange}
                />
                <span>💸 Yo debo (le debo dinero a alguien)</span>
              </label>
            </div>
          </div>

          {/* Selector de amigos (reales + virtuales) */}
          <div className={styles.friendSelector}>
            <label className={styles.label}>
              {formData.debtDirection === 'i_owe' ? '¿A quién le debes?' : '¿Quién te debe?'}
            </label>
            
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
                      <option key={`friend-${f.friendshipId || f.friend?.id}`} value={f.friend?.id}>
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

          <CurrencySelect
            label="Moneda"
            value={formData.currency}
            onChange={handleCurrencyChange}
            required
          />

          {/* Campo de cuenta bancaria solo si "yo debo" */}
          {formData.debtDirection === 'i_owe' && (
            <div>
              <div className={styles.selectWithButton}>
                <Select
                  label="Cuenta Bancaria (opcional)"
                  name="bank_account_id"
                  options={[
                    { value: '', label: '-- Sin cuenta --' },
                    ...bankAccounts
                      .filter(acc => acc.currency === formData.currency)
                      .map(acc => ({
                        value: acc.id,
                        label: `${acc.currency_symbol} ${acc.name} (${acc.currency_symbol}${acc.current_balance.toFixed(2)})`
                      }))
                  ]}
                  value={formData.bank_account_id}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className={styles.addBankBtn}
                  onClick={() => setShowCreateBankModal(true)}
                  title="Crear nueva cuenta bancaria"
                >
                  🏦 ➕
                </button>
              </div>
              {bankAccounts.filter(acc => acc.currency === formData.currency).length === 0 && (
                <p className={styles.hint}>
                  No tienes cuentas en {formData.currency}. <button type="button" onClick={() => setShowCreateBankModal(true)} className={styles.linkBtn}>Crea una aquí</button>
                </p>
              )}
            </div>
          )}

          <Input
            label="Descripción"
            name="description"
            placeholder={formData.debtDirection === 'i_owe' ? '¿Por qué debes?' : '¿Por qué te deben?'}
            value={formData.description}
            onChange={handleChange}
            required
          />

          {/* Cuotas */}
          <div className={styles.installmentsSection}>
            <label className={styles.label}>Número de cuotas</label>
            
            {/* Botones de cuotas predeterminadas */}
            <div className={styles.installmentButtons}>
              {[1, 3, 6, 12].map(count => (
                <button
                  key={count}
                  type="button"
                  className={`${styles.installmentBtn} ${formData.installments === count ? styles.active : ''}`}
                  onClick={() => setFormData(prev => ({ ...prev, installments: count }))}
                >
                  {count} {count === 1 ? 'cuota' : 'cuotas'}
                </button>
              ))}
            </div>
            
            {/* Input personalizado */}
            <div className={styles.customInstallmentInput}>
              <label className={styles.smallLabel}>O ingresa un número personalizado:</label>
              <input
                type="number"
                min="1"
                max="48"
                placeholder="Ej: 18"
                className={styles.numberInput}
                value={formData.installments > 12 || ![1, 3, 6, 12].includes(formData.installments) ? String(formData.installments) : ''}
                onChange={(e) => {
                  const value = e.target.value === '' ? 1 : parseInt(e.target.value);
                  if (!isNaN(value)) {
                    setFormData(prev => ({ ...prev, installments: Math.min(48, Math.max(1, value)) }));
                  }
                }}
              />
            </div>
            
            {formData.installments > 1 && formData.amount && (
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
                <Button type="button" onClick={handleCreateVirtualFriend}>
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
                        <div className={styles.installmentActions}>
                          {!inst.paid && selectedDebt.creditor_id === user?.id && (
                            <Button 
                              size="sm" 
                              variant="success"
                              onClick={() => handleMarkInstallmentPaid(inst.id)}
                            >
                              ✓ Pagar
                            </Button>
                          )}
                          {inst.paid && selectedDebt.creditor_id === user?.id && (
                            <Button 
                              size="sm" 
                              variant="warning"
                              onClick={() => handleRevertInstallmentPayment(inst.id)}
                              title="Revertir pago"
                            >
                              ↺ Revertir
                            </Button>
                          )}
                        </div>
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

      {/* Modal Crear Cuenta Bancaria */}
      <Modal
        show={showCreateBankModal}
        onClose={() => setShowCreateBankModal(false)}
        title="🏦 Crear Cuenta Bancaria"
      >
        <form onSubmit={handleCreateBankAccount} className={styles.form}>
          <Input
            label="Nombre de la cuenta"
            type="text"
            placeholder="ej: Cuenta Corriente"
            value={newBankAccount.name}
            onChange={(e) => setNewBankAccount(prev => ({ ...prev, name: e.target.value }))}
            required
          />

          <CurrencySelect
            label="Moneda"
            value={newBankAccount.currency || formData.currency}
            onChange={(e) => setNewBankAccount(prev => ({ ...prev, currency: e.target.value }))}
            required
          />

          <Input
            label="Saldo inicial (opcional)"
            type="number"
            placeholder="0.00"
            value={newBankAccount.initial_balance}
            onChange={(e) => setNewBankAccount(prev => ({ ...prev, initial_balance: e.target.value }))}
          />

          <div className={styles.formActions}>
            <Button type="button" variant="secondary" onClick={() => setShowCreateBankModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              Crear Cuenta
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Marcar como Pagada */}
      <Modal
        show={showMarkPaidModal}
        onClose={() => setShowMarkPaidModal(false)}
        title={debtToMarkPaid?.paid_by_creditor ? "🔄 Revertir Pago" : debtToMarkPaid?.status === 'paid' ? "🔄 Reactivar Deuda" : "✅ Marcar como Pagada"}
      >
        <div className={styles.confirmModal}>
          {debtToMarkPaid && (
            <>
              <p className={styles.confirmText}>
                {debtToMarkPaid.paid_by_creditor 
                  ? `¿Revertir el pago de "${debtToMarkPaid.description}"?`
                  : debtToMarkPaid.status === 'paid'
                  ? `¿Reactivar la deuda "${debtToMarkPaid.description}"?`
                  : `¿Confirmar que pagaste "${debtToMarkPaid.description}"?`
                }
              </p>
              <div className={styles.confirmAmount}>
                {debtToMarkPaid.currency_symbol}{debtToMarkPaid.amount.toLocaleString('es-AR')}
              </div>
              <p className={styles.confirmNote}>
                {debtToMarkPaid.paid_by_creditor 
                  ? 'La deuda volverá al estado "Aceptada".'
                  : debtToMarkPaid.status === 'paid'
                  ? 'La deuda se marcará como activa nuevamente por si cometiste un error.'
                  : 'Esta acción marcará la deuda como pagada. Si te equivocas, puedes revertirlo con el botón "No pagó".'
                }
              </p>
              <div className={styles.formActions}>
                <Button variant="secondary" onClick={() => setShowMarkPaidModal(false)}>
                  Cancelar
                </Button>
                <Button 
                  variant={debtToMarkPaid.paid_by_creditor || debtToMarkPaid.status === 'paid' ? "warning" : "success"}
                  onClick={debtToMarkPaid.paid_by_creditor ? confirmMarkAsPaid : confirmMarkPaidVirtual}
                >
                  {debtToMarkPaid.paid_by_creditor ? '🔄 Revertir' : debtToMarkPaid.status === 'paid' ? '🔄 Reactivar' : '✅ Confirmar'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

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
                ¿Enviar un recordatorio a {debtToCollect.debtor?.first_name} {debtToCollect.debtor?.last_name} para que pague esta deuda?
              </p>
              <div className={styles.debtInfo}>
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
    </div>
  );
};

export default Debts;
