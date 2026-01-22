/**
 * Debts Service - Manejo de deudas entre amigos
 */
import { supabase } from './supabase';
import { createNotification } from './notificationsService';

/**
 * Crear una nueva deuda
 * Soporta tanto amigos reales como virtuales, con cuotas y fechas
 * direction: 'i_owe' (yo debo) | 'owed_to_me' (me deben)
 */
export const createDebt = async (debtData) => {
  try {
    const isVirtualFriend = debtData.friendType === 'virtual';
    const isIOwe = debtData.direction === 'i_owe';
    const installments = parseInt(debtData.installments) || 1;
    const totalAmount = parseFloat(debtData.amount);
    const installmentAmount = totalAmount / installments;
    
    const insertData = {
      creditor_id: debtData.creditorId,
      debtor_id: debtData.debtorId,
      amount: totalAmount,
      description: debtData.description,
      category: debtData.category || 'other',
      purchase_date: debtData.purchaseDate || null,
      due_date: debtData.dueDate || null,
      installments: installments,
      installment_amount: installmentAmount,
      total_amount: totalAmount,
      currency: debtData.currency || 'ARS',
      currency_symbol: debtData.currency_symbol || '$',
      bank_account_id: debtData.bank_account_id || null,
      created_at: new Date().toISOString()
    };

    if (isVirtualFriend) {
      // Deuda con amigo virtual: se auto-acepta siempre
      insertData.virtual_friend_id = debtData.friendId;
      insertData.debtor_type = 'virtual';
      insertData.status = 'accepted';
      insertData.accepted_at = new Date().toISOString();
      
      // Si yo debo a un amigo virtual, ajustar los IDs
      if (isIOwe) {
        insertData.debtor_id = debtData.debtorId; // Yo
        insertData.creditor_id = null; // El virtual no tiene creditor_id
      } else {
        insertData.creditor_id = debtData.creditorId; // Yo
        insertData.debtor_id = null; // El virtual no tiene debtor_id
      }
    } else {
      // Deuda con amigo real
      insertData.virtual_friend_id = null;
      insertData.debtor_type = 'real';
      
      // Asignar los IDs correctamente según quien crea la deuda
      insertData.creditor_id = debtData.creditorId;
      insertData.debtor_id = debtData.debtorId;
      
      if (isIOwe) {
        // YO DEBO: queda pendiente hasta que el amigo acepte
        insertData.status = 'pending';
      } else {
        // ME DEBEN: queda pendiente hasta que el amigo acepte
        insertData.status = 'pending';
      }
    }

    const { data, error } = await supabase
      .from('debts')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    // Si hay cuotas, crear los registros de cuotas
    if (installments > 1 && data && debtData.dueDate) {
      await createDebtInstallments(data.id, installments, installmentAmount, debtData.dueDate);
    }

    // Enviar notificación al amigo si es amigo real
    if (!isVirtualFriend && data) {
      // El creador de la deuda es quien está logueado
      // Determinar quién es el creador basado en la dirección
      const creatorId = isIOwe ? debtData.debtorId : debtData.creditorId;
      
      // DEBUG: Ver valores antes de crear notificación
      console.log('🔍 DEBUG - Creando notificación:');
      console.log('  - isIOwe:', isIOwe);
      console.log('  - creatorId (quien crea la deuda):', creatorId);
      console.log('  - debtData.friendId (debería ser el amigo):', debtData.friendId);
      console.log('  - debtData.creditorId:', debtData.creditorId);
      console.log('  - debtData.debtorId:', debtData.debtorId);
      console.log('  - direction:', debtData.direction);
      
      // Obtener nombre del usuario que crea la deuda
      const { data: creatorProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', creatorId)
        .single();

      const creatorName = creatorProfile?.full_name || 'Un amigo';
      
      // Determinar el receptor de la notificación (siempre es el friendId)
      const recipientId = debtData.friendId;
      
      console.log('  - recipientId (quien recibirá notificación):', recipientId);
      console.log('  - creatorName:', creatorName);
      
      // Crear notificación
      await createNotification({
        userId: recipientId,
        type: 'debt_request',
        title: isIOwe ? 'Nueva deuda - Te deben dinero' : 'Nueva deuda - Debes dinero',
        message: isIOwe 
          ? `${creatorName} registró que te debe ${debtData.currency_symbol}${totalAmount.toFixed(2)} ${debtData.currency} - ${debtData.description}`
          : `${creatorName} registró que le debes ${debtData.currency_symbol}${totalAmount.toFixed(2)} ${debtData.currency} - ${debtData.description}`,
        data: {
          debt_id: data.id,
          amount: totalAmount,
          currency: debtData.currency,
          description: debtData.description
        },
        actionRequired: true,
        actionType: 'accept_debt'
      });
    }

    return { debt: data, error: null, success: true };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { debt: null, error: null };
    console.error('Error creando deuda:', error);
    return { debt: null, error };
  }
};

/**
 * Crear cuotas para una deuda
 */
const createDebtInstallments = async (debtId, totalInstallments, amount, firstDueDate) => {
  try {
    const installments = [];
    const baseDate = new Date(firstDueDate);

    for (let i = 1; i <= totalInstallments; i++) {
      const dueDate = new Date(baseDate);
      dueDate.setMonth(dueDate.getMonth() + (i - 1));

      installments.push({
        debt_id: debtId,
        installment_number: i,
        amount: amount,
        due_date: dueDate.toISOString().split('T')[0],
        paid: false,
        created_at: new Date().toISOString()
      });
    }

    const { error } = await supabase
      .from('debt_installments')
      .insert(installments);

    if (error) {
      console.warn('Error creando cuotas de deuda:', error);
    }
  } catch (error) {
    console.warn('Error en createDebtInstallments:', error);
  }
};

/**
 * Obtener cuotas de una deuda
 */
export const getDebtInstallments = async (debtId) => {
  try {
    if (!debtId) {
      return { installments: [], error: null };
    }

    const { data, error } = await supabase
      .from('debt_installments')
      .select('*')
      .eq('debt_id', debtId)
      .order('installment_number', { ascending: true });

    if (error) {
      // Ignorar errores 400/404 silenciosamente
      if (error.code === 'PGRST116' || error.message?.includes('400')) {
        return { installments: [], error: null };
      }
      throw error;
    }
    return { installments: data || [], error: null };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { installments: [], error: null };
    console.error('Error obteniendo cuotas:', error);
    return { installments: [], error: null };
  }
};

/**
 * Marcar una cuota como pagada
 */
export const markInstallmentAsPaid = async (installmentId, userId) => {
  try {
    const { data, error } = await supabase
      .from('debt_installments')
      .update({
        paid: true,
        paid_at: new Date().toISOString(),
        paid_by: userId,
        payment_reverted: false,
        reverted_at: null,
        reverted_by: null,
        revert_reason: null
      })
      .eq('id', installmentId)
      .select()
      .single();

    if (error) throw error;

    // El trigger automáticamente actualiza paid_installments y verifica si la deuda está completa
    return { installment: data, error: null, success: true };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { installment: null, error: null };
    console.error('Error marcando cuota como pagada:', error);
    return { installment: null, error, success: false };
  }
};

/**
 * Revertir pago de una cuota
 */
export const revertInstallmentPayment = async (installmentId, userId, reason = 'Reversión manual') => {
  try {
    // Primero obtener la cuota para verificar
    const { data: installment, error: fetchError } = await supabase
      .from('debt_installments')
      .select('*, debt:debts!debt_id(*)')
      .eq('id', installmentId)
      .single();

    if (fetchError) throw fetchError;

    if (!installment.paid) {
      return { 
        installment: null, 
        error: { message: 'La cuota no está marcada como pagada' },
        success: false 
      };
    }

    // Revertir el pago
    const { data, error } = await supabase
      .from('debt_installments')
      .update({
        paid: false,
        paid_at: null,
        payment_reverted: true,
        reverted_at: new Date().toISOString(),
        reverted_by: userId,
        revert_reason: reason
      })
      .eq('id', installmentId)
      .select()
      .single();

    if (error) throw error;

    // El trigger automáticamente actualiza paid_installments y el estado de la deuda
    return { installment: data, error: null, success: true };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { installment: null, error: null };
    console.error('Error revirtiendo pago de cuota:', error);
    return { installment: null, error, success: false };
  }
};

/**
 * Notificar al acreedor que el deudor pagó una cuota
 * El acreedor debe confirmar el pago
 */
export const notifyInstallmentPayment = async (installmentId, debtorId) => {
  try {
    // Obtener información de la cuota y la deuda
    const { data: installment, error: fetchError } = await supabase
      .from('debt_installments')
      .select('*, debt:debts!debt_id(*)')
      .eq('id', installmentId)
      .single();

    if (fetchError) throw fetchError;

    const debt = installment.debt;
    
    // Verificar que el usuario es el deudor
    if (debt.debtor_id !== debtorId) {
      return { 
        success: false, 
        error: { message: 'No tienes permiso para notificar este pago' } 
      };
    }

    // Obtener nombre del deudor
    const { data: debtorProfile } = await supabase
      .from('profiles')
      .select('first_name, last_name, nickname')
      .eq('id', debtorId)
      .single();

    const debtorName = debtorProfile?.first_name 
      ? `${debtorProfile.first_name} ${debtorProfile.last_name || ''}`.trim()
      : debtorProfile?.nickname || 'Tu deudor';

    // Crear notificación para el acreedor
    await createNotification({
      userId: debt.creditor_id,
      type: 'payment_claim',
      title: '💰 Pago de cuota reportado',
      message: `${debtorName} indica que pagó la cuota ${installment.installment_number}/${debt.installments} de "${debt.description}" (${debt.currency_symbol || '$'}${installment.amount})`,
      data: {
        debt_id: debt.id,
        installment_id: installmentId,
        installment_number: installment.installment_number,
        amount: installment.amount,
        debtor_id: debtorId,
        debtor_name: debtorName
      },
      actionRequired: true,
      actionType: 'confirm_payment'
    });

    return { success: true, error: null };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { success: false, error: null };
    console.error('Error notificando pago de cuota:', error);
    return { success: false, error };
  }
};

/**
 * Obtener deudas donde soy acreedor (me deben)
 * Incluye tanto deudores reales como virtuales
 */
export const getDebtsAsCreditor = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('debts')
      .select(`
        *,
        debtor:profiles!debts_debtor_id_fkey(id, nickname, first_name, last_name, avatar_url),
        virtual_debtor:virtual_friends!debts_virtual_friend_id_fkey(id, name, phone, email)
      `)
      .eq('creditor_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Normalizar datos para mostrar amigo virtual como debtor si aplica
    const normalizedDebts = data.map(debt => {
      if (debt.virtual_friend_id && debt.virtual_debtor) {
        return {
          ...debt,
          debtor: {
            id: debt.virtual_debtor.id,
            first_name: debt.virtual_debtor.name,
            last_name: '',
            nickname: debt.virtual_debtor.phone || 'contacto'
          },
          is_virtual_debt: true
        };
      }
      return { ...debt, is_virtual_debt: false };
    });
    
    return { debts: normalizedDebts, error: null };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { debts: [], error: null };
    console.error('Error obteniendo deudas como acreedor:', error);
    return { debts: [], error };
  }
};

/**
 * Obtener deudas donde debo (deudas recibidas)
 */
export const getDebtsAsDebtor = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('debts')
      .select(`
        *,
        creditor:profiles!debts_creditor_id_fkey(id, nickname, first_name, last_name, avatar_url)
      `)
      .eq('debtor_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { debts: data, error: null };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { debts: [], error: null };
    console.error('Error obteniendo deudas como deudor:', error);
    return { debts: [], error };
  }
};

/**
 * Aceptar una deuda (la convierte en gasto)
 */
export const acceptDebt = async (debtId, userId) => {
  try {
    // Obtener la deuda
    const { data: debt, error: fetchError } = await supabase
      .from('debts')
      .select('*')
      .eq('id', debtId)
      .single();

    if (fetchError) throw fetchError;

    // Actualizar estado de la deuda
    const { error: updateError } = await supabase
      .from('debts')
      .update({ 
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', debtId);

    if (updateError) throw updateError;

    // Crear gasto automático para el deudor
    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .insert({
        user_id: debt.debtor_id,
        amount: debt.amount,
        description: `Deuda: ${debt.description}`,
        category: 'debt',
        payment_source: 'friend',
        friend_id: debt.creditor_id,
        date: new Date().toISOString().split('T')[0],
        is_paid: false,
        installments: 1,
        current_installment: 1,
        debt_id: debtId,
        bank_account_id: debt.bank_account_id, // Vincular con cuenta bancaria si existe
        currency: debt.currency || 'ARS', // Incluir moneda
        currency_symbol: debt.currency_symbol || '$', // Incluir símbolo
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (expenseError) throw expenseError;

    return { debt: { ...debt, status: 'accepted' }, expense, error: null, success: true };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { debt: null, expense: null, error: null };
    console.error('Error aceptando deuda:', error);
    return { debt: null, expense: null, error };
  }
};

/**
 * Rechazar una deuda
 */
export const rejectDebt = async (debtId) => {
  try {
    const { data, error } = await supabase
      .from('debts')
      .update({ 
        status: 'rejected',
        rejected_at: new Date().toISOString()
      })
      .eq('id', debtId)
      .select()
      .single();

    if (error) throw error;
    return { debt: data, error: null };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { debt: null, error: null };
    console.error('Error rechazando deuda:', error);
    return { debt: null, error };
  }
};

/**
 * Marcar deuda como pagada
 * Solo funciona para deudas con amigos virtuales (debtor_type = 'virtual')
 * Para amigos reales, se requiere confirmación del acreedor
 */
export const markDebtAsPaid = async (debtId, markedByCreditor = false) => {
  try {
    // Obtener información de la deuda primero
    const { data: debt, error: fetchError } = await supabase
      .from('debts')
      .select('*, debtor:debtor_id(id, first_name, last_name, full_name), creditor:creditor_id(id, first_name, last_name, full_name)')
      .eq('id', debtId)
      .single();

    if (fetchError) throw fetchError;

    // Si es deuda virtual, permitir marcar como pagada/no pagada (toggle)
    if (debt.debtor_type === 'virtual') {
      const newStatus = debt.status === 'paid' ? 'accepted' : 'paid';
      const { data, error } = await supabase
        .from('debts')
        .update({ 
          status: newStatus,
          paid_at: newStatus === 'paid' ? new Date().toISOString() : null
        })
        .eq('id', debtId)
        .select()
        .single();

      if (error) throw error;
      return { debt: data, error: null, wasPaid: debt.status === 'paid' };
    }

    // Si es deuda real y el acreedor marca como pagada
    if (markedByCreditor) {
      const currentStatus = debt.paid_by_creditor || false;
      
      const { data, error } = await supabase
        .from('debts')
        .update({ 
          paid_by_creditor: !currentStatus,
          creditor_marked_paid_at: !currentStatus ? new Date().toISOString() : null
        })
        .eq('id', debtId)
        .select()
        .single();

      if (error) throw error;

      // Enviar notificación al deudor
      if (!currentStatus) {
        const creditorName = debt.creditor?.full_name || debt.creditor?.first_name || 'Tu acreedor';
        await createNotification({
          userId: debt.debtor_id,
          type: 'payment_marked',
          title: '✅ Pago registrado',
          message: `${creditorName} marcó como pagada la deuda "${debt.description}". Por favor confirma si es correcto.`,
          data: {
            debt_id: debtId,
            amount: debt.amount,
            currency: debt.currency,
            description: debt.description
          },
          actionRequired: true,
          actionType: 'confirm_payment_marked'
        });
      }

      return { debt: data, error: null };
    }

    // Validar que solo se puede marcar como pagada si es deuda virtual
    return { 
      debt: null, 
      error: { 
        message: 'No puedes marcar como pagada una deuda con una persona real. Solicita confirmación de pago al acreedor.' 
      } 
    };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { debt: null, error: null };
    console.error('Error marcando deuda como pagada:', error);
    return { debt: null, error };
  }
};

/**
 * Obtener resumen de deudas
 */
export const getDebtsSummary = async (userId) => {
  try {
    // Deudas donde soy acreedor (me deben)
    const { data: asCreditor } = await supabase
      .from('debts')
      .select('amount, status')
      .eq('creditor_id', userId)
      .in('status', ['pending', 'accepted']);

    // Deudas donde soy deudor (debo)
    const { data: asDebtor } = await supabase
      .from('debts')
      .select('amount, status')
      .eq('debtor_id', userId)
      .in('status', ['pending', 'accepted']);

    const totalOwedToMe = (asCreditor || [])
      .filter(d => d.status === 'accepted')
      .reduce((sum, d) => sum + d.amount, 0);

    const totalIOwe = (asDebtor || [])
      .filter(d => d.status === 'accepted')
      .reduce((sum, d) => sum + d.amount, 0);

    const pendingToReceive = (asCreditor || [])
      .filter(d => d.status === 'pending').length;

    const pendingToAccept = (asDebtor || [])
      .filter(d => d.status === 'pending').length;

    return {
      summary: {
        totalOwedToMe,
        totalIOwe,
        netBalance: totalOwedToMe - totalIOwe,
        pendingToReceive,
        pendingToAccept
      },
      error: null
    };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { summary: null, error: null };
    console.error('Error obteniendo resumen de deudas:', error);
    return { summary: null, error };
  }
};

/**
 * Obtener deudas por amigo
 */
export const getDebtsByFriend = async (userId) => {
  try {
    const { data: asCreditor } = await supabase
      .from('debts')
      .select(`
        amount,
        status,
        debtor:profiles!debts_debtor_id_fkey(id, nickname, first_name, last_name, avatar_url)
      `)
      .eq('creditor_id', userId)
      .eq('status', 'accepted');

    const { data: asDebtor } = await supabase
      .from('debts')
      .select(`
        amount,
        status,
        creditor:profiles!debts_creditor_id_fkey(id, nickname, first_name, last_name, avatar_url)
      `)
      .eq('debtor_id', userId)
      .eq('status', 'accepted');

    // Agrupar por amigo
    const byFriend = {};

    (asCreditor || []).forEach(d => {
      // Skip if debtor is null
      if (!d.debtor || !d.debtor.id) return;
      
      const friendId = d.debtor.id;
      if (!byFriend[friendId]) {
        byFriend[friendId] = {
          friend: d.debtor,
          owesMe: 0,
          iOwe: 0
        };
      }
      byFriend[friendId].owesMe += d.amount;
    });

    (asDebtor || []).forEach(d => {
      // Skip if creditor is null
      if (!d.creditor || !d.creditor.id) return;
      
      const friendId = d.creditor.id;
      if (!byFriend[friendId]) {
        byFriend[friendId] = {
          friend: d.creditor,
          owesMe: 0,
          iOwe: 0
        };
      }
      byFriend[friendId].iOwe += d.amount;
    });

    // Calcular balance neto
    Object.values(byFriend).forEach(f => {
      f.netBalance = f.owesMe - f.iOwe;
    });

    return { debtsByFriend: Object.values(byFriend), error: null };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { debtsByFriend: [], error: null };
    console.error('Error obteniendo deudas por amigo:', error);
    return { debtsByFriend: [], error };
  }
};

/**
 * Suscripción en tiempo real a deudas
 * DESHABILITADO para evitar loops
 */
export const subscribeDebts = (userId, callback) => {
  return () => {};
};

export default {
  createDebt,
  getDebtsAsCreditor,
  getDebtsAsDebtor,
  acceptDebt,
  rejectDebt,
  markDebtAsPaid,
  getDebtsSummary,
  getDebtsByFriend,
  getDebtInstallments,
  markInstallmentAsPaid,
  revertInstallmentPayment,
  notifyInstallmentPayment,
  subscribeDebts
};
