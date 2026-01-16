/**
 * Debts Service - Manejo de deudas entre amigos
 */
import { supabase } from './supabase';

/**
 * Crear una nueva deuda
 * Soporta tanto amigos reales como virtuales, con cuotas y fechas
 */
export const createDebt = async (debtData) => {
  try {
    const isVirtualDebtor = debtData.debtorType === 'virtual';
    const installments = parseInt(debtData.installments) || 1;
    const totalAmount = parseFloat(debtData.amount);
    const installmentAmount = totalAmount / installments;
    
    const insertData = {
      creditor_id: debtData.creditorId,
      amount: totalAmount,
      description: debtData.description,
      category: debtData.category || 'other',
      purchase_date: debtData.purchaseDate || null,
      due_date: debtData.dueDate || null,
      installments: installments,
      installment_amount: installmentAmount,
      total_amount: totalAmount,
      created_at: new Date().toISOString()
    };

    if (isVirtualDebtor) {
      // Deuda con amigo virtual: se auto-acepta
      insertData.virtual_friend_id = debtData.debtorId;
      insertData.debtor_id = null;
      insertData.debtor_type = 'virtual';
      insertData.status = 'accepted'; // Auto-aceptada
      insertData.accepted_at = new Date().toISOString();
    } else {
      // Deuda con amigo real: queda pendiente
      insertData.debtor_id = debtData.debtorId;
      insertData.virtual_friend_id = null;
      insertData.debtor_type = 'real';
      insertData.status = 'pending';
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

    return { debt: data, error: null };
  } catch (error) {
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
    const { data, error } = await supabase
      .from('debt_installments')
      .select('*')
      .eq('debt_id', debtId)
      .order('installment_number', { ascending: true });

    if (error) throw error;
    return { installments: data || [], error: null };
  } catch (error) {
    console.error('Error obteniendo cuotas:', error);
    return { installments: [], error };
  }
};

/**
 * Marcar una cuota como pagada
 */
export const markInstallmentAsPaid = async (installmentId) => {
  try {
    const { data, error } = await supabase
      .from('debt_installments')
      .update({
        paid: true,
        paid_at: new Date().toISOString()
      })
      .eq('id', installmentId)
      .select()
      .single();

    if (error) throw error;

    // Verificar si todas las cuotas están pagadas
    if (data) {
      const { data: allInstallments } = await supabase
        .from('debt_installments')
        .select('paid')
        .eq('debt_id', data.debt_id);

      const allPaid = allInstallments?.every(i => i.paid);
      
      if (allPaid) {
        // Marcar la deuda principal como pagada
        await supabase
          .from('debts')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString()
          })
          .eq('id', data.debt_id);
      }
    }

    return { installment: data, error: null };
  } catch (error) {
    console.error('Error marcando cuota como pagada:', error);
    return { installment: null, error };
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
        debtor:profiles!debts_debtor_id_fkey(id, nickname, first_name, last_name),
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
        creditor:profiles!debts_creditor_id_fkey(id, nickname, first_name, last_name)
      `)
      .eq('debtor_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { debts: data, error: null };
  } catch (error) {
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
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (expenseError) throw expenseError;

    return { debt: { ...debt, status: 'accepted' }, expense, error: null };
  } catch (error) {
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
    console.error('Error rechazando deuda:', error);
    return { debt: null, error };
  }
};

/**
 * Marcar deuda como pagada
 */
export const markDebtAsPaid = async (debtId) => {
  try {
    const { data, error } = await supabase
      .from('debts')
      .update({ 
        status: 'paid',
        paid_at: new Date().toISOString()
      })
      .eq('id', debtId)
      .select()
      .single();

    if (error) throw error;

    // También marcar el gasto relacionado como pagado
    await supabase
      .from('expenses')
      .update({ 
        is_paid: true,
        paid_at: new Date().toISOString()
      })
      .eq('debt_id', debtId);

    return { debt: data, error: null };
  } catch (error) {
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
        debtor:profiles!debts_debtor_id_fkey(id, nickname, first_name, last_name)
      `)
      .eq('creditor_id', userId)
      .eq('status', 'accepted');

    const { data: asDebtor } = await supabase
      .from('debts')
      .select(`
        amount,
        status,
        creditor:profiles!debts_creditor_id_fkey(id, nickname, first_name, last_name)
      `)
      .eq('debtor_id', userId)
      .eq('status', 'accepted');

    // Agrupar por amigo
    const byFriend = {};

    (asCreditor || []).forEach(d => {
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
  subscribeDebts
};
