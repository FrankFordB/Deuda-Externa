/**
 * Debt Payments Service - Gestión de pagos parciales de deudas
 */
import { supabase } from './supabase';

/**
 * Registrar pago parcial de una deuda
 */
export const registerDebtPayment = async (debtId, paymentData) => {
  try {
    const { data, error } = await supabase
      .from('debt_payments')
      .insert({
        debt_id: debtId,
        amount: parseFloat(paymentData.amount),
        payment_method_id: paymentData.paymentMethodId || null,
        payment_date: paymentData.date || new Date().toISOString().split('T')[0],
        notes: paymentData.notes || ''
      })
      .select()
      .single();

    if (error) throw error;
    return { payment: data, error: null };
  } catch (error) {
    console.error('Error registrando pago de deuda:', error);
    return { payment: null, error };
  }
};

/**
 * Obtener historial de pagos de una deuda
 */
export const getDebtPayments = async (debtId) => {
  try {
    const { data, error } = await supabase
      .from('debt_payments')
      .select(`
        *,
        payment_method:payment_methods(id, name, icon, color)
      `)
      .eq('debt_id', debtId)
      .order('payment_date', { ascending: false });

    if (error) throw error;
    return { payments: data || [], error: null };
  } catch (error) {
    console.error('Error obteniendo pagos de deuda:', error);
    return { payments: [], error };
  }
};

/**
 * Obtener información completa de una deuda con sus pagos
 */
export const getDebtWithPayments = async (debtId) => {
  try {
    const { data: debt, error: debtError } = await supabase
      .from('debts')
      .select(`
        *,
        creditor:profiles!debts_creditor_id_fkey(id, nickname, first_name, last_name),
        debtor:profiles!debts_debtor_id_fkey(id, nickname, first_name, last_name),
        virtual_friend:virtual_friends(id, name)
      `)
      .eq('id', debtId)
      .single();

    if (debtError) throw debtError;

    const { data: payments, error: paymentsError } = await supabase
      .from('debt_payments')
      .select(`
        *,
        payment_method:payment_methods(id, name, icon, color)
      `)
      .eq('debt_id', debtId)
      .order('payment_date', { ascending: false });

    if (paymentsError) throw paymentsError;

    return {
      debt: {
        ...debt,
        payments: payments || []
      },
      error: null
    };
  } catch (error) {
    console.error('Error obteniendo deuda con pagos:', error);
    return { debt: null, error };
  }
};

export default {
  registerDebtPayment,
  getDebtPayments,
  getDebtWithPayments
};
