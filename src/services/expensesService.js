/**
 * Expenses Service - Manejo de gastos
 */
import { supabase } from './supabase';

/**
 * Crear un nuevo gasto
 */
export const createExpense = async (expenseData) => {
  try {
    // Construir objeto de inserción solo con campos esenciales
    const insertData = {
      user_id: expenseData.userId,
      amount: expenseData.amount,
      description: expenseData.description,
      category: expenseData.category,
      payment_source: expenseData.paymentSource || 'cash',
      date: expenseData.date || new Date().toISOString().split('T')[0],
      is_paid: expenseData.isPaid ?? true,
      currency: expenseData.currency || 'ARS',
      currency_symbol: expenseData.currency_symbol || '$'
    };

    // NO enviar friend_id - causa error 409 por FK constraint
    // Los gastos pagados por amigos se manejarán de otra forma

    console.log('📝 Intentando crear gasto:', insertData);

    const { data, error } = await supabase
      .from('expenses')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('❌ Error SQL al crear gasto:', error);
      throw error;
    }

    console.log('✅ Gasto creado exitosamente:', data);

    return { expense: data, error: null };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { expense: null, error: null };
    console.error('Error creando gasto:', error);
    return { expense: null, error };
  }
};

/**
 * Crear cuotas para un gasto - Comienza desde la fecha especificada
 */
const createInstallments = async (parentExpense, totalInstallments) => {
  const installmentAmount = parentExpense.amount;
  const installments = [];

  // Comenzar desde i=1 en lugar de i=2 para que todas las cuotas se creen correctamente
  for (let i = 1; i < totalInstallments; i++) {
    const dueDate = new Date(parentExpense.date);
    dueDate.setMonth(dueDate.getMonth() + i);

    installments.push({
      user_id: parentExpense.user_id,
      amount: installmentAmount,
      description: `${parentExpense.description} (Cuota ${i + 1}/${totalInstallments})`,
      category: parentExpense.category,
      payment_source: parentExpense.payment_source,
      friend_id: parentExpense.friend_id,
      date: dueDate.toISOString().split('T')[0],
      is_paid: false,
      installments: totalInstallments,
      current_installment: i + 1,
      parent_expense_id: parentExpense.id,
      currency: parentExpense.currency || 'ARS',
      currency_symbol: parentExpense.currency_symbol || '$',
      created_at: new Date().toISOString()
    });
  }

  // Actualizar el gasto padre con información de cuotas
  await supabase
    .from('expenses')
    .update({
      description: `${parentExpense.description} (Cuota 1/${totalInstallments})`,
      installments: totalInstallments,
      current_installment: 1
    })
    .eq('id', parentExpense.id);

  if (installments.length > 0) {
    const { error } = await supabase.from('expenses').insert(installments);
    if (error) {
      console.error('Error creando cuotas:', error);
      throw error;
    }
  }
};

/**
 * Obtener gastos de un usuario
 */
export const getExpenses = async (userId, filters = {}) => {
  try {
    let query = supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    // Aplicar filtros si existen
    if (filters.category && filters.category !== 'all') {
      query = query.eq('category', filters.category);
    }
    if (filters.month && filters.year) {
      const startDate = new Date(filters.year, filters.month - 1, 1);
      const endDate = new Date(filters.year, filters.month, 0);
      query = query.gte('date', startDate.toISOString().split('T')[0])
                   .lte('date', endDate.toISOString().split('T')[0]);
    }
    if (filters.isPaid !== undefined) {
      query = query.eq('is_paid', filters.isPaid);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error obteniendo gastos:', error);
      return { expenses: [], error };
    }
    
    return { expenses: data || [], error: null };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { expenses: [], error: null };
    console.error('Error en getExpenses:', error);
    return { expenses: [], error };
  }
};

/**
 * Obtener resumen mensual
 */
export const getMonthlyStats = async (userId, year, month) => {
  try {
    // Validar parámetros
    const validYear = parseInt(year) || new Date().getFullYear();
    const validMonth = parseInt(month) || (new Date().getMonth() + 1);
    
    const startDate = new Date(validYear, validMonth - 1, 1);
    const endDate = new Date(validYear, validMonth, 0);
    
    // Validar que las fechas sean válidas
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.warn('Fechas inválidas en getMonthlyStats:', { year: validYear, month: validMonth });
      return { stats: null, error: new Error('Fechas inválidas') };
    }

    const { data: expenses, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0]);

    if (error) throw error;

    // Obtener ingreso mensual de la tabla monthly_incomes
    let income = 0;
    try {
      const { data: incomeData } = await supabase
        .from('monthly_incomes')
        .select('amount')
        .eq('user_id', userId)
        .eq('year', year)
        .eq('month', month)
        .maybeSingle();
      
      income = incomeData?.amount || 0;
    } catch (e) {
      console.warn('Error obteniendo ingreso mensual:', e);
    }

    const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const paidExpenses = expenses.filter(exp => exp.is_paid);
    const pendingExpenses = expenses.filter(exp => !exp.is_paid);

    // Gastos por categoría
    const byCategory = expenses.reduce((acc, exp) => {
      acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
      return acc;
    }, {});

    // Gastos por fuente de pago
    const bySource = expenses.reduce((acc, exp) => {
      acc[exp.payment_source] = (acc[exp.payment_source] || 0) + exp.amount;
      return acc;
    }, {});

    return {
      stats: {
        totalSpent,
        totalPaid: paidExpenses.reduce((sum, exp) => sum + exp.amount, 0),
        totalPending: pendingExpenses.reduce((sum, exp) => sum + exp.amount, 0),
        pendingCount: pendingExpenses.length,
        income,
        balance: income - totalSpent,
        byCategory,
        bySource,
        expenseCount: expenses.length
      },
      error: null
    };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { stats: null, error: null };
    console.error('Error obteniendo estadísticas:', error);
    return { stats: null, error };
  }
};

/**
 * Marcar gasto como pagado
 */
export const markExpenseAsPaid = async (expenseId) => {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .update({ 
        is_paid: true,
        paid_at: new Date().toISOString()
      })
      .eq('id', expenseId)
      .select()
      .single();

    if (error) throw error;
    return { expense: data, error: null };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { expense: null, error: null };
    console.error('Error marcando como pagado:', error);
    return { expense: null, error };
  }
};

/**
 * Actualizar gasto - maneja amigos ficticios y reales
 * Si es amigo ficticio (virtual): cambio inmediato
 * Si es amigo real: crea solicitud de cambio
 */
export const updateExpense = async (expenseId, updates, friendType = 'virtual', friendId = null, userId = null) => {
  try {
    const { data: currentExpense, error: fetchError } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', expenseId)
      .single();

    if (fetchError) throw fetchError;

    // Si es amigo virtual o no hay amigo involucrado, hacer cambio directo
    if (friendType === 'virtual' || !friendId) {
      const { data, error } = await supabase
        .from('expenses')
        .update(updates)
        .eq('id', expenseId)
        .select()
        .single();

      if (error) throw error;

      return { expense: data, error: null, needsApproval: false };
    } else {
      // Es amigo real, crear change request
      const changeRequestsService = (await import('./changeRequestsService')).default;
      
      const result = await changeRequestsService.createExpenseChangeRequest(
        userId || currentExpense.user_id,
        friendId,
        expenseId,
        'update',
        updates,
        'Solicitud de modificación de gasto'
      );

      if (result.error) throw result.error;

      return { 
        expense: currentExpense, 
        error: null, 
        needsApproval: true,
        requestId: result.requestId 
      };
    }
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { expense: null, error: null, needsApproval: false };
    console.error('Error actualizando gasto:', error);
    return { expense: null, error, needsApproval: false };
  }
};

/**
 * Eliminar gasto - maneja amigos ficticios y reales
 * Si es amigo ficticio (virtual): eliminación inmediata
 * Si es amigo real: crea solicitud de cambio
 */
export const deleteExpense = async (expenseId, friendType = 'virtual', friendId = null, userId = null) => {
  try {
    const { data: currentExpense, error: fetchError } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', expenseId)
      .single();

    if (fetchError) throw fetchError;

    // Si es amigo virtual o no hay amigo involucrado, eliminar directamente
    if (friendType === 'virtual' || !friendId) {
      // Primero eliminar cuotas relacionadas
      await supabase
        .from('expenses')
        .delete()
        .eq('parent_expense_id', expenseId);

      // Luego eliminar el gasto principal
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId);

      if (error) throw error;
      return { error: null, needsApproval: false };
    } else {
      // Es amigo real, crear change request
      const changeRequestsService = (await import('./changeRequestsService')).default;
      
      const result = await changeRequestsService.createExpenseChangeRequest(
        userId || currentExpense.user_id,
        friendId,
        expenseId,
        'delete',
        null,
        'Solicitud de eliminación de gasto'
      );

      if (result.error) throw result.error;

      return { 
        error: null, 
        needsApproval: true,
        requestId: result.requestId 
      };
    }
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { error: null, needsApproval: false };
    console.error('Error eliminando gasto:', error);
    return { error, needsApproval: false };
  }
};

/**
 * Obtener cuotas activas
 */
export const getActiveInstallments = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .gt('installments', 1)
      .eq('is_paid', false)
      .order('date', { ascending: true });

    if (error) throw error;

    // Agrupar por gasto padre
    const grouped = data.reduce((acc, exp) => {
      const parentId = exp.parent_expense_id || exp.id;
      if (!acc[parentId]) {
        acc[parentId] = [];
      }
      acc[parentId].push(exp);
      return acc;
    }, {});

    return { installments: grouped, error: null };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { installments: {}, error: null };
    console.error('Error obteniendo cuotas:', error);
    return { installments: {}, error };
  }
};

/**
 * Obtener próximos pagos del mes
 */
export const getUpcomingPayments = async (userId) => {
  try {
    const today = new Date();
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .eq('is_paid', false)
      .gte('date', today.toISOString().split('T')[0])
      .lte('date', endOfMonth.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) throw error;

    const totalDue = data.reduce((sum, exp) => sum + exp.amount, 0);

    return { 
      payments: data, 
      totalDue,
      count: data.length,
      error: null 
    };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { payments: [], totalDue: 0, count: 0, error: null };
    console.error('Error obteniendo próximos pagos:', error);
    return { payments: [], totalDue: 0, count: 0, error };
  }
};

/**
 * Suscripción en tiempo real a gastos
 * DESHABILITADO para evitar loops - usar refreshExpenses manualmente
 */
export const subscribeExpenses = (userId, callback) => {
  // Retornar función vacía - no usar polling/realtime
  return () => {};
};

/**
 * Categorías disponibles
 */
export const EXPENSE_CATEGORIES = [
  { id: 'food', label: 'Alimentación', icon: '🍔' },
  { id: 'transport', label: 'Transporte', icon: '🚗' },
  { id: 'entertainment', label: 'Entretenimiento', icon: '🎬' },
  { id: 'health', label: 'Salud', icon: '🏥' },
  { id: 'education', label: 'Educación', icon: '📚' },
  { id: 'shopping', label: 'Compras', icon: '🛒' },
  { id: 'services', label: 'Servicios', icon: '💡' },
  { id: 'home', label: 'Hogar', icon: '🏠' },
  { id: 'personal', label: 'Personal', icon: '👤' },
  { id: 'debt', label: 'Deuda', icon: '💳' },
  { id: 'other', label: 'Otros', icon: '📦' }
];

/**
 * Fuentes de pago
 */
export const PAYMENT_SOURCES = [
  { id: 'bank', label: 'Banco', icon: '🏦' },
  { id: 'card', label: 'Tarjeta', icon: '💳' },
  { id: 'cash', label: 'Efectivo', icon: '💵' },
  { id: 'friend', label: 'Amigo', icon: '👥' }
];

export default {
  createExpense,
  getExpenses,
  getMonthlyStats,
  markExpenseAsPaid,
  updateExpense,
  deleteExpense,
  getActiveInstallments,
  getUpcomingPayments,
  subscribeExpenses,
  EXPENSE_CATEGORIES,
  PAYMENT_SOURCES
};
