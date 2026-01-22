/**
 * Debts Page - Gestión de deudas entre amigos
 */
import { useState, useEffect } from 'react';
import { useAuth, useDebts, useFriends, useUI, useNotifications } from '../../context';
import { Button, Card, Input, Select, Modal, Loading, EmptyState, CurrencySelect, CURRENCIES } from '../../components';
import virtualFriendsService from '../../services/virtualFriendsService';
import debtsService from '../../services/debtsService';
import { createNotification } from '../../services/notificationsService';
import { 
  CreditCard, 
  Plus, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  RefreshCw,
  Send,
  Eye,
  Filter,
  ArrowUpDown,
  X,
  Users,
  UserPlus,
  Wallet,
  Building2,
  FileText,
  ChevronRight,
  Bell
} from 'lucide-react';
import './Debts.css';

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
  const [showFilters, setShowFilters] = useState(true);
  
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

  // Obtener información de la persona (real o virtual)
  const getPersonInfo = (debt, role = 'creditor') => {
    const person = debt[role];
    const virtualFriend = debt.virtual_friend;
    
    if (person) {
      return {
        name: `${person.first_name} ${person.last_name}`,
        nickname: person.nickname,
        initials: `${person.first_name?.[0]}${person.last_name?.[0]}`.toUpperCase()
      };
    } else if (virtualFriend) {
      const names = virtualFriend.name.split(' ');
      return {
        name: virtualFriend.name,
        nickname: virtualFriend.email || virtualFriend.phone || 'Amigo Virtual',
        initials: names.length > 1 
          ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
          : `${names[0][0]}${names[0][1] || ''}`.toUpperCase()
      };
    }
    
    return {
      name: 'Desconocido',
      nickname: '',
      initials: '??'
    };
  };

  // Función para filtrar y ordenar deudas
  const filterAndSortDebts = (debts) => {
    let filtered = [...debts];
    
    // Filtrar por nombre
    if (searchName.trim()) {
      filtered = filtered.filter(debt => {
        const personInfo = activeTab === 'owe' 
          ? getPersonInfo(debt, 'creditor')
          : getPersonInfo(debt, 'debtor');
        return personInfo.name.toLowerCase().includes(searchName.toLowerCase());
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
        ? 'Deuda reactivada - marcada como pendiente' 
        : 'Deuda marcada como pagada'
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
      const result = await createNotification({
        userId: debtToCollect.debtor_id,
        type: 'payment_reminder',
        title: '💸 Recordatorio de Pago',
        message: `${profile?.full_name || profile?.first_name || 'Alguien'} te recuerda la deuda pendiente: "${debtToCollect.description}" por ${debtToCollect.currency_symbol || '$'}${debtToCollect.amount.toLocaleString('es-AR')}`,
        data: {
          debt_id: debtToCollect.id,
          amount: debtToCollect.amount,
          currency: debtToCollect.currency,
          description: debtToCollect.description
        },
        actionRequired: false
      });

      if (!result.error) {
        showSuccess('¡Recordatorio enviado! Tu amigo recibirá una notificación.');
        setShowCollectModal(false);
        setDebtToCollect(null);
      } else {
        console.error('Error enviando recordatorio:', result.error);
        showError('Error al enviar recordatorio: ' + (result.error?.message || 'Intenta de nuevo'));
      }
    } catch (error) {
      console.error('Error enviando recordatorio:', error);
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
      pending: { label: 'Pendiente', class: 'pending' },
      accepted: { label: 'Aceptada', class: 'accepted' },
      rejected: { label: '❌ Rechazada', class: 'rejected' },
      paid: { label: 'Pagada', class: 'paid' }
    };
    return badges[status] || badges.pending;
  };

  if (loading) {
    return <Loading size="lg" text="Cargando deudas..." />;
  }

  return (
    <div className="debts-container">
      {/* Header */}
      <div className="debts-header">
        <div className="debts-header-left">
          <h2 className="debts-title"><CreditCard size={28} />Deudas</h2>
          <p className="debts-subtitle">
            Gestiona las deudas con tus amigos de forma profesional
          </p>
        </div>
        <Button icon={<Plus size={20} />} onClick={() => setShowModal(true)}>
          Nueva Deuda
        </Button>
      </div>

      {/* Resumen */}
      <div className="debts-summary-grid">
        <Card variant="success" onClick={() => handleSummaryClick('owed')} style={{ cursor: 'pointer' }}>
          <div className="debts-summary-item">
            <span className="debts-summary-icon icon-owed"><TrendingUp size={36} strokeWidth={2.5} /></span>
            <div className="debts-summary-info">
              <h3 className="debts-summary-amount">{formatCurrency(summary?.totalOwedToMe || 0)}</h3>
              <div>Me deben</div>
            </div>
          </div>
        </Card>
        <Card variant="warning" onClick={() => handleSummaryClick('owe')} style={{ cursor: 'pointer' }}>
          <div className="debts-summary-item">
            <span className="debts-summary-icon icon-owe"><TrendingDown size={36} strokeWidth={2.5} /></span>
            <div className="debts-summary-info">
              <h3 className="debts-summary-amount">{formatCurrency(summary?.totalIOwe || 0)}</h3>
              <div>Yo debo</div>
            </div>
          </div>
        </Card>
        <Card variant={summary?.netBalance >= 0 ? 'gradient' : 'dark'}>
          <div className="debts-summary-item">
            <span className="debts-summary-icon icon-total"><BarChart3 size={36} strokeWidth={2.5} /></span>
            <div className="debts-summary-info">
              <h3 className="debts-summary-amount">{formatCurrency(summary?.netBalance || 0)}</h3>
              <div>Balance Neto</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="debts-tabs">
        <button 
          className={`debts-tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          <span>Pendientes de Aceptar</span>
          {pendingDebts.length > 0 && (
            <span className="debts-tab-badge">{pendingDebts.length}</span>
          )}
        </button>
        <button 
          className={`debts-tab ${activeTab === 'owe' ? 'active' : ''}`}
          onClick={() => setActiveTab('owe')}
        >
          <span>Lo que Debo</span>
          {debtorNotifCount > 0 && (
            <span className="debts-tab-badge badge-danger">{debtorNotifCount}</span>
          )}
        </button>
        <button 
          className={`debts-tab ${activeTab === 'owed' ? 'active' : ''}`}
          onClick={() => setActiveTab('owed')}
        >
          <span>Me Deben</span>
          {creditorNotifCount > 0 && (
            <span className="debts-tab-badge badge-danger">{creditorNotifCount}</span>
          )}
        </button>
      </div>

      {/* Filtros y Ordenamiento */}
      {(activeTab === 'owe' || activeTab === 'owed') && (
        <div className="debts-filters-card">
          <div className="debts-filters-header">
            <Button 
              size="sm" 
              variant="ghost"
              icon={<Filter size={16} />}
              onClick={() => setShowFilters(!showFilters)}
            >
              {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
            </Button>
            
            <div className="debts-sort-group">
              <label className="debts-sort-label">
                <ArrowUpDown size={16} />
                Ordenar por:
              </label>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                className="debts-sort-select"
              >
                <option value="date">Fecha</option>
                <option value="amount">Monto</option>
                <option value="name">Nombre</option>
              </select>
              
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="debts-sort-btn"
              >
                {sortOrder === 'asc' ? '↑ Ascendente' : '↓ Descendente'}
              </button>
            </div>
          </div>
          
          {showFilters && (
            <div className="debts-filters-body">
              <div className="debts-filter-field">
                <label className="debts-filter-label">Buscar por nombre</label>
                <input
                  type="text"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  placeholder="Nombre del amigo..."
                  className="debts-filter-input"
                />
              </div>
              
              <div className="debts-filter-field">
                <label className="debts-filter-label">Filtrar por fecha</label>
                <input
                  type="date"
                  value={filterByDate}
                  onChange={(e) => setFilterByDate(e.target.value)}
                  className="debts-filter-input"
                />
              </div>
              
              {(searchName || filterByDate) && (
                <div className="debts-filter-field">
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<X size={16} />}
                    onClick={() => {
                      setSearchName('');
                      setFilterByDate('');
                    }}
                  >
                    Limpiar filtros
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <Card>
        {activeTab === 'pending' && (
          pendingDebts.length > 0 ? (
            <div className="debts-list">
              {pendingDebts.map((debt) => {
                const creditorInfo = getPersonInfo(debt, 'creditor');
                return (
                  <div key={debt.id} className="debt-item">
                    <div className="debt-item-header">
                      <div className="debt-item-person">
                        <div className="debt-avatar">
                          {creditorInfo.initials}
                        </div>
                        <div className="debt-person-info">
                          <h3>{creditorInfo.name}</h3>
                          <div className="debt-person-nickname">@{creditorInfo.nickname}</div>
                        </div>
                      </div>
                      <div className="debt-amount-main">{debt.currency_symbol || '$'}{debt.amount.toLocaleString('es-AR')}</div>
                    </div>
                    <div className="debt-item-body">
                      <div className="debt-info-row">
                        <span className="debt-info-label">Descripción:</span>
                        <span className="debt-info-value">{debt.description}</span>
                      </div>
                    </div>
                    <div className="debt-item-actions">
                      <button className="debt-action-btn btn-success" onClick={() => handleAccept(debt.id)}>
                        <CheckCircle size={16} /> Aceptar
                      </button>
                      <button className="debt-action-btn btn-danger" onClick={() => handleReject(debt.id)}>
                        <XCircle size={16} /> Rechazar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<CheckCircle size={48} color="#10b981" />}
              title="Sin deudas pendientes"
              description="No tienes deudas pendientes de aceptar"
            />
          )
        )}

        {activeTab === 'owe' && (
          debtsAsDebtor.filter(d => d.status !== 'pending').length > 0 ? (
            <div className="debts-list">
              {filterAndSortDebts(debtsAsDebtor.filter(d => d.status !== 'pending')).map((debt) => {
                const status = getStatusBadge(debt.status);
                const isVirtualDebt = debt.virtual_friend_id != null;
                const hasInstallments = debt.installments > 1;
                const creditorInfo = getPersonInfo(debt, 'creditor');
                return (
                  <div key={debt.id} className="debt-item">
                    <div className="debt-item-header">
                      <div className="debt-item-person">
                        <div className="debt-avatar">
                          {creditorInfo.initials}
                        </div>
                        <div className="debt-person-info">
                          <h3>{creditorInfo.name}</h3>
                          <div className="debt-person-nickname">@{creditorInfo.nickname}</div>
                        </div>
                      </div>
                      <div className="debt-amount-main">{debt.currency_symbol || '$'}{debt.amount.toLocaleString('es-AR')}</div>
                    </div>
                    <div className="debt-item-body">
                      <div className="debt-info-row">
                        <span className="debt-info-label">Descripción:</span>
                        <span className="debt-info-value">{debt.description}</span>
                      </div>
                      <div className="debt-info-row">
                        <span className="debt-info-label">Estado:</span>
                        <span className={`debt-status-badge status-${status.class}`}>{status.label}</span>
                      </div>
                      {hasInstallments && (
                        <div className="debt-info-row">
                          <span className="debt-info-label">Cuotas:</span>
                          <span className="badge-installment-primary">
                            <RefreshCw size={14} />
                            {debt.installments} cuotas de {formatCurrency(debt.installment_amount || debt.amount / debt.installments)}
                          </span>
                        </div>
                      )}
                      {debt.due_date && (
                        <div className="debt-info-row">
                          <span className="debt-info-label">Vencimiento:</span>
                          <span className={isOverdue(debt.due_date) && debt.status !== 'paid' ? "badge-due-date-overdue" : "badge-due-date-normal"}>
                            <Calendar size={14} />
                            {formatDate(debt.due_date)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="debt-item-actions">
                      {hasInstallments && (
                        <button className="debt-action-btn" onClick={() => handleViewDebtDetail(debt)}>
                          <Eye size={16} /> Ver Cuotas
                        </button>
                      )}
                      {/* Botón para deudas virtuales */}
                      {isVirtualDebt && debt.status !== 'rejected' && (
                        <button 
                          className={`debt-action-btn ${debt.status === 'paid' ? 'btn-paid' : 'btn-success'}`}
                          onClick={() => handleMarkPaid(debt)}
                        >
                          {debt.status === 'paid' ? <><CheckCircle size={16} /> Pagado ✓</> : <><DollarSign size={16} /> Marcar Pagado</>}
                        </button>
                      )}
                      {/* Botón para deudas con usuarios reales */}
                      {!isVirtualDebt && debt.status === 'accepted' && (
                        <button 
                          className={`debt-action-btn ${debt.paid_by_creditor ? 'btn-paid' : 'btn-primary'}`}
                          onClick={() => handleRequestPaymentConfirmation(debt)}
                          disabled={confirmingPayment === debt.id || debt.paid_by_creditor}
                        >
                          {debt.paid_by_creditor 
                            ? <><CheckCircle size={16} /> Pagado ✓</>
                            : <><Send size={16} /> {confirmingPayment === debt.id ? 'Enviando...' : 'Notificar Pago'}</>}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<CheckCircle size={48} color="#10b981" />}
              title="No debes nada"
              description="No tienes deudas activas"
            />
          )
        )}

        {activeTab === 'owed' && (
          debtsAsCreditor.length > 0 ? (
            <div className="debts-list">
              {filterAndSortDebts(debtsAsCreditor).map((debt) => {
                const status = getStatusBadge(debt.status);
                const hasInstallments = debt.installments > 1;
                const paidInstallments = debt.paid_installments || 0;
                const isOverdueDebt = debt.due_date && isOverdue(debt.due_date) && debt.status !== 'paid';
                const debtorInfo = getPersonInfo(debt, 'debtor');
                
                return (
                  <div key={debt.id} className="debt-item">
                    <div className="debt-item-header">
                      <div className="debt-item-person">
                        <div className="debt-avatar">
                          {debtorInfo.initials}
                        </div>
                        <div className="debt-person-info">
                          <h3>{debtorInfo.name}</h3>
                          <div className="debt-person-nickname">@{debtorInfo.nickname}</div>
                        </div>
                      </div>
                      <div className="debt-amount-main">{debt.currency_symbol || '$'}{debt.amount.toLocaleString('es-AR')}</div>
                    </div>
                    <div className="debt-item-body">
                      <div className="debt-info-row">
                        <span className="debt-info-label">Descripción:</span>
                        <span className="debt-info-value">{debt.description}</span>
                      </div>
                      <div className="debt-info-row">
                        <span className="debt-info-label">Estado:</span>
                        <span className={`debt-status-badge status-${status.class}`}>{status.label}</span>
                      </div>
                      {hasInstallments && (
                        <>
                          <div className="debt-info-row">
                            <span className="debt-info-label">Cuotas:</span>
                            <span className="badge-installment-success">
                              <RefreshCw size={14} />
                              {debt.installments} cuotas de {formatCurrency(debt.installment_amount || debt.amount / debt.installments)}
                            </span>
                          </div>
                          {paidInstallments > 0 && (
                            <div className="debt-info-row">
                              <span className="debt-info-label">Progreso:</span>
                              <span className="badge-paid-count">
                                <CheckCircle size={14} />
                                {paidInstallments}/{debt.installments} pagadas
                              </span>
                            </div>
                          )}
                        </>
                      )}
                      {debt.due_date && (
                        <div className="debt-info-row">
                          <span className="debt-info-label">Vencimiento:</span>
                          <span className={isOverdueDebt ? "badge-due-date-overdue" : "badge-due-date-normal"}>
                            <Calendar size={14} />
                            {formatDate(debt.due_date)}
                          </span>
                        </div>
                      )}
                      {isOverdueDebt && (
                        <div className="debt-info-row">
                          <span className="badge-overdue-alert">
                            <AlertCircle size={14} />
                            Deuda vencida - Requiere atención
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="debt-item-actions">
                      {hasInstallments && (
                        <button className="debt-action-btn" onClick={() => handleViewDebtDetail(debt)}>
                          <Eye size={16} /> Ver Cuotas
                        </button>
                      )}
                      {/* Botón Cobrar - solo para deudas con usuarios reales y no pagadas */}
                      {debt.status === 'accepted' && !debt.virtual_friend_id && !debt.paid_by_creditor && debt.status !== 'paid' && (
                        <button className="debt-action-btn btn-info" onClick={() => handleCollect(debt)}>
                          <Bell size={16} /> Recordar Pago
                        </button>
                      )}
                      {/* Botón Marcar Pagado - cambia de color según estado */}
                      {(debt.status === 'accepted' || debt.status === 'paid') && (
                        <button 
                          className={`debt-action-btn ${debt.paid_by_creditor || debt.status === 'paid' ? 'btn-paid' : 'btn-success'}`}
                          onClick={() => handleMarkAsPaid(debt)}
                        >
                          {debt.paid_by_creditor || debt.status === 'paid' 
                            ? <><CheckCircle size={16} /> Pagado ✓</> 
                            : <><DollarSign size={16} /> Marcar Pagado</>}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<DollarSign size={48} />}
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
        <form onSubmit={handleSubmit}>
          {/* Selector de dirección de deuda */}
          <div className="debts-form-group">
            <label className="debts-form-label">Tipo de deuda</label>
            <div className="debts-direction-options">
              <label className="debts-radio-option">
                <input
                  type="radio"
                  name="debtDirection"
                  value="owed_to_me"
                  checked={formData.debtDirection === 'owed_to_me'}
                  onChange={handleChange}
                />
                <span className="debts-radio-content">
                  <TrendingUp size={20} />
                  <span>Me deben (alguien me debe dinero)</span>
                </span>
              </label>
              <label className="debts-radio-option">
                <input
                  type="radio"
                  name="debtDirection"
                  value="i_owe"
                  checked={formData.debtDirection === 'i_owe'}
                  onChange={handleChange}
                />
                <span className="debts-radio-content">
                  <TrendingDown size={20} />
                  <span>Yo debo (le debo dinero a alguien)</span>
                </span>
              </label>
            </div>
          </div>

          {/* Selector de amigos (reales + virtuales) */}
          <div className="debts-form-group">
            <label className="debts-form-label">
              {formData.debtDirection === 'i_owe' ? '¿A quién le debes?' : '¿Quién te debe?'}
            </label>
            
            <div className="debts-select-with-button">
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
                className="debts-form-select"
                required
              >
                <option value="">Selecciona un amigo</option>
                
                {friends && friends.length > 0 && (
                  <optgroup label="Amigos con cuenta">
                    {friends.map(f => (
                      <option key={`friend-${f.friendshipId || f.friend?.id}`} value={f.friend?.id}>
                        {f.friend?.first_name || 'Sin nombre'} {f.friend?.last_name || ''} (@{f.friend?.nickname || 'usuario'})
                      </option>
                    ))}
                  </optgroup>
                )}
                
                {virtualFriends && virtualFriends.length > 0 && (
                  <optgroup label="Mis contactos">
                    {virtualFriends.map(vf => (
                      <option key={vf.id} value={`virtual_${vf.id}`}>
                        {vf.name} {vf.phone ? `(${vf.phone})` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              
              <button
                type="button"
                className="debts-add-friend-btn"
                onClick={openNewFriendModal}
                title="Agregar nuevo amigo"
              >
                <UserPlus size={20} />
              </button>
            </div>
            
            {/* Mensaje si no hay amigos */}
            {(!friends || friends.length === 0) && (!virtualFriends || virtualFriends.length === 0) && (
              <p className="debts-no-friends-hint">
                No tienes amigos agregados. <button type="button" onClick={openNewFriendModal} className="debts-link-btn">Agrega uno</button>
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
            icon={<DollarSign size={18} />}
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
              <div className="debts-select-with-button">
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
                  className="debts-add-bank-btn"
                  onClick={() => setShowCreateBankModal(true)}
                  title="Crear nueva cuenta bancaria"
                >
                  <Building2 size={18} />
                </button>
              </div>
              {bankAccounts.filter(acc => acc.currency === formData.currency).length === 0 && (
                <p className="debts-hint">
                  No tienes cuentas en {formData.currency}. <button type="button" onClick={() => setShowCreateBankModal(true)} className="debts-link-btn">Crea una aquí</button>
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
          <div className="debts-installments-section">
            <label className="debts-form-label">Número de cuotas</label>
            
            {/* Botones de cuotas predeterminadas */}
            <div className="debts-installment-buttons">
              {[1, 3, 6, 12].map(count => (
                <button
                  key={count}
                  type="button"
                  className={`debts-installment-btn ${formData.installments === count ? 'active' : ''}`}
                  onClick={() => setFormData(prev => ({ ...prev, installments: count }))}
                >
                  {count} {count === 1 ? 'cuota' : 'cuotas'}
                </button>
              ))}
            </div>
            
            {/* Input personalizado */}
            <div className="debts-custom-installment-input">
              <label className="debts-small-label">O ingresa un número personalizado:</label>
              <input
                type="number"
                min="1"
                max="48"
                placeholder="Ej: 18"
                className="debts-number-input"
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
              <p className="debts-hint">
                {formData.installments} cuotas de {currency}{(parseFloat(formData.amount || 0) / formData.installments).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            )}
          </div>

          {/* Fechas */}
          <div>
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

          <div className="debts-form-actions">
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
        <div>
          {/* Paso 1: Seleccionar tipo */}
          {newFriendType === null && (
            <>
              <p className="debts-hint">
                ¿Qué tipo de contacto quieres agregar?
              </p>
              <div>
                <button
                  type="button"
                  className="debts-friend-type-btn"
                  onClick={() => setNewFriendType('virtual')}
                >
                  <span className="debts-friend-type-icon"><FileText size={24} /></span>
                  <span className="debts-friend-type-label">Contacto Ficticio</span>
                  <span className="debts-friend-type-desc">Para personas sin cuenta en la app</span>
                </button>
                <button
                  type="button"
                  className="debts-friend-type-btn"
                  onClick={() => setNewFriendType('real')}
                >
                  <span className="debts-friend-type-icon">👤</span>
                  <span className="debts-friend-type-label">Amigo Real</span>
                  <span className="debts-friend-type-desc">Buscar por nickname de usuario</span>
                </button>
              </div>
            </>
          )}

          {/* Paso 2a: Crear contacto ficticio */}
          {newFriendType === 'virtual' && (
            <>
              <p className="debts-hint">
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
              <div className="debts-form-actions">
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
              <p className="debts-hint">
                Los amigos reales deben agregarse desde la sección de Amigos.
              </p>
              <div className="debts-form-actions">
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
          <div>
            <div className="debts-detail-header">
              <h3 className="debts-detail-title">{selectedDebt.description}</h3>
              <div className="debts-detail-amount">
                {formatCurrency(selectedDebt.amount)}
              </div>
            </div>

            <div className="debts-detail-section">
              {selectedDebt.purchase_date && (
                <div className="debt-detail-info-item">
                  <span><Wallet size={18} />Fecha de compra:</span>
                  <span className="debt-info-value">{formatDate(selectedDebt.purchase_date)}</span>
                </div>
              )}
              {selectedDebt.due_date && (
                <div className="debt-detail-info-item">
                  <span><Calendar size={18} />Primer vencimiento:</span>
                  <span className={`debt-info-value ${isOverdue(selectedDebt.due_date) && selectedDebt.status !== 'paid' ? 'overdue' : ''}`}>
                    {formatDate(selectedDebt.due_date)}
                  </span>
                </div>
              )}
              {selectedDebt.installments > 1 && (
                <div className="debt-detail-info-item">
                  <span><RefreshCw size={18} />Cuotas:</span>
                  <span className="debt-info-value">
                    {selectedDebt.installments} cuotas de {formatCurrency(selectedDebt.installment_amount || selectedDebt.amount / selectedDebt.installments)}
                  </span>
                </div>
              )}
            </div>

            {/* Lista de cuotas */}
            {selectedDebt.installments > 1 && (
              <div className="debts-detail-section">
                <h4 className="debts-detail-section-title"><FileText size={20} />Plan de pagos</h4>
                
                {loadingInstallments ? (
                  <Loading size="sm" text="Cargando cuotas..." />
                ) : debtInstallments.length > 0 ? (
                  debtInstallments.map((inst) => {
                    const isInstOverdue = isOverdue(inst.due_date) && !inst.paid;
                    return (
                      <div key={inst.id} className="debts-installment-item">
                        <div className="debts-installment-info">
                          <span className="debts-installment-number">
                            Cuota {inst.installment_number}/{selectedDebt.installments}
                          </span>
                          <span className="debts-installment-due">
                            Vence: {formatDate(inst.due_date)}
                          </span>
                        </div>
                        <div className="debts-installment-amount">
                          {formatCurrency(inst.amount)}
                        </div>
                        <span className={`debts-installment-status ${inst.paid ? 'paid' : isInstOverdue ? 'overdue' : 'pending'}`}>
                          {inst.paid ? (
                            <><CheckCircle size={14} /> Pagada</>
                          ) : isInstOverdue ? (
                            <><AlertCircle size={14} /> Vencida</>
                          ) : (
                            <><Clock size={14} /> Pendiente</>
                          )}
                        </span>
                        <div>
                          {!inst.paid && selectedDebt.creditor_id === user?.id && (
                            <Button 
                              size="sm" 
                              variant="success"
                              icon={<CheckCircle size={16} />}
                              onClick={() => handleMarkInstallmentPaid(inst.id)}
                            >
                              Pagar
                            </Button>
                          )}
                          {inst.paid && selectedDebt.creditor_id === user?.id && (
                            <Button 
                              size="sm" 
                              variant="warning"
                              icon={<RefreshCw size={16} />}
                              onClick={() => handleRevertInstallmentPayment(inst.id)}
                              title="Revertir pago"
                            >
                              Revertir
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="debts-empty-message">
                    No se encontraron cuotas registradas para esta deuda.
                  </p>
                )}
              </div>
            )}

            <div className="debts-form-actions">
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
        title={<span className="debts-detail-section-title"><Building2 size={22} />Crear Cuenta Bancaria</span>}
      >
        <form onSubmit={handleCreateBankAccount}>
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

          <div className="debts-form-actions">
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
        title={
          <span className="debts-detail-section-title">
            {debtToMarkPaid?.paid_by_creditor || debtToMarkPaid?.status === 'paid' 
              ? <><RefreshCw size={22} />{debtToMarkPaid?.paid_by_creditor ? "Revertir Pago" : "Reactivar Deuda"}</>
              : <><CheckCircle size={22} />Marcar como Pagada</>
            }
          </span>
        }
      >
        <div className="debts-confirm-modal">
          {debtToMarkPaid && (
            <>
              <p className="debts-confirm-text">
                {debtToMarkPaid.paid_by_creditor 
                  ? `¿Revertir el pago de "${debtToMarkPaid.description}"?`
                  : debtToMarkPaid.status === 'paid'
                  ? `¿Reactivar la deuda "${debtToMarkPaid.description}"?`
                  : `¿Confirmar que pagaste "${debtToMarkPaid.description}"?`
                }
              </p>
              <div className="debts-confirm-amount">
                {debtToMarkPaid.currency_symbol}{debtToMarkPaid.amount.toLocaleString('es-AR')}
              </div>
              <p className="debts-confirm-note">
                {debtToMarkPaid.paid_by_creditor 
                  ? 'La deuda volverá al estado "Aceptada".'
                  : debtToMarkPaid.status === 'paid'
                  ? 'La deuda se marcará como activa nuevamente por si cometiste un error.'
                  : 'Esta acción marcará la deuda como pagada. Si te equivocas, puedes revertirlo con el botón "No pagó".'
                }
              </p>
              <div className="debts-form-actions">
                <Button variant="secondary" onClick={() => setShowMarkPaidModal(false)}>
                  Cancelar
                </Button>
                <Button 
                  variant={debtToMarkPaid.paid_by_creditor || debtToMarkPaid.status === 'paid' ? "warning" : "success"}
                  onClick={debtToMarkPaid.paid_by_creditor ? confirmMarkAsPaid : confirmMarkPaidVirtual}
                  icon={debtToMarkPaid.paid_by_creditor || debtToMarkPaid.status === 'paid' ? <RefreshCw size={16} /> : <CheckCircle size={16} />}
                >
                  {debtToMarkPaid.paid_by_creditor || debtToMarkPaid.status === 'paid'
                    ? (debtToMarkPaid.paid_by_creditor ? 'Revertir' : 'Reactivar')
                    : 'Confirmar'
                  }
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
        title={<span className="debts-detail-section-title"><Bell size={22} />Enviar Recordatorio de Pago</span>}
      >
        <div className="debts-confirm-modal">
          {debtToCollect && (
            <>
              <p className="debts-confirm-text">
                ¿Enviar un recordatorio a {debtToCollect.debtor?.first_name} {debtToCollect.debtor?.last_name} para que pague esta deuda?
              </p>
              <div className="debts-detail-section">
                <div className="debt-detail-info-item">
                  <span><CreditCard size={18} />Deuda:</span>
                  <span className="debt-info-value">{debtToCollect.description}</span>
                </div>
                <div className="debt-detail-info-item">
                  <span><DollarSign size={18} />Monto:</span>
                  <span className="debt-info-value">
                    {debtToCollect.currency_symbol}{debtToCollect.amount.toLocaleString('es-AR')}
                  </span>
                </div>
                {debtToCollect.due_date && (
                  <div className="debt-detail-info-item">
                    <span><Calendar size={18} />Vencimiento:</span>
                    <span className="debt-info-value">{formatDate(debtToCollect.due_date)}</span>
                  </div>
                )}
              </div>
              <p className="debts-confirm-note">
                Se enviará una notificación amigable recordándole que tiene una deuda pendiente.
              </p>
              <div className="debts-form-actions">
                <Button variant="secondary" onClick={() => setShowCollectModal(false)} disabled={collecting}>
                  Cancelar
                </Button>
                <Button 
                  variant="info"
                  onClick={confirmCollect}
                  disabled={collecting}
                  icon={collecting ? <Clock size={16} /> : <Send size={16} />}
                >
                  {collecting ? 'Enviando...' : 'Enviar Recordatorio'}
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
