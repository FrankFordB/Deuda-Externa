/**
 * Bank Accounts Service - Gestión de cuentas bancarias multi-moneda
 */
import { supabase } from './supabase';

/**
 * Obtener todas las cuentas del usuario
 */
export const getUserAccounts = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return { accounts: data || [], error: null };
  } catch (error) {
    console.error('Error obteniendo cuentas:', error);
    return { accounts: [], error: error.message };
  }
};

/**
 * Obtener una cuenta específica
 */
export const getAccount = async (accountId) => {
  try {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (error) throw error;
    return { account: data, error: null };
  } catch (error) {
    console.error('Error obteniendo cuenta:', error);
    return { account: null, error: error.message };
  }
};

/**
 * Crear una cuenta bancaria
 */
export const createAccount = async (userId, accountData) => {
  try {
    // Verificar que no exceda el límite de 4 cuentas
    const { data: existingAccounts } = await supabase
      .from('bank_accounts')
      .select('id')
      .eq('user_id', userId);

    if (existingAccounts && existingAccounts.length >= 4) {
      return { 
        account: null, 
        error: 'Máximo 4 cuentas permitidas por usuario' 
      };
    }

    const { data, error } = await supabase
      .from('bank_accounts')
      .insert({
        user_id: userId,
        name: accountData.name,
        currency: accountData.currency,
        currency_symbol: accountData.currency_symbol,
        initial_balance: parseFloat(accountData.initial_balance) || 0,
        current_balance: parseFloat(accountData.initial_balance) || 0
      })
      .select()
      .single();

    if (error) throw error;
    return { account: data, error: null };
  } catch (error) {
    console.error('Error creando cuenta:', error);
    return { account: null, error: error.message };
  }
};

/**
 * Actualizar cuenta bancaria
 */
export const updateAccount = async (accountId, updates) => {
  try {
    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.initial_balance !== undefined) updateData.initial_balance = parseFloat(updates.initial_balance);
    if (updates.currency !== undefined) updateData.currency = updates.currency;
    if (updates.currency_symbol !== undefined) updateData.currency_symbol = updates.currency_symbol;

    const { data, error } = await supabase
      .from('bank_accounts')
      .update(updateData)
      .eq('id', accountId)
      .select()
      .single();

    if (error) throw error;
    return { account: data, error: null };
  } catch (error) {
    console.error('Error actualizando cuenta:', error);
    return { account: null, error: error.message };
  }
};

/**
 * Eliminar (desactivar) una cuenta
 */
export const deleteAccount = async (accountId) => {
  try {
    const { error } = await supabase
      .from('bank_accounts')
      .update({ is_active: false })
      .eq('id', accountId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error eliminando cuenta:', error);
    return { error: error.message };
  }
};

/**
 * Obtener gastos de una cuenta en un mes específico
 */
export const getAccountExpenses = async (accountId, year, month) => {
  try {
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

    // Primero obtener la cuenta para saber su moneda
    const { data: account, error: accountError } = await supabase
      .from('bank_accounts')
      .select('currency')
      .eq('id', accountId)
      .single();

    if (accountError) throw accountError;

    // Obtener SOLO gastos de la misma moneda que la cuenta
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('bank_account_id', accountId)
      .eq('currency', account.currency) // Filtrar por moneda
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (error) throw error;
    return { expenses: data || [], error: null };
  } catch (error) {
    console.error('Error obteniendo gastos de cuenta:', error);
    return { expenses: [], error: error.message };
  }
};

/**
 * Obtener estadísticas de una cuenta en un mes
 */
export const getAccountStats = async (accountId, year, month) => {
  try {
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

    // Primero obtener la cuenta para saber su moneda
    const { data: account, error: accountError } = await supabase
      .from('bank_accounts')
      .select('currency, currency_symbol, current_balance, initial_balance')
      .eq('id', accountId)
      .single();

    if (accountError) throw accountError;

    // Obtener gastos del mes SOLO DE LA MISMA MONEDA
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('amount, is_paid, currency, date')
      .eq('bank_account_id', accountId)
      .eq('currency', account.currency)
      .gte('date', startDate)
      .lte('date', endDate);

    if (expensesError) throw expensesError;

    // Obtener TODAS las deudas vinculadas a esta cuenta (sin filtro de mes)
    // porque las deudas afectan el balance total, no solo del mes
    const { data: allDebts, error: allDebtsError } = await supabase
      .from('debts')
      .select('amount, status, currency, created_at')
      .eq('bank_account_id', accountId)
      .eq('currency', account.currency);

    if (allDebtsError) throw allDebtsError;

    // Obtener deudas del mes específico (para estadísticas mensuales)
    const monthDebts = allDebts?.filter(d => {
      const debtDate = new Date(d.created_at);
      return debtDate >= new Date(startDate) && debtDate <= new Date(endDate);
    }) || [];

    // Calcular estadísticas
    const totalExpenses = expenses?.reduce((sum, e) => sum + parseFloat(e.amount), 0) || 0;
    const paidExpenses = expenses?.filter(e => e.is_paid).reduce((sum, e) => sum + parseFloat(e.amount), 0) || 0;
    const pendingExpenses = totalExpenses - paidExpenses;
    
    // Deudas del mes
    const totalDebtsMonth = monthDebts.reduce((sum, d) => sum + parseFloat(d.amount), 0) || 0;
    const paidDebtsMonth = monthDebts.filter(d => d.status === 'paid').reduce((sum, d) => sum + parseFloat(d.amount), 0) || 0;
    
    // Deudas totales (todas)
    const totalDebtsAll = allDebts?.reduce((sum, d) => sum + parseFloat(d.amount), 0) || 0;
    const paidDebtsAll = allDebts?.filter(d => d.status === 'paid').reduce((sum, d) => sum + parseFloat(d.amount), 0) || 0;

    return {
      stats: {
        // Balance
        currentBalance: account.current_balance,
        initialBalance: account.initial_balance,
        currency: account.currency,
        currencySymbol: account.currency_symbol,
        
        // Gastos del mes
        totalExpenses,
        paidExpenses,
        pendingExpenses,
        expenseCount: expenses?.length || 0,
        
        // Deudas del mes
        totalDebtsMonth,
        paidDebtsMonth,
        debtCountMonth: monthDebts.length,
        
        // Deudas totales
        totalDebtsAll,
        paidDebtsAll,
        debtCountAll: allDebts?.length || 0
      },
      error: null
    };
  } catch (error) {
    console.error('Error obteniendo estadísticas de cuenta:', error);
    return { stats: null, error: error.message };
  }
};

/**
 * Recalcular balance de una cuenta manualmente
 */
export const recalculateBalance = async (accountId) => {
  try {
    const { error } = await supabase.rpc('update_account_balance', {
      account_id: accountId
    });

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error recalculando balance:', error);
    return { error: error.message };
  }
};

export default {
  getUserAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  getAccountExpenses,
  getAccountStats,
  recalculateBalance
};
