/**
 * SharedExpenses Page - Sistema de gastos compartidos estilo Splitwise
 * Mantiene el estilo visual del componente Friends
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth, useUI } from '../../context';
import { Button, Modal, Loading, EmptyState } from '../../components';
import sharedExpensesService from '../../services/sharedExpensesService';
import bankAccountsService from '../../services/bankAccountsService';
import { createExpense, updateExpense, getExpenses } from '../../services/expensesService';
import virtualFriendsService from '../../services/virtualFriendsService';
import { useFriends } from '../../context';
import { 
  Users, Plus, Wallet, TrendingUp, TrendingDown, 
  Settings, Trash2, UserPlus, Receipt, PieChart,
  Check, X, Clock, ArrowRight, Edit2, History,
  DollarSign, CreditCard, Home, Plane, Utensils,
  Car, Film, ShoppingBag, Zap, Heart, MoreHorizontal,
  AlertCircle, CheckCircle, MinusCircle, PlusCircle,
  Tag, Calendar, FileText, ChevronRight, Bell, XCircle
} from 'lucide-react';
import './SharedExpenses.css';

// Iconos de categorías
const CATEGORY_ICONS = {
  viaje: Plane,
  casa: Home,
  comida: Utensils,
  transporte: Car,
  entretenimiento: Film,
  compras: ShoppingBag,
  servicios: Zap,
  salud: Heart,
  otros: MoreHorizontal,
  general: Tag
};

// Componente principal
const SharedExpenses = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useUI();
  const { friends } = useFriends();

  // Estados principales
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [activeView, setActiveView] = useState('groups'); // 'groups' | 'detail' | 'balances' | 'history'
  
  // Estados para modales
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [showBankConfirmModal, setShowBankConfirmModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showExpenseDetailModal, setShowExpenseDetailModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [expenseDetail, setExpenseDetail] = useState(null);
  const [loadingExpenseDetail, setLoadingExpenseDetail] = useState(false);
  
  // Estados para datos del grupo seleccionado
  const [groupExpenses, setGroupExpenses] = useState([]);
  const [groupBalances, setGroupBalances] = useState([]);
  const [settlementSuggestions, setSettlementSuggestions] = useState([]);
  const [groupStats, setGroupStats] = useState(null);
  
  // Estados para formularios
  const [editingGroup, setEditingGroup] = useState(null);
  const [virtualFriends, setVirtualFriends] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pendingExpenseData, setPendingExpenseData] = useState(null);

  // Cargar grupos al iniciar
  useEffect(() => {
    if (user) {
      loadGroups();
      loadVirtualFriends();
      loadBankAccounts();
      loadCategories();
    }
  }, [user]);

  const loadGroups = async () => {
    setLoading(true);
    const result = await sharedExpensesService.getUserGroups(user.id);
    if (!result.error) {
      setGroups(result.groups || []);
    }
    setLoading(false);
  };

  const loadVirtualFriends = async () => {
    const result = await virtualFriendsService.getVirtualFriends(user.id);
    if (!result.error) {
      setVirtualFriends(result.friends || []);
    }
  };

  const loadBankAccounts = async () => {
    const result = await bankAccountsService.getUserAccounts(user.id);
    if (!result.error) {
      setBankAccounts(result.accounts || []);
    }
  };

  const loadCategories = async () => {
    const result = await sharedExpensesService.getUserCategories(user.id);
    if (!result.error) {
      setCategories(result.categories || []);
    }
  };

  const loadGroupDetails = async (groupId) => {
    const [detailsResult, expensesResult, balancesResult, statsResult] = await Promise.all([
      sharedExpensesService.getGroupDetails(groupId),
      sharedExpensesService.getGroupExpenses(groupId),
      sharedExpensesService.getGroupBalances(groupId),
      sharedExpensesService.getGroupStats(groupId)
    ]);

    if (!detailsResult.error) {
      setSelectedGroup(detailsResult.group);
    }
    if (!expensesResult.error) {
      setGroupExpenses(expensesResult.expenses);
    }
    if (!balancesResult.error) {
      setGroupBalances(balancesResult.balances);
      setSettlementSuggestions(balancesResult.settlements);
    }
    if (!statsResult.error) {
      setGroupStats(statsResult.stats);
    }
  };

  const handleSelectGroup = async (group) => {
    await loadGroupDetails(group.id);
    setActiveView('detail');
  };

  const handleBackToGroups = () => {
    setSelectedGroup(null);
    setGroupExpenses([]);
    setGroupBalances([]);
    setActiveView('groups');
  };

  // Handlers de grupos
  const handleCreateGroup = async (groupData) => {
    const result = await sharedExpensesService.createGroup(user.id, groupData);
    if (!result.error) {
      showSuccess('Grupo creado correctamente');
      loadGroups();
      setShowGroupModal(false);
    } else {
      showError('Error al crear el grupo');
    }
  };

  const handleUpdateGroup = async (groupData) => {
    const result = await sharedExpensesService.updateGroup(editingGroup.id, groupData);
    if (!result.error) {
      showSuccess('Grupo actualizado');
      loadGroups();
      if (selectedGroup?.id === editingGroup.id) {
        loadGroupDetails(editingGroup.id);
      }
      setShowGroupModal(false);
      setEditingGroup(null);
    } else {
      showError('Error al actualizar el grupo');
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (window.confirm('¿Estás seguro de eliminar este grupo? Esta acción no se puede deshacer.')) {
      const result = await sharedExpensesService.deleteGroup(groupId);
      if (!result.error) {
        showSuccess('Grupo eliminado');
        loadGroups();
        if (selectedGroup?.id === groupId) {
          handleBackToGroups();
        }
      } else {
        showError('Error al eliminar el grupo');
      }
    }
  };

  // Handlers de miembros
  const handleAddMember = async (memberData) => {
    let result;
    if (memberData.type === 'friend') {
      result = await sharedExpensesService.addMember(selectedGroup.id, memberData.userId);
    } else {
      result = await sharedExpensesService.addVirtualMember(
        selectedGroup.id, 
        memberData.virtualFriendId, 
        memberData.displayName
      );
    }

    if (!result.error) {
      showSuccess('Miembro agregado');
      loadGroupDetails(selectedGroup.id);
      setShowMemberModal(false);
    } else {
      showError(result.error || 'Error al agregar miembro');
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (window.confirm('¿Quitar a este miembro del grupo?')) {
      const result = await sharedExpensesService.removeMember(memberId);
      if (!result.error) {
        showSuccess('Miembro removido');
        loadGroupDetails(selectedGroup.id);
      } else {
        showError('Error al remover miembro');
      }
    }
  };

  // Handlers de gastos
  const handleCreateExpense = async (expenseData) => {
    // Verificar si el usuario que registra el gasto es quien pagó (o pagó parcialmente)
    const currentUserMember = selectedGroup.members.find(m => m.userId === user.id);
    const userIsPayer = expenseData.payers.some(p => p.memberId === currentUserMember?.id);

    if (userIsPayer && bankAccounts.length > 0) {
      // Guardar datos del gasto y mostrar modal de confirmación bancaria
      setPendingExpenseData(expenseData);
      setShowExpenseModal(false);
      setShowBankConfirmModal(true);
      return;
    }

    // Si no es quien pagó o no tiene cuentas bancarias, crear el gasto directamente
    await createExpenseWithoutBank(expenseData);
  };

  const createExpenseWithoutBank = async (expenseData) => {
    const result = await sharedExpensesService.createSharedExpense(user.id, {
      ...expenseData,
      groupId: selectedGroup.id
    });

    if (!result.error) {
      if (result.needsValidation) {
        showSuccess(`Gasto registrado. Pendiente de validación por ${result.validatorsCount} participante(s).`);
      } else {
        showSuccess('Gasto registrado');
      }
      loadGroupDetails(selectedGroup.id);
      setShowExpenseModal(false);
      setPendingExpenseData(null);
    } else {
      showError('Error al registrar el gasto');
    }
  };

  const handleBankConfirmation = async (linkToBank, bankAccountId) => {
    if (!pendingExpenseData) return;

    // Crear el gasto compartido
    const result = await sharedExpensesService.createSharedExpense(user.id, {
      ...pendingExpenseData,
      groupId: selectedGroup.id
    });

    if (!result.error) {
      // Si requiere validación, mostrar mensaje especial
      if (result.needsValidation) {
        showSuccess(`Gasto registrado. Pendiente de validación por ${result.validatorsCount} participante(s).`);
        loadGroupDetails(selectedGroup.id);
        setShowBankConfirmModal(false);
        setPendingExpenseData(null);
        return;
      }
      
      if (linkToBank && bankAccountId) {
        // Calcular la parte REAL que le corresponde al usuario (no lo que pagó)
        const currentUserMember = selectedGroup.members.find(m => m.userId === user.id);
        const userPayment = pendingExpenseData.payers.find(p => p.memberId === currentUserMember?.id);
        
        if (userPayment) {
          // Calcular la parte real del usuario según el tipo de división
          let userRealShare = 0;
          const totalAmount = parseFloat(pendingExpenseData.totalAmount) || 0;
          
          // Obtener participantes activos
          const participantIds = pendingExpenseData.participantIds || selectedGroup.members.map(m => m.id);
          const participantsCount = participantIds.length;
          
          if (pendingExpenseData.splitType === 'equal') {
            // División equitativa: su parte es el total dividido entre participantes
            userRealShare = totalAmount / participantsCount;
          } else if (pendingExpenseData.splitType === 'custom' && pendingExpenseData.customSplits) {
            // División personalizada: usar el monto asignado al usuario
            userRealShare = parseFloat(pendingExpenseData.customSplits[currentUserMember?.id]) || 0;
          } else {
            // Fallback: división equitativa
            userRealShare = totalAmount / participantsCount;
          }
          
          console.log('💰 Gasto compartido - Usuario pagó:', userPayment.amount, '- Su parte real:', userRealShare);
          
          // Solo registrar en el banco si la parte real es mayor a 0
          if (userRealShare > 0) {
            await createExpense({
              userId: user.id,
              amount: userRealShare, // ← Solo su parte real, no lo que pagó
              description: `${pendingExpenseData.description} (Gasto compartido - ${selectedGroup.name})`,
              category: pendingExpenseData.category || 'otros',
              paymentSource: 'bank',
              date: pendingExpenseData.expenseDate,
              isPaid: true,
              currency: selectedGroup.currency || 'ARS',
              currency_symbol: selectedGroup.currency_symbol || '$',
              bank_account_id: bankAccountId
            });

            showSuccess(`Gasto registrado. Tu parte: ${selectedGroup.currency_symbol}${userRealShare.toFixed(2)}`);
          } else {
            showSuccess('Gasto registrado correctamente');
          }
        }
      } else {
        showSuccess('Gasto registrado correctamente');
      }

      loadGroupDetails(selectedGroup.id);
    } else {
      showError('Error al registrar el gasto');
    }

    setShowBankConfirmModal(false);
    setPendingExpenseData(null);
  };

  const handleDeleteExpense = async (expenseId) => {
    if (window.confirm('¿Solicitar eliminación de este gasto? Se notificará a los demás participantes para su aprobación.')) {
      const requesterName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Un usuario';
      const result = await sharedExpensesService.requestDeleteSharedExpense(expenseId, user.id, requesterName);
      
      if (!result.error) {
        if (result.needsApproval) {
          showSuccess(`Solicitud enviada. Se notificó a ${result.participantsNotified} participante(s) para que aprueben la eliminación.`);
        } else {
          showSuccess('Gasto eliminado');
          loadGroupDetails(selectedGroup.id);
        }
      } else {
        showError('Error al solicitar eliminación: ' + result.error);
      }
    }
  };

  // Handler para ver detalle del gasto
  const handleViewExpense = async (expense) => {
    setSelectedExpense(expense);
    setLoadingExpenseDetail(true);
    setShowExpenseDetailModal(true);
    
    const result = await sharedExpensesService.getExpenseDetails(expense.id);
    if (!result.error) {
      setExpenseDetail(result.expense);
    } else {
      showError('Error al cargar detalle del gasto');
    }
    setLoadingExpenseDetail(false);
  };

  // Handler para aprobar un gasto pendiente de validación
  const handleApproveExpense = async (expense) => {
    if (!window.confirm(`¿Confirmas que reconoces el gasto "${expense.description}" por ${expense.currency_symbol}${parseFloat(expense.total_amount).toLocaleString('es-AR')}?`)) {
      return;
    }

    const result = await sharedExpensesService.approveSharedExpense(expense.id, user.id);
    
    if (result.success) {
      if (result.expenseApproved) {
        showSuccess('¡Gasto aprobado! El gasto ahora está activo y se incluirá en los cálculos.');
      } else {
        showSuccess(`Tu aprobación fue registrada. Faltan ${result.pendingCount} aprobación(es) más.`);
      }
      loadGroupDetails(selectedGroup.id);
    } else {
      showError('Error al aprobar el gasto: ' + result.error);
    }
  };

  // Handler para rechazar un gasto pendiente de validación
  const handleRejectExpense = async (expense) => {
    const reason = window.prompt(`¿Por qué rechazas el gasto "${expense.description}"? (opcional)`);
    
    // Si el usuario cancela el prompt, no continuar
    if (reason === null) return;
    
    if (!window.confirm(`¿Estás seguro de rechazar este gasto? El creador será notificado y el gasto no se contabilizará.`)) {
      return;
    }

    const result = await sharedExpensesService.rejectSharedExpense(expense.id, user.id, reason || null);
    
    if (result.success) {
      showSuccess('Gasto rechazado. El creador ha sido notificado.');
      loadGroupDetails(selectedGroup.id);
    } else {
      showError('Error al rechazar el gasto: ' + result.error);
    }
  };

  // Handler para finalizar/saldar un gasto
  const handleSettleExpense = async (expenseId, deductFromBank, bankAccountId, isResigning = false, resignAmount = 0) => {
    // Marcar el gasto como saldado
    const result = await sharedExpensesService.settleExpense(expenseId);
    
    if (!result.error) {
      // Si el usuario quiere descontar de su banco
      if (deductFromBank && bankAccountId && expenseDetail) {
        const currentUserMember = selectedGroup.members.find(m => m.userId === user.id);
        
        // Si está resignando, usar el monto total que pagó (resignAmount)
        // Si no está resignando, usar su parte del gasto (pendingAmount)
        let amountToDeduct = 0;
        let description = '';
        
        if (isResigning && resignAmount > 0) {
          // Resignar deuda: registrar el monto real que pagó el acreedor
          amountToDeduct = resignAmount;
          description = `${expenseDetail.description} (Gasto compartido resignado - ${selectedGroup.name})`;
        } else {
          const userSplit = expenseDetail.splits.find(s => s.memberId === currentUserMember?.id);
          if (userSplit && userSplit.pendingAmount > 0) {
            // Calcular la parte real del usuario (monto total / participantes)
            const totalParticipants = expenseDetail.splits?.length || 1;
            amountToDeduct = expenseDetail.amount / totalParticipants;
            description = `${expenseDetail.description} (Pago de gasto compartido - ${selectedGroup.name})`;
          }
        }
        
        if (amountToDeduct > 0) {
          // Crear el gasto personal del usuario
          await createExpense({
            userId: user.id,
            amount: amountToDeduct,
            description: description,
            category: expenseDetail.category || 'otros',
            paymentSource: 'bank',
            date: new Date().toISOString().split('T')[0],
            isPaid: true,
            currency: selectedGroup.currency || 'ARS',
            currency_symbol: selectedGroup.currency_symbol || '$',
            bank_account_id: bankAccountId
          });
          
          if (isResigning) {
            showSuccess('Deuda resignada. Tu gasto real se registró en tu cuenta.');
          } else {
            showSuccess('Gasto finalizado y descontado de tu cuenta');
          }
        } else {
          showSuccess('Gasto finalizado correctamente');
        }
      } else {
        if (isResigning) {
          showSuccess('Deuda resignada correctamente');
        } else {
          showSuccess('Gasto finalizado correctamente');
        }
      }
      
      loadGroupDetails(selectedGroup.id);
      setShowExpenseDetailModal(false);
      setExpenseDetail(null);
      setSelectedExpense(null);
    } else {
      showError('Error al finalizar el gasto');
    }
  };

  // Handlers de liquidaciones
  const handleCreateSettlement = async (settlementData) => {
    const result = await sharedExpensesService.createSettlement(user.id, {
      ...settlementData,
      groupId: selectedGroup.id
    });

    if (!result.error) {
      showSuccess('Liquidación registrada');
      loadGroupDetails(selectedGroup.id);
      setShowSettlementModal(false);
    } else {
      showError('Error al registrar la liquidación');
    }
  };

  // Handler para solicitar confirmación de pago ("Ya pagué")
  const handlePaymentRequest = async (paymentData) => {
    const currentMember = selectedGroup.members.find(m => m.userId === user.id);
    
    if (!currentMember) {
      showError('Error: No se encontró tu membresía en el grupo');
      return;
    }

    const result = await sharedExpensesService.createPaymentRequest({
      groupId: selectedGroup.id,
      debtorMemberId: currentMember.id,
      debtorUserId: user.id,
      creditorMemberId: paymentData.creditorMemberId,
      creditorUserId: paymentData.creditorUserId,
      amount: paymentData.amount,
      currency: selectedGroup.currency || 'ARS',
      currencySymbol: selectedGroup.currency_symbol || '$',
      notes: paymentData.notes
    });

    if (!result.error) {
      showSuccess('Solicitud de pago enviada. ' + (paymentData.creditorUserId ? 'Se notificará al acreedor.' : ''));
      loadGroupDetails(selectedGroup.id);
    } else {
      showError('Error al enviar solicitud de pago: ' + result.error);
    }
  };

  // Handler para solicitar cobro ("Cobrar")
  const handleCollectionRequest = async (collectionData) => {
    const currentMember = selectedGroup.members.find(m => m.userId === user.id);
    
    if (!currentMember) {
      showError('Error: No se encontró tu membresía en el grupo');
      return;
    }

    const result = await sharedExpensesService.createCollectionRequest({
      groupId: selectedGroup.id,
      creditorMemberId: currentMember.id,
      creditorUserId: user.id,
      debtorMemberId: collectionData.debtorMemberId,
      debtorUserId: collectionData.debtorUserId,
      amount: collectionData.amount,
      currency: selectedGroup.currency || 'ARS',
      currencySymbol: selectedGroup.currency_symbol || '$',
      notes: collectionData.notes
    });

    if (!result.error) {
      showSuccess('Recordatorio de cobro enviado. ' + (collectionData.debtorUserId ? 'Se notificará al deudor.' : ''));
      loadGroupDetails(selectedGroup.id);
    } else {
      showError('Error al enviar recordatorio: ' + result.error);
    }
  };

  // Handler para resignar deuda (el acreedor asume el gasto total)
  const handleResignDebt = async (expenseId, bankAccountId = null, creditorPaidAmount = 0) => {
    console.log('handleResignDebt llamado:', { expenseId, bankAccountId, creditorPaidAmount, userId: user.id });
    
    try {
      const result = await sharedExpensesService.resignExpenseDebt(
        expenseId,
        user.id,
        bankAccountId,
        null
      );

      console.log('Resultado de resignExpenseDebt:', result);

      if (!result.error && result.result?.success) {
        // Si eligió registrar en banco, buscar si ya existe un gasto vinculado y actualizarlo
        if (bankAccountId && creditorPaidAmount > 0) {
          const expenseDescription = result.result.expense_description || expenseDetail?.description || 'Gasto compartido';
          const groupName = selectedGroup.name;
          
          // Buscar el gasto existente que coincida con este gasto compartido
          // El patrón de descripción es: "descripción (Gasto compartido - nombreGrupo)"
          const searchPattern = `(Gasto compartido - ${groupName})`;
          
          console.log('Buscando gasto existente con patrón:', searchPattern);
          
          const expensesResult = await getExpenses(user.id, { bank_account_id: bankAccountId });
          
          let existingExpense = null;
          if (!expensesResult.error && expensesResult.expenses) {
            // Buscar gasto que coincida con la descripción del gasto compartido
            existingExpense = expensesResult.expenses.find(exp => {
              const descMatch = exp.description?.includes(searchPattern) || 
                               exp.description?.includes(expenseDescription);
              const dateMatch = exp.date === expenseDetail?.expense_date;
              return descMatch && dateMatch;
            });
            
            // Si no encontramos por fecha exacta, buscar solo por descripción
            if (!existingExpense) {
              existingExpense = expensesResult.expenses.find(exp => 
                exp.description?.includes(searchPattern) && 
                exp.description?.includes(expenseDescription.split(' (')[0])
              );
            }
          }
          
          if (existingExpense) {
            // Actualizar el gasto existente con el nuevo monto total
            console.log('Actualizando gasto existente:', existingExpense.id, 'de', existingExpense.amount, 'a', creditorPaidAmount);
            await updateExpense(existingExpense.id, {
              amount: creditorPaidAmount,
              description: `${expenseDescription} (Gasto compartido - ${groupName})`
            });
            showSuccess(`Gasto actualizado. Ahora refleja el total: ${selectedGroup.currency_symbol}${creditorPaidAmount}`);
          } else {
            // No existe gasto previo, crear uno nuevo
            console.log('Creando nuevo gasto en banco:', creditorPaidAmount);
            await createExpense({
              userId: user.id,
              amount: creditorPaidAmount,
              description: `${expenseDescription} (Gasto compartido - ${groupName})`,
              category: expenseDetail?.category || 'otros',
              paymentSource: 'bank',
              date: expenseDetail?.expense_date || new Date().toISOString().split('T')[0],
              isPaid: true,
              currency: selectedGroup.currency || 'ARS',
              currency_symbol: selectedGroup.currency_symbol || '$',
              bank_account_id: bankAccountId
            });
            showSuccess('Deuda resignada y gasto registrado en banco.');
          }
        } else {
          showSuccess('Deuda resignada. El gasto quedó saldado.');
        }
        
        loadGroupDetails(selectedGroup.id);
        setShowExpenseDetailModal(false);
        setExpenseDetail(null);
        setSelectedExpense(null);
      } else {
        console.error('Error en resultado:', result);
        showError('Error al resignar deuda: ' + (result.result?.error || result.error || 'Error desconocido'));
      }
    } catch (error) {
      console.error('Error en handleResignDebt:', error);
      showError('Error al resignar deuda: ' + error.message);
    }
  };

  // Handlers de categorías
  const handleCreateCategory = async (categoryData) => {
    const result = await sharedExpensesService.createCategory(user.id, categoryData);
    if (!result.error) {
      showSuccess('Categoría creada');
      loadCategories();
      setShowCategoryModal(false);
    } else {
      showError('Error al crear categoría');
    }
  };

  if (loading) {
    return (
      <div className="shared-loading">
        <div className="shared-loading-spinner"></div>
        <span className="shared-loading-text">Cargando grupos...</span>
      </div>
    );
  }

  return (
    <div className="shared-page">
      {/* Header */}
      <header className="shared-header">
        <div className="shared-header-content">
          <div className="shared-header-left">
            <div className="shared-header-icon">
              <Wallet size={40} />
            </div>
            <h1 className="shared-title">Gastos Compartidos</h1>
            <p className="shared-subtitle">
              <Users size={18} />
              {groups.length} grupo{groups.length !== 1 ? 's' : ''} activo{groups.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="shared-header-actions">
            <button 
              className="shared-btn-add"
              onClick={() => { setEditingGroup(null); setShowGroupModal(true); }}
            >
              <Plus size={18} />
              Nuevo Grupo
            </button>
          </div>
        </div>
      </header>

      {/* Vista principal */}
      {activeView === 'groups' ? (
        <GroupsList 
          groups={groups}
          onSelectGroup={handleSelectGroup}
          onEditGroup={(group) => { setEditingGroup(group); setShowGroupModal(true); }}
          onDeleteGroup={handleDeleteGroup}
        />
      ) : (
        <GroupDetail
          group={selectedGroup}
          expenses={groupExpenses}
          balances={groupBalances}
          settlements={settlementSuggestions}
          stats={groupStats}
          currentUserId={user.id}
          onBack={handleBackToGroups}
          onAddExpense={() => setShowExpenseModal(true)}
          onAddMember={() => setShowMemberModal(true)}
          onDeleteExpense={handleDeleteExpense}
          onViewExpense={handleViewExpense}
          onApproveExpense={handleApproveExpense}
          onRejectExpense={handleRejectExpense}
          onRemoveMember={handleRemoveMember}
          onSettle={() => setShowSettlementModal(true)}
          onEditGroup={() => { setEditingGroup(selectedGroup); setShowGroupModal(true); }}
          onPaymentRequest={handlePaymentRequest}
          onCollectionRequest={handleCollectionRequest}
        />
      )}

      {/* Modales */}
      {showGroupModal && (
        <GroupModal
          group={editingGroup}
          categories={categories}
          onSave={editingGroup ? handleUpdateGroup : handleCreateGroup}
          onClose={() => { setShowGroupModal(false); setEditingGroup(null); }}
          onAddCategory={() => setShowCategoryModal(true)}
        />
      )}

      {showExpenseModal && selectedGroup && (
        <ExpenseModal
          group={selectedGroup}
          categories={categories}
          onSave={handleCreateExpense}
          onClose={() => setShowExpenseModal(false)}
          onAddCategory={() => setShowCategoryModal(true)}
        />
      )}

      {showMemberModal && selectedGroup && (
        <MemberModal
          group={selectedGroup}
          friends={friends}
          virtualFriends={virtualFriends}
          onSave={handleAddMember}
          onClose={() => setShowMemberModal(false)}
        />
      )}

      {showSettlementModal && selectedGroup && (
        <SettlementModal
          group={selectedGroup}
          balances={groupBalances}
          suggestions={settlementSuggestions}
          onSave={handleCreateSettlement}
          onClose={() => setShowSettlementModal(false)}
        />
      )}

      {showBankConfirmModal && (
        <BankConfirmModal
          expense={pendingExpenseData}
          bankAccounts={bankAccounts}
          groupCurrency={selectedGroup?.currency || 'ARS'}
          onConfirm={handleBankConfirmation}
          onClose={() => { setShowBankConfirmModal(false); createExpenseWithoutBank(pendingExpenseData); }}
        />
      )}

      {showCategoryModal && (
        <CategoryModal
          onSave={handleCreateCategory}
          onClose={() => setShowCategoryModal(false)}
        />
      )}

      {showExpenseDetailModal && selectedExpense && (
        <ExpenseDetailModal
          expense={expenseDetail}
          loading={loadingExpenseDetail}
          group={selectedGroup}
          currentUserId={user.id}
          bankAccounts={bankAccounts}
          onSettle={handleSettleExpense}
          onCollectionRequest={handleCollectionRequest}
          onResignDebt={handleResignDebt}
          onClose={() => { 
            setShowExpenseDetailModal(false); 
            setExpenseDetail(null);
            setSelectedExpense(null);
          }}
        />
      )}
    </div>
  );
};

// ============================================
// COMPONENTE: Lista de Grupos
// ============================================
const GroupsList = ({ groups, onSelectGroup, onEditGroup, onDeleteGroup }) => {
  if (groups.length === 0) {
    return (
      <div className="shared-empty">
        <div className="shared-empty-icon">
          <Users size={64} />
        </div>
        <h3>No tienes grupos todavía</h3>
        <p>Crea tu primer grupo para comenzar a dividir gastos con amigos</p>
      </div>
    );
  }

  return (
    <div className="shared-groups-grid">
      {groups.map(group => {
        const CategoryIcon = CATEGORY_ICONS[group.category?.toLowerCase()] || Tag;
        const balance = parseFloat(group.userBalance) || 0;

        return (
          <div key={group.id} className="shared-group-card" onClick={() => onSelectGroup(group)}>
            <div className="shared-group-card-header">
              <div className="shared-group-icon">
                <CategoryIcon size={24} />
              </div>
              <div className="shared-group-actions">
                <button 
                  className="shared-icon-btn"
                  onClick={(e) => { e.stopPropagation(); onEditGroup(group); }}
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  className="shared-icon-btn shared-icon-btn-danger"
                  onClick={(e) => { e.stopPropagation(); onDeleteGroup(group.id); }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            
            <h3 className="shared-group-name">{group.name}</h3>
            {group.description && (
              <p className="shared-group-description">{group.description}</p>
            )}
            
            <div className="shared-group-stats">
              <div className="shared-group-stat">
                <span className="shared-group-stat-label">Total gastado</span>
                <span className="shared-group-stat-value">
                  {group.currency_symbol}{parseFloat(group.total_spent || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="shared-group-stat">
                <span className="shared-group-stat-label">Tu balance</span>
                <span className={`shared-group-stat-value ${balance > 0 ? 'positive' : balance < 0 ? 'negative' : ''}`}>
                  {balance > 0 && '+'}
                  {group.currency_symbol}{Math.abs(balance).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="shared-group-footer">
              <span className="shared-group-badge">
                {group.userRole === 'admin' ? 'Admin' : 'Miembro'}
              </span>
              <ChevronRight size={20} className="shared-group-arrow" />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ============================================
// COMPONENTE: Detalle del Grupo
// ============================================
const GroupDetail = ({ 
  group, 
  expenses, 
  balances, 
  settlements, 
  stats,
  currentUserId,
  onBack, 
  onAddExpense, 
  onAddMember,
  onDeleteExpense,
  onViewExpense,
  onApproveExpense,
  onRejectExpense,
  onRemoveMember,
  onSettle,
  onEditGroup,
  onPaymentRequest,
  onCollectionRequest
}) => {
  const [activeTab, setActiveTab] = useState('expenses');
  const CategoryIcon = CATEGORY_ICONS[group?.category?.toLowerCase()] || Tag;

  if (!group) return null;

  const currentMember = group.members?.find(m => m.userId === currentUserId);
  const userBalance = currentMember?.balance || 0;

  return (
    <div className="shared-detail">
      {/* Header del grupo */}
      <div className="shared-detail-header">
        <button className="shared-back-btn" onClick={onBack}>
          ← Volver a grupos
        </button>
        
        <div className="shared-detail-info">
          <div className="shared-detail-icon">
            <CategoryIcon size={32} />
          </div>
          <div className="shared-detail-text">
            <h2>{group.name}</h2>
            {group.description && <p>{group.description}</p>}
          </div>
          <button className="shared-icon-btn" onClick={onEditGroup}>
            <Settings size={20} />
          </button>
        </div>

        {/* Stats resumidos */}
        <div className="shared-detail-stats">
          <div className="shared-stat-card">
            <div className="shared-stat-icon">
              <Receipt size={20} />
            </div>
            <div className="shared-stat-content">
              <span className="shared-stat-value">
                {group.currency_symbol}{parseFloat(group.total_spent || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
              <span className="shared-stat-label">Total gastado</span>
            </div>
          </div>
          
          <div className="shared-stat-card">
            <div className="shared-stat-icon">
              <Users size={20} />
            </div>
            <div className="shared-stat-content">
              <span className="shared-stat-value">{group.members?.length || 0}</span>
              <span className="shared-stat-label">Miembros</span>
            </div>
          </div>

          <div className={`shared-stat-card ${userBalance > 0 ? 'positive' : userBalance < 0 ? 'negative' : ''}`}>
            <div className="shared-stat-icon">
              {userBalance > 0 ? <TrendingUp size={20} /> : userBalance < 0 ? <TrendingDown size={20} /> : <DollarSign size={20} />}
            </div>
            <div className="shared-stat-content">
              <span className="shared-stat-value">
                {userBalance > 0 && '+'}
                {group.currency_symbol}{Math.abs(userBalance).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
              <span className="shared-stat-label">
                {userBalance > 0 ? 'Te deben' : userBalance < 0 ? 'Debes' : 'Balanceado'}
              </span>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="shared-detail-actions">
          <button className="shared-btn-primary" onClick={onAddExpense}>
            <Plus size={18} />
            Agregar Gasto
          </button>
          <button className="shared-btn-secondary" onClick={onAddMember}>
            <UserPlus size={18} />
            Agregar Miembro
          </button>
          {settlements.length > 0 && (
            <button className="shared-btn-success" onClick={onSettle}>
              <CheckCircle size={18} />
              Liquidar
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="shared-tabs">
        <button 
          className={`shared-tab ${activeTab === 'expenses' ? 'active' : ''}`}
          onClick={() => setActiveTab('expenses')}
        >
          <Receipt size={18} />
          Gastos ({expenses.length})
        </button>
        <button 
          className={`shared-tab ${activeTab === 'balances' ? 'active' : ''}`}
          onClick={() => setActiveTab('balances')}
        >
          <PieChart size={18} />
          Balances
        </button>
        <button 
          className={`shared-tab ${activeTab === 'members' ? 'active' : ''}`}
          onClick={() => setActiveTab('members')}
        >
          <Users size={18} />
          Miembros ({group.members?.length || 0})
        </button>
      </div>

      {/* Contenido */}
      <div className="shared-tab-content">
        {activeTab === 'expenses' && (
          <ExpensesList 
            expenses={expenses} 
            group={group}
            onDelete={onDeleteExpense}
            onView={onViewExpense}
            onApprove={onApproveExpense}
            onReject={onRejectExpense}
            currentUserId={currentUserId}
          />
        )}
        {activeTab === 'balances' && (
          <BalancesView 
            balances={balances} 
            settlements={settlements}
            group={group}
            currentUserId={currentUserId}
            onPaymentRequest={onPaymentRequest}
            onCollectionRequest={onCollectionRequest}
          />
        )}
        {activeTab === 'members' && (
          <MembersList 
            members={group.members} 
            currentUserId={currentUserId}
            createdBy={group.created_by}
            onRemove={onRemoveMember}
          />
        )}
      </div>
    </div>
  );
};

// ============================================
// COMPONENTE: Lista de Gastos
// ============================================
const ExpensesList = ({ expenses, group, onDelete, onView, onApprove, onReject, currentUserId }) => {
  if (expenses.length === 0) {
    return (
      <div className="shared-empty-state">
        <Receipt size={48} />
        <p>No hay gastos registrados</p>
      </div>
    );
  }

  return (
    <div className="shared-expenses-list">
      {expenses.map(expense => {
        const CategoryIcon = CATEGORY_ICONS[expense.category?.toLowerCase()] || Tag;
        const payerNames = expense.payers?.map(p => p.displayName).join(', ') || 'Desconocido';
        
        // Verificar si este usuario necesita validar este gasto
        const myValidation = expense.validations?.find(v => v.user_id === currentUserId);
        const needsMyValidation = expense.isPending && myValidation?.status === 'pending';
        const iCreatedIt = expense.created_by === currentUserId;

        return (
          <div 
            key={expense.id} 
            className={`shared-expense-item shared-expense-clickable ${expense.isPending ? 'pending-validation' : ''} ${expense.isRejected ? 'rejected' : ''}`}
            onClick={() => onView(expense)}
          >
            {/* Badge de estado de validación */}
            {expense.isPending && (
              <div className="validation-badge pending">
                <Clock size={12} />
                {iCreatedIt 
                  ? `Esperando ${expense.pendingValidators} aprobación(es)` 
                  : needsMyValidation 
                    ? 'Requiere tu aprobación' 
                    : 'Pendiente de validación'}
              </div>
            )}
            {expense.isRejected && (
              <div className="validation-badge rejected">
                <XCircle size={12} />
                Rechazado
              </div>
            )}

            <div className="shared-expense-icon">
              <CategoryIcon size={20} />
            </div>
            
            <div className="shared-expense-info">
              <h4>{expense.description}</h4>
              <div className="shared-expense-meta">
                <span>
                  <Calendar size={14} />
                  {new Date(expense.expense_date).toLocaleDateString('es-AR')}
                </span>
                <span>
                  <Users size={14} />
                  Pagó: {payerNames}
                </span>
              </div>
            </div>

            <div className="shared-expense-amount">
              <span className="shared-expense-total">
                {expense.currency_symbol}{parseFloat(expense.total_amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
              <span className={`shared-expense-status ${expense.is_settled ? 'settled' : expense.isPending ? 'validation-pending' : 'pending'}`}>
                {expense.is_settled ? 'Saldado' : expense.isPending ? 'Por validar' : 'Pendiente'}
              </span>
            </div>

            <div className="shared-expense-actions">
              {/* Botones de validación si necesita mi aprobación */}
              {needsMyValidation && (
                <>
                  <button 
                    className="shared-icon-btn shared-icon-btn-success"
                    onClick={(e) => { e.stopPropagation(); onApprove(expense); }}
                    title="Aprobar gasto"
                  >
                    <Check size={16} />
                  </button>
                  <button 
                    className="shared-icon-btn shared-icon-btn-danger"
                    onClick={(e) => { e.stopPropagation(); onReject(expense); }}
                    title="Rechazar gasto"
                  >
                    <X size={16} />
                  </button>
                </>
              )}
              
              <button 
                className="shared-icon-btn shared-icon-btn-view"
                onClick={(e) => { e.stopPropagation(); onView(expense); }}
                title="Ver detalle"
              >
                <FileText size={16} />
              </button>
              {/* Solo mostrar delete si el gasto está aprobado o si yo lo creé */}
              {(!expense.isPending || iCreatedIt) && (
                <button 
                  className="shared-icon-btn shared-icon-btn-danger"
                  onClick={(e) => { e.stopPropagation(); onDelete(expense.id); }}
                  title={expense.isPending && iCreatedIt ? "Cancelar gasto" : "Eliminar"}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ============================================
// COMPONENTE: Vista de Balances con Panel de Deudas
// ============================================
const BalancesView = ({ balances, settlements, group, currentUserId, onPaymentRequest, onCollectionRequest }) => {
  const [viewMode, setViewMode] = useState('group'); // 'group' | 'individual'
  const [selectedMember, setSelectedMember] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState(null);

  // Encontrar el miembro actual
  const currentMember = balances.find(b => b.userId === currentUserId);

  // Obtener deudas que involucran al miembro seleccionado
  const getMemberDebts = (memberId) => {
    return settlements.filter(s => 
      s.from.memberId === memberId || s.to.memberId === memberId
    );
  };

  // Obtener lo que le deben al miembro actual
  const getDebtsOwedToMe = () => {
    return settlements.filter(s => s.to.memberId === currentMember?.memberId);
  };

  // Obtener lo que debe el miembro actual
  const getDebtsIOwe = () => {
    return settlements.filter(s => s.from.memberId === currentMember?.memberId);
  };

  // Manejar "Ya pagué"
  const handleMarkAsPaid = (debt) => {
    setSelectedDebt(debt);
    setShowPaymentModal(true);
  };

  // Manejar "Cobrar"
  const handleCollect = (debt) => {
    setSelectedDebt(debt);
    setShowCollectionModal(true);
  };

  // Confirmar el pago
  const handleConfirmPayment = (notes) => {
    if (selectedDebt && onPaymentRequest) {
      onPaymentRequest({
        creditorMemberId: selectedDebt.to.memberId,
        creditorUserId: selectedDebt.to.userId,
        amount: selectedDebt.amount,
        notes
      });
    }
    setShowPaymentModal(false);
    setSelectedDebt(null);
  };

  // Confirmar solicitud de cobro
  const handleConfirmCollection = (notes) => {
    if (selectedDebt && onCollectionRequest) {
      onCollectionRequest({
        debtorMemberId: selectedDebt.from.memberId,
        debtorUserId: selectedDebt.from.userId,
        amount: selectedDebt.amount,
        notes
      });
    }
    setShowCollectionModal(false);
    setSelectedDebt(null);
  };

  return (
    <div className="shared-balances">
      {/* Tabs para cambiar entre vista grupal e individual */}
      <div className="shared-balances-tabs">
        <button 
          className={`shared-balance-tab ${viewMode === 'group' ? 'active' : ''}`}
          onClick={() => { setViewMode('group'); setSelectedMember(null); }}
        >
          <Users size={18} />
          Vista Grupal
        </button>
        <button 
          className={`shared-balance-tab ${viewMode === 'individual' ? 'active' : ''}`}
          onClick={() => setViewMode('individual')}
        >
          <DollarSign size={18} />
          Ver por Persona
        </button>
      </div>

      {viewMode === 'group' ? (
        <>
          {/* Mi resumen personal */}
          {currentMember && (
            <div className="shared-my-summary">
              <h3>Mi Resumen</h3>
              <div className="shared-my-summary-cards">
                <div className="shared-summary-card positive">
                  <div className="shared-summary-icon">
                    <TrendingUp size={24} />
                  </div>
                  <div className="shared-summary-content">
                    <span className="shared-summary-label">Me deben</span>
                    <span className="shared-summary-value">
                      {group.currency_symbol}
                      {getDebtsOwedToMe().reduce((sum, d) => sum + d.amount, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="shared-summary-card negative">
                  <div className="shared-summary-icon">
                    <TrendingDown size={24} />
                  </div>
                  <div className="shared-summary-content">
                    <span className="shared-summary-label">Debo</span>
                    <span className="shared-summary-value">
                      {group.currency_symbol}
                      {getDebtsIOwe().reduce((sum, d) => sum + d.amount, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className={`shared-summary-card ${currentMember.balance > 0 ? 'positive' : currentMember.balance < 0 ? 'negative' : 'neutral'}`}>
                  <div className="shared-summary-icon">
                    <DollarSign size={24} />
                  </div>
                  <div className="shared-summary-content">
                    <span className="shared-summary-label">Balance Neto</span>
                    <span className="shared-summary-value">
                      {currentMember.balance > 0 ? '+' : ''}
                      {group.currency_symbol}{currentMember.balance.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detalle de mis deudas */}
              {(getDebtsOwedToMe().length > 0 || getDebtsIOwe().length > 0) && (
                <div className="shared-my-debts-detail">
                  {getDebtsOwedToMe().length > 0 && (
                    <div className="shared-debts-section">
                      <h4><TrendingUp size={16} /> Me deben</h4>
                      {getDebtsOwedToMe().map((debt, idx) => (
                        <div key={idx} className="shared-debt-row positive">
                          <div className="shared-debt-person">
                            <div className="shared-debt-avatar">
                              {debt.from.displayName?.[0]?.toUpperCase()}
                            </div>
                            <span>{debt.from.displayName}</span>
                          </div>
                          <div className="shared-debt-actions">
                            <span className="shared-debt-amount positive">
                              +{group.currency_symbol}{debt.amount.toFixed(2)}
                            </span>
                            <button 
                              className="shared-collect-btn"
                              onClick={() => handleCollect(debt)}
                              title="Enviar recordatorio de cobro"
                            >
                              <Bell size={16} />
                              Cobrar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {getDebtsIOwe().length > 0 && (
                    <div className="shared-debts-section">
                      <h4><TrendingDown size={16} /> Debes</h4>
                      {getDebtsIOwe().map((debt, idx) => (
                        <div key={idx} className="shared-debt-row negative">
                          <div className="shared-debt-person">
                            <div className="shared-debt-avatar">
                              {debt.to.displayName?.[0]?.toUpperCase()}
                            </div>
                            <span>{debt.to.displayName}</span>
                          </div>
                          <div className="shared-debt-actions">
                            <span className="shared-debt-amount negative">
                              -{group.currency_symbol}{debt.amount.toFixed(2)}
                            </span>
                            <button 
                              className="shared-paid-btn"
                              onClick={() => handleMarkAsPaid(debt)}
                              title="Marcar como pagado"
                            >
                              <Check size={16} />
                              Ya pagué
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Resumen de balances de todos */}
          <div className="shared-balances-list">
            <h3>Balance por miembro</h3>
            {balances.map(member => (
              <div 
                key={member.memberId} 
                className={`shared-balance-item ${member.userId === currentUserId ? 'current-user' : ''}`}
                onClick={() => { setSelectedMember(member); setViewMode('individual'); }}
              >
                <div className="shared-balance-avatar">
                  {member.displayName?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="shared-balance-info">
                  <span className="shared-balance-name">
                    {member.displayName}
                    {member.userId === currentUserId && <span className="shared-you-badge">Tú</span>}
                    {member.isVirtual && <span className="shared-virtual-badge">Ficticio</span>}
                  </span>
                </div>
                <div className={`shared-balance-amount ${member.balance > 0 ? 'positive' : member.balance < 0 ? 'negative' : ''}`}>
                  {member.balance > 0 ? (
                    <>
                      <TrendingUp size={16} />
                      <span>Le deben {group.currency_symbol}{member.balance.toFixed(2)}</span>
                    </>
                  ) : member.balance < 0 ? (
                    <>
                      <TrendingDown size={16} />
                      <span>Debe {group.currency_symbol}{Math.abs(member.balance).toFixed(2)}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      <span>Balanceado</span>
                    </>
                  )}
                </div>
                <ChevronRight size={18} className="shared-balance-arrow" />
              </div>
            ))}
          </div>

          {/* Sugerencias de liquidación */}
          {settlements.length > 0 && (
            <div className="shared-settlements-suggestions">
              <h3>Cómo liquidar</h3>
              <p className="shared-settlements-hint">Transferencias sugeridas para saldar las cuentas:</p>
              {settlements.map((settlement, idx) => (
                <div key={idx} className="shared-settlement-item">
                  <div className="shared-settlement-from">
                    <div className="shared-balance-avatar negative">
                      {settlement.from.displayName?.[0]?.toUpperCase()}
                    </div>
                    <span>{settlement.from.displayName}</span>
                  </div>
                  <div className="shared-settlement-arrow">
                    <ArrowRight size={20} />
                    <span className="shared-settlement-amount">
                      {group.currency_symbol}{settlement.amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="shared-settlement-to">
                    <div className="shared-balance-avatar positive">
                      {settlement.to.displayName?.[0]?.toUpperCase()}
                    </div>
                    <span>{settlement.to.displayName}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* Vista individual - seleccionar miembro */
        <div className="shared-individual-view">
          <div className="shared-member-selector">
            <h3>Seleccionar miembro</h3>
            <div className="shared-member-selector-grid">
              {balances.map(member => (
                <button
                  key={member.memberId}
                  className={`shared-member-select-btn ${selectedMember?.memberId === member.memberId ? 'selected' : ''}`}
                  onClick={() => setSelectedMember(member)}
                >
                  <div className="shared-member-select-avatar">
                    {member.displayName?.[0]?.toUpperCase() || '?'}
                  </div>
                  <span>{member.displayName}</span>
                  {member.userId === currentUserId && <span className="shared-you-badge small">Tú</span>}
                </button>
              ))}
            </div>
          </div>

          {selectedMember && (
            <div className="shared-member-debts">
              <h3>
                Deudas de {selectedMember.displayName}
                {selectedMember.userId === currentUserId && ' (Tú)'}
              </h3>
              
              {/* Balance general del miembro */}
              <div className={`shared-member-balance-card ${selectedMember.balance > 0 ? 'positive' : selectedMember.balance < 0 ? 'negative' : 'neutral'}`}>
                <span className="shared-member-balance-label">Balance total</span>
                <span className="shared-member-balance-value">
                  {selectedMember.balance > 0 ? '+' : ''}
                  {group.currency_symbol}{selectedMember.balance.toFixed(2)}
                </span>
                <span className="shared-member-balance-desc">
                  {selectedMember.balance > 0 ? 'Le deben dinero' : 
                   selectedMember.balance < 0 ? 'Debe dinero' : 'Está balanceado'}
                </span>
              </div>

              {/* Deudas específicas */}
              {getMemberDebts(selectedMember.memberId).length > 0 ? (
                <div className="shared-member-debts-list">
                  {getMemberDebts(selectedMember.memberId).map((debt, idx) => {
                    const isDebtor = debt.from.memberId === selectedMember.memberId;
                    const otherPerson = isDebtor ? debt.to : debt.from;
                    const isCurrentUserDebtor = debt.from.userId === currentUserId;
                    
                    return (
                      <div key={idx} className={`shared-member-debt-item ${isDebtor ? 'negative' : 'positive'}`}>
                        <div className="shared-member-debt-icon">
                          {isDebtor ? <TrendingDown size={20} /> : <TrendingUp size={20} />}
                        </div>
                        <div className="shared-member-debt-info">
                          <span className="shared-member-debt-action">
                            {isDebtor ? 'Debe a' : 'Le debe'}
                          </span>
                          <div className="shared-member-debt-person">
                            <div className="shared-member-debt-avatar">
                              {otherPerson.displayName?.[0]?.toUpperCase()}
                            </div>
                            <span>{otherPerson.displayName}</span>
                          </div>
                        </div>
                        <div className="shared-member-debt-right">
                          <span className={`shared-member-debt-amount ${isDebtor ? 'negative' : 'positive'}`}>
                            {isDebtor ? '-' : '+'}
                            {group.currency_symbol}{debt.amount.toFixed(2)}
                          </span>
                          {isCurrentUserDebtor && (
                            <button 
                              className="shared-paid-btn small"
                              onClick={() => handleMarkAsPaid(debt)}
                            >
                              <Check size={14} />
                              Ya pagué
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="shared-empty-state small">
                  <CheckCircle size={32} />
                  <p>No tiene deudas pendientes</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal de confirmación de pago */}
      {showPaymentModal && selectedDebt && (
        <PaymentConfirmModal
          debt={selectedDebt}
          currencySymbol={group.currency_symbol}
          onConfirm={handleConfirmPayment}
          onClose={() => { setShowPaymentModal(false); setSelectedDebt(null); }}
        />
      )}

      {/* Modal de solicitud de cobro */}
      {showCollectionModal && selectedDebt && (
        <CollectionRequestModal
          debt={selectedDebt}
          currencySymbol={group.currency_symbol}
          onConfirm={handleConfirmCollection}
          onClose={() => { setShowCollectionModal(false); setSelectedDebt(null); }}
        />
      )}
    </div>
  );
};

// ============================================
// MODAL: Confirmación de Pago
// ============================================
const PaymentConfirmModal = ({ debt, currencySymbol, onConfirm, onClose }) => {
  const [notes, setNotes] = useState('');

  return (
    <div className="shared-modal-overlay" onClick={onClose}>
      <div className="shared-modal shared-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="shared-modal-header">
          <h2>Confirmar Pago</h2>
          <button className="shared-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="shared-payment-confirm-content">
          <div className="shared-payment-confirm-icon">
            <Check size={48} />
          </div>
          <p className="shared-payment-confirm-text">
            ¿Confirmas que le pagaste a <strong>{debt.to.displayName}</strong>?
          </p>
          <div className="shared-payment-confirm-amount">
            {currencySymbol}{debt.amount.toFixed(2)}
          </div>
          <p className="shared-payment-confirm-note">
            Se enviará una notificación a {debt.to.displayName} para que confirme el pago.
          </p>

          <div className="shared-form-group">
            <label>Nota (opcional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Te transferí por Mercado Pago"
              rows={2}
            />
          </div>
        </div>

        <div className="shared-modal-actions">
          <button className="shared-btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button className="shared-btn-primary" onClick={() => onConfirm(notes)}>
            <Check size={18} />
            Confirmar Pago
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MODAL: Solicitud de Cobro
// ============================================
const CollectionRequestModal = ({ debt, currencySymbol, onConfirm, onClose }) => {
  const [notes, setNotes] = useState('');

  return (
    <div className="shared-modal-overlay" onClick={onClose}>
      <div className="shared-modal shared-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="shared-modal-header">
          <h2>Recordatorio de Cobro</h2>
          <button className="shared-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="shared-payment-confirm-content">
          <div className="shared-payment-confirm-icon collection">
            <Bell size={48} />
          </div>
          <p className="shared-payment-confirm-text">
            ¿Enviar recordatorio de pago a <strong>{debt.from.displayName}</strong>?
          </p>
          <div className="shared-payment-confirm-amount">
            {currencySymbol}{debt.amount.toFixed(2)}
          </div>
          <p className="shared-payment-confirm-note">
            {debt.from.displayName} recibirá una notificación recordándole que te debe este monto.
          </p>

          <div className="shared-form-group">
            <label>Mensaje (opcional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ej: ¿Podés pagarme cuando puedas?"
              rows={2}
            />
          </div>
        </div>

        <div className="shared-modal-actions">
          <button className="shared-btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button className="shared-btn-secondary" onClick={() => onConfirm(notes)}>
            <Bell size={18} />
            Enviar Recordatorio
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// COMPONENTE: Lista de Miembros
// ============================================
const MembersList = ({ members, currentUserId, createdBy, onRemove }) => {
  return (
    <div className="shared-members-list">
      {members?.map(member => (
        <div key={member.id} className="shared-member-item">
          <div className="shared-member-avatar">
            {member.displayName?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="shared-member-info">
            <span className="shared-member-name">
              {member.displayName}
              {member.userId === currentUserId && <span className="shared-you-badge">Tú</span>}
              {member.isVirtual && <span className="shared-virtual-badge">Ficticio</span>}
            </span>
            {member.nickname && (
              <span className="shared-member-nickname">@{member.nickname}</span>
            )}
            <span className="shared-member-role">{member.role === 'admin' ? 'Administrador' : 'Miembro'}</span>
          </div>
          
          {member.userId !== currentUserId && member.userId !== createdBy && (
            <button 
              className="shared-icon-btn shared-icon-btn-danger"
              onClick={() => onRemove(member.id)}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

// ============================================
// MODAL: Crear/Editar Grupo
// ============================================
const GroupModal = ({ group, categories, onSave, onClose, onAddCategory }) => {
  const [formData, setFormData] = useState({
    name: group?.name || '',
    description: group?.description || '',
    category: group?.category || 'general',
    currency: group?.currency || 'ARS',
    currency_symbol: group?.currency_symbol || '$'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSave(formData);
  };

  const defaultCategories = [
    { name: 'General', value: 'general' },
    { name: 'Viaje', value: 'viaje' },
    { name: 'Casa', value: 'casa' },
    { name: 'Comida', value: 'comida' },
    { name: 'Salida', value: 'entretenimiento' }
  ];

  return (
    <div className="shared-modal-overlay" onClick={onClose}>
      <div className="shared-modal" onClick={e => e.stopPropagation()}>
        <div className="shared-modal-header">
          <h2>{group ? 'Editar Grupo' : 'Nuevo Grupo'}</h2>
          <button className="shared-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="shared-modal-form">
          <div className="shared-form-group">
            <label>Nombre del grupo *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Viaje a la Costa"
              required
            />
          </div>

          <div className="shared-form-group">
            <label>Descripción</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descripción opcional..."
              rows={3}
            />
          </div>

          <div className="shared-form-group">
            <label>Categoría</label>
            <div className="shared-select-with-add">
              <select
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
              >
                {defaultCategories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.name}</option>
                ))}
                {categories
                  .filter(c => !c.is_default)
                  .map(cat => (
                    <option key={cat.id} value={cat.name.toLowerCase()}>{cat.name}</option>
                  ))}
              </select>
              <button type="button" className="shared-add-btn" onClick={onAddCategory}>
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="shared-form-row">
            <div className="shared-form-group">
              <label>Moneda</label>
              <select
                value={formData.currency}
                onChange={e => {
                  const symbols = { ARS: '$', USD: 'US$', EUR: '€', BRL: 'R$' };
                  setFormData({ 
                    ...formData, 
                    currency: e.target.value,
                    currency_symbol: symbols[e.target.value] || '$'
                  });
                }}
              >
                <option value="ARS">Peso Argentino (ARS)</option>
                <option value="USD">Dólar (USD)</option>
                <option value="EUR">Euro (EUR)</option>
                <option value="BRL">Real (BRL)</option>
              </select>
            </div>
          </div>

          <div className="shared-modal-actions">
            <button type="button" className="shared-btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="shared-btn-primary">
              {group ? 'Guardar Cambios' : 'Crear Grupo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================
// MODAL: Agregar Gasto
// ============================================
const ExpenseModal = ({ group, categories, onSave, onClose, onAddCategory }) => {
  const [formData, setFormData] = useState({
    description: '',
    totalAmount: '',
    category: 'general',
    expenseDate: new Date().toISOString().split('T')[0],
    splitType: 'equal',
    notes: '',
    payers: [],
    splits: []
  });

  // Estado para participantes seleccionados (quiénes están en esta compra)
  const [selectedParticipants, setSelectedParticipants] = useState(() => {
    // Por defecto, todos los miembros están seleccionados
    const initial = {};
    group.members?.forEach(m => { initial[m.id] = true; });
    return initial;
  });

  // Estado para pagadores con sus montos individuales
  const [payerAmounts, setPayerAmounts] = useState({});
  const [customSplits, setCustomSplits] = useState({});

  // Obtener participantes activos
  const getActiveParticipants = () => {
    return group.members?.filter(m => selectedParticipants[m.id]) || [];
  };

  // Toggle participante
  const toggleParticipant = (memberId) => {
    setSelectedParticipants(prev => ({
      ...prev,
      [memberId]: !prev[memberId]
    }));
    // Si se deselecciona, limpiar su monto de pago
    if (selectedParticipants[memberId]) {
      setPayerAmounts(prev => {
        const updated = { ...prev };
        delete updated[memberId];
        return updated;
      });
    }
  };

  // Agregar todos los participantes
  const selectAllParticipants = () => {
    const all = {};
    group.members?.forEach(m => { all[m.id] = true; });
    setSelectedParticipants(all);
  };

  // Quitar todos los participantes
  const deselectAllParticipants = () => {
    setSelectedParticipants({});
    setPayerAmounts({});
  };

  // Formatear número con separador de miles (1.000.000)
  const formatNumberWithThousands = (value) => {
    if (!value && value !== 0) return '';
    const num = parseFloat(String(value).replace(/\./g, '').replace(',', '.'));
    if (isNaN(num)) return '';
    return num.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  // Parsear número formateado a valor numérico
  const parseFormattedNumber = (value) => {
    if (!value) return '';
    // Remover puntos de miles y convertir coma decimal a punto
    const cleaned = String(value).replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? '' : num;
  };

  // Manejar input de dinero - permitir escritura libre sin formateo automático
  const handleMoneyInput = (value) => {
    // Permitir solo números, puntos y comas
    const cleaned = value.replace(/[^0-9.,]/g, '');
    return cleaned;
  };

  // Formatear valor al salir del input (onBlur)
  const formatOnBlur = (value) => {
    const num = parseFormattedNumber(value);
    if (num === '' || num === 0) return '';
    return formatNumberWithThousands(num);
  };

  // Calcular el monto sugerido para un pagador (lo que falta)
  const getSuggestedPayerAmount = (memberId) => {
    const totalAmount = parseFormattedNumber(formData.totalAmount) || 0;
    if (totalAmount === 0) return null;
    
    const activeMembers = getActiveParticipants();
    const otherPayersTotal = Object.entries(payerAmounts)
      .filter(([id, a]) => id !== memberId && a !== '' && a !== undefined && selectedParticipants[id])
      .reduce((sum, [_, a]) => sum + (parseFormattedNumber(a) || 0), 0);
    
    const remaining = Math.round((totalAmount - otherPayersTotal) * 100) / 100;
    
    // Solo mostrar sugerencia si este es el único sin monto y hay algo que asignar
    const payersWithoutAmount = activeMembers.filter(m => {
      const amount = payerAmounts[m.id];
      return (amount === '' || amount === undefined || parseFormattedNumber(amount) === 0);
    });
    
    if (payersWithoutAmount.length === 1 && payersWithoutAmount[0].id === memberId && remaining > 0) {
      return remaining;
    }
    return null;
  };

  // Función para actualizar el monto de un pagador con validación
  const updatePayerAmount = (memberId, amount) => {
    const cleanedAmount = handleMoneyInput(amount);
    const numericAmount = parseFormattedNumber(cleanedAmount) || 0;
    const totalAmount = parseFormattedNumber(formData.totalAmount) || 0;
    
    // Calcular cuánto ya han pagado los otros participantes
    const otherPayersTotal = Object.entries(payerAmounts)
      .filter(([id, a]) => id !== memberId && a !== '' && a !== undefined && selectedParticipants[id])
      .reduce((sum, [_, a]) => sum + (parseFormattedNumber(a) || 0), 0);
    
    // El máximo que puede ingresar este pagador
    const maxAllowed = Math.max(0, totalAmount - otherPayersTotal);
    
    // Si el monto ingresado excede el máximo, limitar al máximo
    if (numericAmount > maxAllowed && totalAmount > 0) {
      setPayerAmounts(prev => ({
        ...prev,
        [memberId]: formatNumberWithThousands(maxAllowed)
      }));
    } else {
      setPayerAmounts(prev => ({
        ...prev,
        [memberId]: cleanedAmount
      }));
    }
  };

  // Aplicar sugerencia al hacer click
  const applySuggestedPayerAmount = (memberId) => {
    const suggested = getSuggestedPayerAmount(memberId);
    if (suggested !== null) {
      setPayerAmounts(prev => ({
        ...prev,
        [memberId]: formatNumberWithThousands(suggested)
      }));
    }
  };

  // Formatear el monto al salir del input
  const handlePayerBlur = (memberId) => {
    const currentValue = payerAmounts[memberId];
    if (currentValue) {
      const formatted = formatOnBlur(currentValue);
      setPayerAmounts(prev => ({
        ...prev,
        [memberId]: formatted
      }));
    } else {
      // Si está vacío y hay una sugerencia, aplicarla
      const suggested = getSuggestedPayerAmount(memberId);
      if (suggested !== null) {
        setPayerAmounts(prev => ({
          ...prev,
          [memberId]: formatNumberWithThousands(suggested)
        }));
      }
    }
  };

  // Verificar si un pagador es el último sin monto (para mostrar sugerencia)
  const isLastPayerWithoutAmount = (memberId) => {
    const activeMembers = getActiveParticipants();
    const payersWithoutAmount = activeMembers.filter(m => {
      const amount = payerAmounts[m.id];
      return (amount === '' || amount === undefined || parseFormattedNumber(amount) === 0);
    });
    return payersWithoutAmount.length === 1 && payersWithoutAmount[0].id === memberId;
  };

  // Obtener el total pagado por todos
  const getTotalPaid = () => {
    return Object.entries(payerAmounts)
      .filter(([memberId, a]) => a !== '' && a !== undefined && selectedParticipants[memberId])
      .reduce((sum, [_, amount]) => sum + (parseFormattedNumber(amount) || 0), 0);
  };

  // Obtener cantidad de pagadores con monto > 0
  const getPayersCount = () => {
    return Object.entries(payerAmounts)
      .filter(([memberId, a]) => a !== '' && parseFormattedNumber(a) > 0 && selectedParticipants[memberId]).length;
  };

  // Calcular la parte que le corresponde a cada uno (división equitativa)
  const getSharePerPerson = () => {
    const total = parseFormattedNumber(formData.totalAmount) || 0;
    const participantsCount = getActiveParticipants().length || 1;
    return Math.round((total / participantsCount) * 100) / 100;
  };

  // Calcular el balance de una persona (lo que pagó - lo que debe)
  const getPersonBalance = (memberId) => {
    if (!selectedParticipants[memberId]) return 0;
    const paid = parseFormattedNumber(payerAmounts[memberId]) || 0;
    const share = getSharePerPerson();
    return Math.round((paid - share) * 100) / 100;
  };

  // Calcular el monto sugerido para un split personalizado (lo que falta)
  const getSuggestedSplitAmount = (memberId) => {
    const totalAmount = parseFormattedNumber(formData.totalAmount) || 0;
    if (totalAmount === 0) return null;
    
    const activeMembers = getActiveParticipants();
    const otherSplitsTotal = Object.entries(customSplits)
      .filter(([id, a]) => id !== memberId && a !== '' && a !== undefined && selectedParticipants[id])
      .reduce((sum, [_, a]) => sum + (parseFormattedNumber(a) || 0), 0);
    
    const remaining = Math.round((totalAmount - otherSplitsTotal) * 100) / 100;
    
    // Solo mostrar sugerencia si este es el único sin monto y hay algo que asignar
    const splitsWithoutAmount = activeMembers.filter(m => {
      const amount = customSplits[m.id];
      return (amount === '' || amount === undefined || parseFormattedNumber(amount) === 0);
    });
    
    if (splitsWithoutAmount.length === 1 && splitsWithoutAmount[0].id === memberId && remaining > 0) {
      return remaining;
    }
    return null;
  };

  // Función para actualizar el monto personalizado de un split
  const updateCustomSplit = (memberId, amount) => {
    const cleanedAmount = handleMoneyInput(amount);
    const numericAmount = parseFormattedNumber(cleanedAmount) || 0;
    const totalAmount = parseFormattedNumber(formData.totalAmount) || 0;
    
    // Calcular cuánto ya se ha asignado a otros participantes
    const otherSplitsTotal = Object.entries(customSplits)
      .filter(([id, a]) => id !== memberId && a !== '' && a !== undefined && selectedParticipants[id])
      .reduce((sum, [_, a]) => sum + (parseFormattedNumber(a) || 0), 0);
    
    // El máximo que puede asignarse a este participante
    const maxAllowed = Math.max(0, totalAmount - otherSplitsTotal);
    
    // Si el monto ingresado excede el máximo, limitar al máximo
    if (numericAmount > maxAllowed && totalAmount > 0) {
      setCustomSplits(prev => ({
        ...prev,
        [memberId]: formatNumberWithThousands(maxAllowed)
      }));
    } else {
      setCustomSplits(prev => ({
        ...prev,
        [memberId]: cleanedAmount
      }));
    }
  };

  // Aplicar sugerencia de split al hacer click
  const applySuggestedSplitAmount = (memberId) => {
    const suggested = getSuggestedSplitAmount(memberId);
    if (suggested !== null) {
      setCustomSplits(prev => ({
        ...prev,
        [memberId]: formatNumberWithThousands(suggested)
      }));
    }
  };

  // Formatear el monto del split al salir del input
  const handleSplitBlur = (memberId) => {
    const currentValue = customSplits[memberId];
    if (currentValue) {
      const formatted = formatOnBlur(currentValue);
      setCustomSplits(prev => ({
        ...prev,
        [memberId]: formatted
      }));
    } else {
      // Si está vacío y hay una sugerencia, aplicarla
      const suggested = getSuggestedSplitAmount(memberId);
      if (suggested !== null) {
        setCustomSplits(prev => ({
          ...prev,
          [memberId]: formatNumberWithThousands(suggested)
        }));
      }
    }
  };

  // Verificar si un split es el último sin monto (para mostrar sugerencia)
  const isLastSplitWithoutAmount = (memberId) => {
    const activeMembers = getActiveParticipants();
    const splitsWithoutAmount = activeMembers.filter(m => {
      const amount = customSplits[m.id];
      return (amount === '' || amount === undefined || parseFormattedNumber(amount) === 0);
    });
    return splitsWithoutAmount.length === 1 && splitsWithoutAmount[0].id === memberId;
  };

  // Calcular el total asignado en splits personalizados
  const getTotalCustomSplits = () => {
    return Object.entries(customSplits)
      .filter(([id]) => selectedParticipants[id])
      .reduce((sum, [_, a]) => sum + (parseFormattedNumber(a) || 0), 0);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.description.trim() || !formData.totalAmount) return;

    const totalAmount = parseFormattedNumber(formData.totalAmount);
    const totalPaid = getTotalPaid();
    const activeParticipants = getActiveParticipants();

    if (activeParticipants.length === 0) {
      alert('Debe seleccionar al menos un participante');
      return;
    }

    // Validar que el total pagado coincida con el monto del gasto
    if (Math.abs(totalPaid - totalAmount) > 0.01) {
      alert(`El total pagado (${totalPaid.toFixed(2)}) no coincide con el monto del gasto (${totalAmount.toFixed(2)})`);
      return;
    }

    // Crear array de pagadores solo con quienes pagaron
    const payers = Object.entries(payerAmounts)
      .filter(([memberId, amount]) => amount !== '' && parseFormattedNumber(amount) > 0 && selectedParticipants[memberId])
      .map(([memberId, amount]) => ({
        memberId,
        amount: Math.round(parseFormattedNumber(amount) * 100) / 100
      }));

    if (payers.length === 0) {
      alert('Debe indicar al menos un pagador con monto');
      return;
    }

    // Preparar splits - solo los participantes seleccionados
    let splits = [];
    if (formData.splitType === 'custom') {
      splits = Object.entries(customSplits)
        .filter(([memberId, amount]) => parseFormattedNumber(amount) > 0 && selectedParticipants[memberId])
        .map(([memberId, amount]) => ({ memberId, amount: Math.round(parseFormattedNumber(amount) * 100) / 100 }));
    } else {
      // División equitativa solo entre participantes
      const sharePerPerson = getSharePerPerson();
      splits = activeParticipants.map(member => ({
        memberId: member.id,
        amount: sharePerPerson
      }));
    }

    onSave({
      ...formData,
      totalAmount,
      payers,
      splits,
      participantIds: activeParticipants.map(p => p.id)
    });
  };

  const defaultCategories = [
    { name: 'General', value: 'general' },
    { name: 'Viaje', value: 'viaje' },
    { name: 'Casa', value: 'casa' },
    { name: 'Comida', value: 'comida' },
    { name: 'Transporte', value: 'transporte' },
    { name: 'Entretenimiento', value: 'entretenimiento' },
    { name: 'Compras', value: 'compras' },
    { name: 'Servicios', value: 'servicios' },
    { name: 'Salud', value: 'salud' },
    { name: 'Otros', value: 'otros' }
  ];

  const totalAmount = parseFormattedNumber(formData.totalAmount) || 0;
  const totalPaid = getTotalPaid();
  const payersCount = getPayersCount();
  const activeParticipants = getActiveParticipants();
  const participantsCount = activeParticipants.length || 1;
  const sharePerPerson = getSharePerPerson();
  const paymentDifference = Math.round((totalAmount - totalPaid) * 100) / 100;

  return (
    <div className="shared-modal-overlay" onClick={onClose}>
      <div className="shared-modal shared-modal-lg" onClick={e => e.stopPropagation()}>
        <div className="shared-modal-header">
          <h2>Agregar Gasto</h2>
          <button className="shared-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="shared-modal-form">
          <div className="shared-form-row">
            <div className="shared-form-group">
              <label>Descripción *</label>
              <input
                type="text"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ej: Cena en restaurante"
                required
              />
            </div>
            <div className="shared-form-group">
              <label>Monto Total *</label>
              <div className="shared-input-with-symbol">
                <span>{group.currency_symbol}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={formData.totalAmount}
                  onChange={e => setFormData({ ...formData, totalAmount: handleMoneyInput(e.target.value) })}
                  onBlur={e => {
                    const formatted = formatOnBlur(e.target.value);
                    setFormData({ ...formData, totalAmount: formatted });
                  }}
                  placeholder="0"
                  required
                />
              </div>
            </div>
          </div>

          <div className="shared-form-row">
            <div className="shared-form-group">
              <label>Categoría</label>
              <div className="shared-select-with-add">
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                >
                  {defaultCategories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.name}</option>
                  ))}
                  {categories
                    .filter(c => !c.is_default)
                    .map(cat => (
                      <option key={cat.id} value={cat.name.toLowerCase()}>{cat.name}</option>
                    ))}
                </select>
                <button type="button" className="shared-add-btn" onClick={onAddCategory}>
                  <Plus size={16} />
                </button>
              </div>
            </div>
            <div className="shared-form-group">
              <label>Fecha</label>
              <input
                type="date"
                value={formData.expenseDate}
                onChange={e => setFormData({ ...formData, expenseDate: e.target.value })}
              />
            </div>
          </div>

          {/* Selección de Participantes */}
          <div className="shared-form-section">
            <div className="shared-section-header">
              <h4>¿Quiénes participan en este gasto?</h4>
              <div className="shared-section-actions">
                <button type="button" className="shared-link-btn" onClick={selectAllParticipants}>
                  Todos
                </button>
                <button type="button" className="shared-link-btn" onClick={deselectAllParticipants}>
                  Ninguno
                </button>
              </div>
            </div>
            <div className="shared-participants-selector">
              {group.members?.map(member => (
                <label 
                  key={member.id} 
                  className={`shared-participant-chip ${selectedParticipants[member.id] ? 'selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedParticipants[member.id] || false}
                    onChange={() => toggleParticipant(member.id)}
                  />
                  <div className="shared-participant-chip-avatar">
                    {member.displayName?.[0]?.toUpperCase() || '?'}
                  </div>
                  <span>{member.displayName}</span>
                  {selectedParticipants[member.id] && <CheckCircle size={16} className="shared-chip-check" />}
                </label>
              ))}
            </div>
            <div className="shared-participants-count">
              <Users size={16} />
              <span>{participantsCount} de {group.members?.length || 0} participantes</span>
            </div>
          </div>

          {/* Quién pagó - Con montos individuales (solo participantes) */}
          <div className="shared-form-section">
            <h4>¿Quién pagó? <span className="shared-hint">(Solo participantes seleccionados)</span></h4>
            {activeParticipants.length === 0 ? (
              <div className="shared-empty-participants">
                <AlertCircle size={24} />
                <p>Selecciona al menos un participante arriba</p>
              </div>
            ) : (
              <div className="shared-payers-grid">
                {activeParticipants.map(member => {
                  const amount = payerAmounts[member.id];
                  const hasAmount = amount !== '' && amount !== undefined && parseFormattedNumber(amount) > 0;
                  const balance = getPersonBalance(member.id);
                  const suggestedAmount = getSuggestedPayerAmount(member.id);
                  const showSuggestion = suggestedAmount !== null && !hasAmount;
                  
                  return (
                    <div key={member.id} className={`shared-payer-item ${hasAmount ? 'has-amount' : ''}`}>
                      <div className="shared-payer-info">
                        <div className="shared-payer-avatar">
                          {member.displayName?.[0]?.toUpperCase() || '?'}
                        </div>
                        <span className="shared-payer-name">{member.displayName}</span>
                      </div>
                      <div className="shared-payer-input-wrapper">
                        <div className="shared-payer-input">
                          <span className="shared-currency-symbol">{group.currency_symbol}</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={amount || ''}
                            onChange={e => updatePayerAmount(member.id, e.target.value)}
                            onBlur={() => handlePayerBlur(member.id)}
                            placeholder={showSuggestion ? formatNumberWithThousands(suggestedAmount) : '0'}
                          />
                        </div>
                        {showSuggestion && (
                          <button
                            type="button"
                            className="shared-suggestion-btn"
                            onClick={() => applySuggestedPayerAmount(member.id)}
                            title="Click para autocompletar"
                          >
                            Faltan {group.currency_symbol}{formatNumberWithThousands(suggestedAmount)}
                          </button>
                        )}
                      </div>
                      {totalAmount > 0 && hasAmount && (
                        <div className={`shared-payer-balance ${balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'neutral'}`}>
                          {balance > 0 ? (
                            <span>Le deben {group.currency_symbol}{formatNumberWithThousands(balance)}</span>
                          ) : balance < 0 ? (
                            <span>Debe {group.currency_symbol}{formatNumberWithThousands(Math.abs(balance))}</span>
                          ) : (
                            <span>Saldado</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Resumen de pago */}
            {totalAmount > 0 && activeParticipants.length > 0 && (
              <div className={`shared-payment-summary ${Math.abs(paymentDifference) > 0.01 ? 'warning' : 'success'}`}>
                <div className="shared-payment-summary-row">
                  <span>Monto del gasto:</span>
                  <strong>{group.currency_symbol}{formatNumberWithThousands(totalAmount)}</strong>
                </div>
                <div className="shared-payment-summary-row">
                  <span>Total pagado:</span>
                  <strong>{group.currency_symbol}{formatNumberWithThousands(totalPaid)}</strong>
                </div>
                {Math.abs(paymentDifference) > 0.01 && (
                  <div className="shared-payment-summary-row difference">
                    <span>{paymentDifference > 0 ? 'Falta por asignar:' : 'Exceso:'}</span>
                    <strong className={paymentDifference > 0 ? 'negative' : 'warning'}>
                      {group.currency_symbol}{formatNumberWithThousands(Math.abs(paymentDifference))}
                    </strong>
                  </div>
                )}
                <div className="shared-payment-summary-row">
                  <span>Parte por persona ({participantsCount}):</span>
                  <strong>{group.currency_symbol}{formatNumberWithThousands(sharePerPerson)}</strong>
                </div>
              </div>
            )}
          </div>

          {/* División del gasto */}
          <div className="shared-form-section">
            <h4>¿Cómo dividir?</h4>
            <div className="shared-split-options">
              <label className="shared-radio-option">
                <input
                  type="radio"
                  name="splitType"
                  checked={formData.splitType === 'equal'}
                  onChange={() => setFormData({ ...formData, splitType: 'equal' })}
                />
                <span>Partes iguales entre participantes</span>
              </label>
              <label className="shared-radio-option">
                <input
                  type="radio"
                  name="splitType"
                  checked={formData.splitType === 'custom'}
                  onChange={() => setFormData({ ...formData, splitType: 'custom' })}
                />
                <span>Montos personalizados</span>
              </label>
            </div>

            {formData.splitType === 'equal' && totalAmount > 0 && activeParticipants.length > 0 && (
              <div className="shared-split-preview">
                <div className="shared-split-preview-header">
                  <span>División equitativa entre {participantsCount} participantes:</span>
                  <strong>{group.currency_symbol}{sharePerPerson.toFixed(2)} c/u</strong>
                </div>
                <div className="shared-split-preview-list">
                  {activeParticipants.map(member => {
                    const memberPaid = parseFloat(payerAmounts[member.id]) || 0;
                    const balance = Math.round((memberPaid - sharePerPerson) * 100) / 100;
                    
                    return (
                      <div key={member.id} className="shared-split-preview-item">
                        <span>{member.displayName}</span>
                        <div className="shared-split-preview-calc">
                          <span className="paid">Pagó: {group.currency_symbol}{formatNumberWithThousands(memberPaid)}</span>
                          <span className="owes">Su parte: {group.currency_symbol}{formatNumberWithThousands(sharePerPerson)}</span>
                          <span className={`balance ${balance > 0 ? 'positive' : balance < 0 ? 'negative' : ''}`}>
                            {balance > 0 ? `Me deben: ${group.currency_symbol}${formatNumberWithThousands(balance)}` : 
                             balance < 0 ? `Debes: ${group.currency_symbol}${formatNumberWithThousands(Math.abs(balance))}` : 
                             'Saldado'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {formData.splitType === 'custom' && activeParticipants.length > 0 && (
              <div className="shared-custom-splits">
                {activeParticipants.map((member) => {
                  const currentValue = customSplits[member.id] || '';
                  const suggestedAmount = getSuggestedSplitAmount(member.id);
                  const hasAmount = currentValue !== '' && parseFormattedNumber(currentValue) > 0;
                  const showSuggestion = suggestedAmount !== null && !hasAmount;
                  
                  return (
                    <div key={member.id} className="shared-split-item">
                      <span>{member.displayName}</span>
                      <div className="shared-split-input-wrapper">
                        <div className="shared-input-with-symbol small">
                          <span>{group.currency_symbol}</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={currentValue}
                            onChange={e => updateCustomSplit(member.id, e.target.value)}
                            onBlur={() => handleSplitBlur(member.id)}
                            placeholder={showSuggestion ? formatNumberWithThousands(suggestedAmount) : '0'}
                          />
                        </div>
                        {showSuggestion && (
                          <button
                            type="button"
                            className="shared-suggestion-btn small"
                            onClick={() => applySuggestedSplitAmount(member.id)}
                            title="Click para autocompletar"
                          >
                            Faltan {group.currency_symbol}{formatNumberWithThousands(suggestedAmount)}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {/* Resumen de división personalizada */}
                {totalAmount > 0 && (
                  <div className="shared-custom-splits-summary">
                    <span>Total asignado: </span>
                    <strong className={
                      Math.abs(getTotalCustomSplits() - totalAmount) < 0.01 
                        ? 'success' : 'warning'
                    }>
                      {group.currency_symbol}
                      {formatNumberWithThousands(getTotalCustomSplits())}
                      {' / '}{group.currency_symbol}{formatNumberWithThousands(totalAmount)}
                    </strong>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="shared-form-group">
            <label>Notas (opcional)</label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Notas adicionales..."
              rows={2}
            />
          </div>

          <div className="shared-modal-actions">
            <button type="button" className="shared-btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button 
              type="submit" 
              className="shared-btn-primary" 
              disabled={payersCount === 0 || Math.abs(paymentDifference) > 0.01}
            >
              Registrar Gasto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================
// MODAL: Agregar Miembro
// ============================================
const MemberModal = ({ group, friends, virtualFriends, onSave, onClose }) => {
  const [memberType, setMemberType] = useState('friend');
  const [selectedFriend, setSelectedFriend] = useState('');
  const [selectedVirtual, setSelectedVirtual] = useState('');

  // Filtrar amigos que no están en el grupo
  const existingUserIds = group.members?.filter(m => m.userId).map(m => m.userId) || [];
  const existingVirtualIds = group.members?.filter(m => m.virtualFriendId).map(m => m.virtualFriendId) || [];
  
  const availableFriends = friends?.filter(f => !existingUserIds.includes(f.friend?.id)) || [];
  const availableVirtual = virtualFriends?.filter(v => !existingVirtualIds.includes(v.id)) || [];

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (memberType === 'friend' && selectedFriend) {
      onSave({ type: 'friend', userId: selectedFriend });
    } else if (memberType === 'virtual' && selectedVirtual) {
      const vf = virtualFriends.find(v => v.id === selectedVirtual);
      onSave({ type: 'virtual', virtualFriendId: selectedVirtual, displayName: vf?.name });
    }
  };

  return (
    <div className="shared-modal-overlay" onClick={onClose}>
      <div className="shared-modal" onClick={e => e.stopPropagation()}>
        <div className="shared-modal-header">
          <h2>Agregar Miembro</h2>
          <button className="shared-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="shared-modal-form">
          <div className="shared-member-type-tabs">
            <button
              type="button"
              className={`shared-member-type-tab ${memberType === 'friend' ? 'active' : ''}`}
              onClick={() => setMemberType('friend')}
            >
              <Users size={18} />
              Amigo Real
            </button>
            <button
              type="button"
              className={`shared-member-type-tab ${memberType === 'virtual' ? 'active' : ''}`}
              onClick={() => setMemberType('virtual')}
            >
              <Users size={18} />
              Amigo Ficticio
            </button>
          </div>

          {memberType === 'friend' && (
            <div className="shared-form-group">
              <label>Seleccionar amigo</label>
              {availableFriends.length > 0 ? (
                <select
                  value={selectedFriend}
                  onChange={e => setSelectedFriend(e.target.value)}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {availableFriends.map(({ friend }) => (
                    <option key={friend.id} value={friend.id}>
                      {friend.first_name} {friend.last_name} (@{friend.nickname})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="shared-no-members">No hay amigos disponibles para agregar</p>
              )}
            </div>
          )}

          {memberType === 'virtual' && (
            <div className="shared-form-group">
              <label>Seleccionar amigo ficticio</label>
              {availableVirtual.length > 0 ? (
                <select
                  value={selectedVirtual}
                  onChange={e => setSelectedVirtual(e.target.value)}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {availableVirtual.map(vf => (
                    <option key={vf.id} value={vf.id}>
                      {vf.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="shared-no-members">No hay amigos ficticios disponibles</p>
              )}
            </div>
          )}

          <div className="shared-modal-actions">
            <button type="button" className="shared-btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button 
              type="submit" 
              className="shared-btn-primary"
              disabled={(memberType === 'friend' && !selectedFriend) || (memberType === 'virtual' && !selectedVirtual)}
            >
              Agregar Miembro
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================
// MODAL: Liquidación
// ============================================
const SettlementModal = ({ group, balances, suggestions, onSave, onClose }) => {
  const [selectedSettlement, setSelectedSettlement] = useState(suggestions[0] || null);
  const [customAmount, setCustomAmount] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedSettlement) return;

    onSave({
      fromMemberId: selectedSettlement.from.memberId,
      toMemberId: selectedSettlement.to.memberId,
      amount: customAmount ? parseFloat(customAmount) : selectedSettlement.amount,
      notes
    });
  };

  return (
    <div className="shared-modal-overlay" onClick={onClose}>
      <div className="shared-modal" onClick={e => e.stopPropagation()}>
        <div className="shared-modal-header">
          <h2>Registrar Liquidación</h2>
          <button className="shared-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="shared-modal-form">
          <div className="shared-form-group">
            <label>Transacción sugerida</label>
            <select
              value={suggestions.indexOf(selectedSettlement)}
              onChange={e => setSelectedSettlement(suggestions[parseInt(e.target.value)])}
            >
              {suggestions.map((s, idx) => (
                <option key={idx} value={idx}>
                  {s.from.displayName} → {s.to.displayName} ({group.currency_symbol}{s.amount.toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          {selectedSettlement && (
            <div className="shared-settlement-preview">
              <div className="shared-settlement-from">
                <div className="shared-balance-avatar negative">
                  {selectedSettlement.from.displayName?.[0]}
                </div>
                <span>{selectedSettlement.from.displayName}</span>
              </div>
              <div className="shared-settlement-arrow">
                <ArrowRight size={24} />
              </div>
              <div className="shared-settlement-to">
                <div className="shared-balance-avatar positive">
                  {selectedSettlement.to.displayName?.[0]}
                </div>
                <span>{selectedSettlement.to.displayName}</span>
              </div>
            </div>
          )}

          <div className="shared-form-group">
            <label>Monto (sugerido: {group.currency_symbol}{selectedSettlement?.amount.toFixed(2)})</label>
            <div className="shared-input-with-symbol">
              <span>{group.currency_symbol}</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={customAmount}
                onChange={e => setCustomAmount(e.target.value)}
                placeholder={selectedSettlement?.amount.toFixed(2)}
              />
            </div>
          </div>

          <div className="shared-form-group">
            <label>Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Transferencia por Mercado Pago"
              rows={2}
            />
          </div>

          <div className="shared-modal-actions">
            <button type="button" className="shared-btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="shared-btn-primary">
              Registrar Liquidación
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================
// MODAL: Confirmación Bancaria
// ============================================
const BankConfirmModal = ({ expense, bankAccounts, groupCurrency = 'ARS', onConfirm, onClose }) => {
  const [linkToBank, setLinkToBank] = useState(true);
  // Filtrar cuentas bancarias por moneda del grupo
  const filteredBankAccounts = (bankAccounts || []).filter(acc => acc.currency === groupCurrency);
  const [selectedAccount, setSelectedAccount] = useState(filteredBankAccounts[0]?.id || '');

  const handleConfirm = () => {
    onConfirm(linkToBank && filteredBankAccounts.length > 0, linkToBank && filteredBankAccounts.length > 0 ? selectedAccount : null);
  };

  return (
    <div className="shared-modal-overlay" onClick={onClose}>
      <div className="shared-modal" onClick={e => e.stopPropagation()}>
        <div className="shared-modal-header">
          <h2>Confirmar Gasto Personal</h2>
          <button className="shared-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="shared-bank-confirm-content">
          <div className="shared-bank-confirm-icon">
            <CreditCard size={48} />
          </div>
          
          <p className="shared-bank-confirm-text">
            ¿Deseás que este gasto se registre también como <strong>gasto personal</strong> y se descuente automáticamente de tu cuenta bancaria?
          </p>

          <div className="shared-bank-options">
            <label className="shared-radio-option large">
              <input
                type="radio"
                name="bankOption"
                checked={linkToBank}
                onChange={() => setLinkToBank(true)}
              />
              <div className="shared-radio-content">
                <Check size={20} className="shared-radio-icon success" />
                <div>
                  <strong>Sí, registrar y descontar</strong>
                  <span>El gasto se sumará a tus gastos personales</span>
                </div>
              </div>
            </label>
            
            <label className="shared-radio-option large">
              <input
                type="radio"
                name="bankOption"
                checked={!linkToBank}
                onChange={() => setLinkToBank(false)}
              />
              <div className="shared-radio-content">
                <X size={20} className="shared-radio-icon" />
                <div>
                  <strong>No, solo gasto grupal</strong>
                  <span>El gasto quedará solo en el grupo</span>
                </div>
              </div>
            </label>
          </div>

          {linkToBank && filteredBankAccounts.length > 0 && (
            <div className="shared-form-group">
              <label>Seleccionar cuenta bancaria ({groupCurrency})</label>
              <select
                value={selectedAccount}
                onChange={e => setSelectedAccount(e.target.value)}
              >
                {filteredBankAccounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.name} - {account.currency_symbol}{parseFloat(account.current_balance).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </option>
                ))}
              </select>
            </div>
          )}

          {linkToBank && filteredBankAccounts.length === 0 && (
            <div className="shared-form-group">
              <div className="shared-warning-message">
                <AlertCircle size={18} />
                <span>No tienes cuentas bancarias en {groupCurrency}. El gasto solo quedará registrado en el grupo.</span>
              </div>
            </div>
          )}
        </div>

        <div className="shared-modal-actions">
          <button type="button" className="shared-btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="shared-btn-primary" onClick={handleConfirm}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MODAL: Nueva Categoría
// ============================================
const CategoryModal = ({ onSave, onClose }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name, color });
  };

  const colors = [
    '#ef4444', '#f59e0b', '#22c55e', '#06b6d4', 
    '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'
  ];

  return (
    <div className="shared-modal-overlay" onClick={onClose}>
      <div className="shared-modal shared-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="shared-modal-header">
          <h2>Nueva Categoría</h2>
          <button className="shared-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="shared-modal-form">
          <div className="shared-form-group">
            <label>Nombre de la categoría *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Gimnasio"
              required
            />
          </div>

          <div className="shared-form-group">
            <label>Color</label>
            <div className="shared-color-picker">
              {colors.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`shared-color-option ${color === c ? 'selected' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className="shared-modal-actions">
            <button type="button" className="shared-btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="shared-btn-primary">
              Crear Categoría
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================
// MODAL: Detalle del Gasto
// ============================================
const ExpenseDetailModal = ({ expense, loading, group, currentUserId, bankAccounts, onSettle, onCollectionRequest, onResignDebt, onClose }) => {
  const [showSettleConfirm, setShowSettleConfirm] = useState(false);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [deductFromBank, setDeductFromBank] = useState(true);
  const [resigningDebt, setResigningDebt] = useState(false);
  const [collectingDebt, setCollectingDebt] = useState(false);
  
  // Filtrar cuentas bancarias por moneda del grupo
  const groupCurrency = group?.currency || 'ARS';
  const filteredBankAccounts = (bankAccounts || []).filter(acc => acc.currency === groupCurrency);
  const [selectedBankAccount, setSelectedBankAccount] = useState(filteredBankAccounts[0]?.id || '');

  if (loading) {
    return (
      <div className="shared-modal-overlay" onClick={onClose}>
        <div className="shared-modal shared-modal-lg" onClick={e => e.stopPropagation()}>
          <div className="shared-modal-header">
            <h2>Detalle del Gasto</h2>
            <button className="shared-modal-close" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
          <div className="shared-modal-loading">
            <div className="shared-loading-spinner"></div>
            <span>Cargando detalle...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!expense) return null;

  const CategoryIcon = CATEGORY_ICONS[expense.category?.toLowerCase()] || Tag;
  const currentUserMember = group?.members?.find(m => m.userId === currentUserId);
  const userSplit = expense.splits?.find(s => s.memberId === currentUserMember?.id);
  const userIsPayer = expense.payers?.some(p => p.memberId === currentUserMember?.id);

  const handleSettleClick = () => {
    if (expense.is_settled) return;
    
    // Si el usuario tiene algo pendiente y tiene cuentas bancarias de la misma moneda, mostrar confirmación
    if (userSplit?.pendingAmount > 0 && filteredBankAccounts.length > 0) {
      setShowSettleConfirm(true);
    } else {
      onSettle(expense.id, false, null);
    }
  };

  const handleConfirmSettle = () => {
    onSettle(expense.id, deductFromBank, deductFromBank ? selectedBankAccount : null);
  };

  // Handler para enviar recordatorio de cobro a todos los deudores
  const handleCollectDebt = async () => {
    if (collectingDebt) return;
    setCollectingDebt(true);
    
    try {
      // Encontrar todos los splits pendientes donde el usuario actual es acreedor (pagador)
      const userPayer = expense.payers?.find(p => p.memberId === currentUserMember?.id);
      if (!userPayer) {
        setCollectingDebt(false);
        return;
      }

      // Enviar solicitud de cobro a cada deudor con monto pendiente
      for (const split of expense.splits || []) {
        if (split.memberId !== currentUserMember?.id && split.pendingAmount > 0) {
          const debtorMember = group?.members?.find(m => m.id === split.memberId);
          if (debtorMember) {
            await onCollectionRequest({
              debtorMemberId: split.memberId,
              debtorUserId: debtorMember.userId,
              amount: split.pendingAmount,
              notes: `Recordatorio de pago para: ${expense.description}`
            });
          }
        }
      }
      setCollectingDebt(false);
    } catch (error) {
      console.error('Error enviando recordatorio de cobro:', error);
      setCollectingDebt(false);
    }
  };

  // Handler para resignar deuda - el acreedor asume todo el gasto
  const handleResignClick = () => {
    if (expense.is_settled) return;
    setShowResignConfirm(true);
  };

  const handleConfirmResign = async () => {
    if (resigningDebt) return;
    setResigningDebt(true);
    
    try {
      // Usar la función de BD para resignar deuda
      // userPaidAmount ya está calculado arriba
      await onResignDebt(
        expense.id, 
        deductFromBank ? selectedBankAccount : null, 
        userPaidAmount  // Lo que realmente pagué = mi gasto real
      );
      setShowResignConfirm(false);
    } catch (error) {
      console.error('Error al resignar deuda:', error);
    } finally {
      setResigningDebt(false);
    }
  };

  // Verificar si el usuario actual es pagador de este gasto
  const userPayer = expense.payers?.find(p => p.memberId === currentUserMember?.id || p.userId === currentUserId);
  const userPaidAmount = userPayer?.amountPaid || 0;
  const isPayer = userPaidAmount > 0; // Es pagador si pagó algo

  // Calcular cuánto le deben al usuario (splits de otros que tienen pendingAmount > 0)
  const totalOwedToUser = (expense.splits || [])
    .filter(s => {
      // Excluir el split del usuario actual
      const isCurrentUser = s.memberId === currentUserMember?.id || s.userId === currentUserId;
      // Solo contar si tiene monto pendiente
      const hasPendingAmount = (s.pendingAmount > 0) || (!s.isSettled && s.amountOwed > s.amountPaid);
      return !isCurrentUser && hasPendingAmount;
    })
    .reduce((sum, s) => sum + (s.pendingAmount || (s.amountOwed - s.amountPaid) || 0), 0);

  // Debug
  console.log('ExpenseDetailModal Debug:', {
    currentUserMember,
    currentUserId,
    userPayer,
    userPaidAmount,
    isPayer,
    totalOwedToUser,
    splits: expense.splits,
    payers: expense.payers,
    is_settled: expense.is_settled
  });

  return (
    <div className="shared-modal-overlay" onClick={onClose}>
      <div className="shared-modal shared-modal-lg" onClick={e => e.stopPropagation()}>
        <div className="shared-modal-header">
          <h2>Detalle del Gasto</h2>
          <button className="shared-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {!showSettleConfirm && !showResignConfirm ? (
          <div className="shared-expense-detail">
            {/* Info principal del gasto */}
            <div className="shared-expense-detail-header">
              <div className="shared-expense-detail-icon">
                <CategoryIcon size={32} />
              </div>
              <div className="shared-expense-detail-title">
                <h3>{expense.description}</h3>
                <div className="shared-expense-detail-meta">
                  <span><Calendar size={14} /> {new Date(expense.expense_date).toLocaleDateString('es-AR', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</span>
                  <span className={`shared-expense-status-badge ${expense.is_settled ? 'settled' : 'pending'}`}>
                    {expense.is_settled ? <CheckCircle size={14} /> : <Clock size={14} />}
                    {expense.is_settled ? 'Saldado' : 'Pendiente'}
                  </span>
                </div>
              </div>
              <div className="shared-expense-detail-total">
                <span className="shared-expense-detail-amount">
                  {expense.currency_symbol}{parseFloat(expense.total_amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
                <span className="shared-expense-detail-label">Total</span>
              </div>
            </div>

            {/* Quién pagó */}
            <div className="shared-expense-detail-section">
              <h4>
                <CreditCard size={18} />
                Quién pagó
              </h4>
              <div className="shared-expense-detail-payers">
                {expense.payers?.map(payer => (
                  <div key={payer.id} className="shared-expense-payer-item">
                    <div className="shared-expense-payer-avatar">
                      {payer.displayName?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="shared-expense-payer-info">
                      <span className="shared-expense-payer-name">
                        {payer.displayName}
                        {payer.userId === currentUserId && <span className="shared-you-badge">Tú</span>}
                        {payer.isVirtual && <span className="shared-virtual-badge">Ficticio</span>}
                      </span>
                    </div>
                    <span className="shared-expense-payer-amount">
                      {expense.currency_symbol}{payer.amountPaid.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* División del gasto */}
            <div className="shared-expense-detail-section">
              <h4>
                <PieChart size={18} />
                División del gasto
              </h4>
              <div className="shared-expense-detail-splits">
                {expense.splits?.map(split => (
                  <div 
                    key={split.id} 
                    className={`shared-expense-split-item ${split.isSettled ? 'settled' : ''} ${split.userId === currentUserId ? 'current-user' : ''}`}
                  >
                    <div className="shared-expense-split-avatar">
                      {split.displayName?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="shared-expense-split-info">
                      <span className="shared-expense-split-name">
                        {split.displayName}
                        {split.userId === currentUserId && <span className="shared-you-badge">Tú</span>}
                        {split.isVirtual && <span className="shared-virtual-badge">Ficticio</span>}
                      </span>
                      <span className="shared-expense-split-status">
                        {split.isSettled ? (
                          <><CheckCircle size={12} /> Pagado</>
                        ) : (
                          <><Clock size={12} /> Pendiente</>
                        )}
                      </span>
                    </div>
                    <div className="shared-expense-split-amounts">
                      <span className="shared-expense-split-owed">
                        Debe: {expense.currency_symbol}{split.amountOwed.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                      {split.pendingAmount > 0 && !split.isSettled && (
                        <span className="shared-expense-split-pending">
                          Pendiente: {expense.currency_symbol}{split.pendingAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Resumen para el usuario actual */}
            {userSplit && (
              <div className="shared-expense-detail-summary">
                <div className="shared-expense-summary-card">
                  <div className="shared-expense-summary-icon">
                    {userIsPayer ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                  </div>
                  <div className="shared-expense-summary-content">
                    {userIsPayer && (
                      <div className="shared-expense-summary-row positive">
                        <span>Pagaste:</span>
                        <strong>{expense.currency_symbol}{expense.payers?.find(p => p.userId === currentUserId)?.amountPaid.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '0.00'}</strong>
                      </div>
                    )}
                    <div className="shared-expense-summary-row">
                      <span>Tu parte:</span>
                      <strong>{expense.currency_symbol}{userSplit.amountOwed.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    {!userSplit.isSettled && userSplit.pendingAmount > 0 && (
                      <div className="shared-expense-summary-row pending">
                        <span>Debés pagar:</span>
                        <strong>{expense.currency_symbol}{userSplit.pendingAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Notas */}
            {expense.notes && (
              <div className="shared-expense-detail-notes">
                <h4><FileText size={18} /> Notas</h4>
                <p>{expense.notes}</p>
              </div>
            )}

            {/* Acciones */}
            <div className="shared-modal-actions">
              <button type="button" className="shared-btn-cancel" onClick={onClose}>
                Cerrar
              </button>
              
              {/* Botones para pagadores: Cobrar y Resignar */}
              {!expense.is_settled && isPayer && totalOwedToUser > 0 && (
                <>
                  <button 
                    type="button" 
                    className="shared-collect-btn"
                    onClick={handleCollectDebt}
                    disabled={collectingDebt}
                  >
                    {collectingDebt ? (
                      <div className="shared-loading-spinner small" />
                    ) : (
                      <Bell size={18} />
                    )}
                    Cobrar ({expense.currency_symbol}{totalOwedToUser.toLocaleString('es-AR', { minimumFractionDigits: 2 })})
                  </button>
                  <button 
                    type="button" 
                    className="shared-btn-danger"
                    onClick={handleResignClick}
                  >
                    <AlertCircle size={18} />
                    Resignar Deuda
                  </button>
                </>
              )}
              
              {!expense.is_settled && (
                <button 
                  type="button" 
                  className="shared-btn-success"
                  onClick={handleSettleClick}
                >
                  <CheckCircle size={18} />
                  Finalizar Gasto
                </button>
              )}
            </div>
          </div>
        ) : showResignConfirm ? (
          /* Confirmación de resignar deuda */
          <div className="shared-settle-confirm">
            <div className="shared-settle-confirm-icon danger">
              <AlertCircle size={48} />
            </div>
            
            <h3>¿Resignar deuda?</h3>
            <p className="shared-settle-confirm-text">
              Pagaste <strong>{expense.currency_symbol}{userPaidAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong> pero 
              te deben <strong>{expense.currency_symbol}{totalOwedToUser.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>.
              Al resignar, asumirás el gasto total y la deuda quedará saldada.
            </p>
            
            <div className="shared-warning-message">
              <AlertCircle size={18} />
              <span>Esta acción no se puede deshacer. Tu gasto real de {expense.currency_symbol}{userPaidAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })} se registrará en tu cuenta bancaria.</span>
            </div>

            <div className="shared-bank-options">
              <label className="shared-radio-option large">
                <input
                  type="radio"
                  name="resignOption"
                  checked={deductFromBank}
                  onChange={() => setDeductFromBank(true)}
                />
                <div className="shared-radio-content">
                  <Check size={20} className="shared-radio-icon success" />
                  <div>
                    <strong>Registrar en mi banco</strong>
                    <span>Se registrará tu gasto real de {expense.currency_symbol}{userPaidAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </label>
              
              <label className="shared-radio-option large">
                <input
                  type="radio"
                  name="resignOption"
                  checked={!deductFromBank}
                  onChange={() => setDeductFromBank(false)}
                />
                <div className="shared-radio-content">
                  <X size={20} className="shared-radio-icon" />
                  <div>
                    <strong>Solo marcar como saldado</strong>
                    <span>No afectará tu cuenta bancaria</span>
                  </div>
                </div>
              </label>
            </div>

            {deductFromBank && filteredBankAccounts.length > 0 && (
              <div className="shared-form-group">
                <label>Seleccionar cuenta bancaria ({groupCurrency})</label>
                <select
                  value={selectedBankAccount}
                  onChange={e => setSelectedBankAccount(e.target.value)}
                >
                  {filteredBankAccounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.name} - {account.currency_symbol}{parseFloat(account.current_balance).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {deductFromBank && filteredBankAccounts.length === 0 && (
              <div className="shared-form-group">
                <div className="shared-warning-message">
                  <AlertCircle size={18} />
                  <span>No tienes cuentas bancarias en {groupCurrency}. El gasto se marcará como resignado pero no se registrará en ninguna cuenta.</span>
                </div>
              </div>
            )}

            <div className="shared-modal-actions">
              <button type="button" className="shared-btn-cancel" onClick={() => setShowResignConfirm(false)}>
                Volver
              </button>
              <button 
                type="button" 
                className="shared-btn-danger" 
                onClick={handleConfirmResign}
                disabled={resigningDebt}
              >
                {resigningDebt ? (
                  <div className="shared-loading-spinner small" />
                ) : (
                  <AlertCircle size={18} />
                )}
                Confirmar Resignación
              </button>
            </div>
          </div>
        ) : (
          /* Confirmación de saldar con banco */
          <div className="shared-settle-confirm">
            <div className="shared-settle-confirm-icon">
              <CreditCard size={48} />
            </div>
            
            <h3>¿Descontar de tu cuenta?</h3>
            <p className="shared-settle-confirm-text">
              Tu parte del gasto es <strong>{expense.currency_symbol}{userSplit?.pendingAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>. 
              ¿Querés que se registre como gasto personal y se descuente de tu cuenta bancaria?
            </p>

            <div className="shared-bank-options">
              <label className="shared-radio-option large">
                <input
                  type="radio"
                  name="settleOption"
                  checked={deductFromBank}
                  onChange={() => setDeductFromBank(true)}
                />
                <div className="shared-radio-content">
                  <Check size={20} className="shared-radio-icon success" />
                  <div>
                    <strong>Sí, descontar del banco</strong>
                    <span>El monto se restará de tu cuenta seleccionada</span>
                  </div>
                </div>
              </label>
              
              <label className="shared-radio-option large">
                <input
                  type="radio"
                  name="settleOption"
                  checked={!deductFromBank}
                  onChange={() => setDeductFromBank(false)}
                />
                <div className="shared-radio-content">
                  <X size={20} className="shared-radio-icon" />
                  <div>
                    <strong>No, solo marcar como saldado</strong>
                    <span>El gasto se marcará como pagado sin afectar tu banco</span>
                  </div>
                </div>
              </label>
            </div>

            {deductFromBank && filteredBankAccounts.length > 0 && (
              <div className="shared-form-group">
                <label>Seleccionar cuenta bancaria ({groupCurrency})</label>
                <select
                  value={selectedBankAccount}
                  onChange={e => setSelectedBankAccount(e.target.value)}
                >
                  {filteredBankAccounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.name} - {account.currency_symbol}{parseFloat(account.current_balance).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {deductFromBank && filteredBankAccounts.length === 0 && (
              <div className="shared-form-group">
                <div className="shared-warning-message">
                  <AlertCircle size={18} />
                  <span>No tienes cuentas bancarias en {groupCurrency}. El gasto se marcará como saldado pero no se descontará de ninguna cuenta.</span>
                </div>
              </div>
            )}

            <div className="shared-modal-actions">
              <button type="button" className="shared-btn-cancel" onClick={() => setShowSettleConfirm(false)}>
                Volver
              </button>
              <button type="button" className="shared-btn-success" onClick={handleConfirmSettle}>
                <CheckCircle size={18} />
                Confirmar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SharedExpenses;
