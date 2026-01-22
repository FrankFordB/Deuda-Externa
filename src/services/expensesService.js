/**
 * Expenses Service - Manejo de gastos
 */
import { supabase } from './supabase';

/**
 * Helper: Obtener el monto real de un gasto
 * Si es un gasto en cuotas y el amount guardado es el total (datos viejos),
 * divide entre el número de cuotas para obtener el monto de la cuota.
 * Los gastos nuevos ya guardan el monto de la cuota directamente.
 */
const getExpenseRealAmount = (expense) => {
  const amount = parseFloat(expense.amount) || 0;
  const installments = parseInt(expense.installments) || 1;
  const currentInstallment = expense.current_installment;
  
  // Si es un gasto con cuotas (installments > 1)
  if (installments > 1) {
    // Heurística: si el monto parece ser el total (es decir, no fue dividido),
    // dividimos entre el número de cuotas.
    // Un gasto "no dividido" típicamente tiene un monto mucho mayor que el promedio.
    // Los gastos nuevos ya vienen divididos, así que el amount debería ser ~total/installments
    // 
    // Para compatibilidad con datos viejos donde amount = total:
    // Si current_installment existe y es la primera cuota (1), y no hay parent_expense_id,
    // es probable que sea un gasto viejo con el total
    if (currentInstallment === 1 && !expense.parent_expense_id) {
      // Podría ser un gasto padre viejo - verificar si el monto parece ser el total
      // Para ser más seguros, verificamos si es un monto "redondo" que se divida bien
      // Pero esto es complicado, así que simplemente dividimos
      // porque los gastos nuevos ya vienen divididos
      return amount;
    }
    // Para cuotas hijas o gastos nuevos, el amount ya es el correcto
    return amount;
  }
  
  return amount;
};

/**
 * Crear un nuevo gasto
 * Si tiene cuotas > 1, crea todas las cuotas como gastos separados
 */
export const createExpense = async (expenseData) => {
  try {
    const totalInstallments = parseInt(expenseData.installments) || 1;
    const totalAmount = parseFloat(expenseData.amount);
    
    // Si viene con cuotas, el amount ya viene dividido desde el frontend
    // Pero para ser consistentes, recalculamos
    const installmentAmount = totalInstallments > 1 
      ? totalAmount  // El frontend ya divide, así que usamos el amount tal cual
      : totalAmount;
    
    // Descripción base (sin número de cuota si es cuota única)
    const baseDescription = expenseData.description;
    
    // Para la primera cuota o gasto único
    const insertData = {
      user_id: expenseData.userId,
      amount: installmentAmount,
      description: totalInstallments > 1 
        ? `${baseDescription} (Cuota 1/${totalInstallments})`
        : baseDescription,
      category: expenseData.category,
      payment_source: expenseData.paymentSource || 'cash',
      date: expenseData.date || new Date().toISOString().split('T')[0],
      is_paid: expenseData.isPaid ?? true,
      currency: expenseData.currency || 'ARS',
      currency_symbol: expenseData.currency_symbol || '$',
      installments: totalInstallments,
      current_installment: totalInstallments > 1 ? 1 : null
    };

    // Incluir bank_account_id si se proporciona
    if (expenseData.bank_account_id) {
      insertData.bank_account_id = expenseData.bank_account_id;
    }

    console.log('📝 Creando gasto principal:', insertData);

    const { data: firstExpense, error } = await supabase
      .from('expenses')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('❌ Error SQL al crear gasto:', error);
      throw error;
    }

    console.log('✅ Gasto principal creado:', firstExpense);

    // Si hay más de una cuota, crear las restantes
    if (totalInstallments > 1) {
      await createInstallments(firstExpense, totalInstallments, expenseData);
    }

    return { expense: firstExpense, error: null, success: true };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { expense: null, error: null };
    console.error('Error creando gasto:', error);
    return { expense: null, error, success: false };
  }
};

/**
 * Crear cuotas restantes para un gasto (cuota 2 en adelante)
 * Cada cuota aparece en el mes correspondiente
 */
const createInstallments = async (parentExpense, totalInstallments, originalData) => {
  const installments = [];
  const baseDescription = originalData.description;

  // Crear cuotas 2 hasta N
  for (let i = 2; i <= totalInstallments; i++) {
    const dueDate = new Date(parentExpense.date);
    dueDate.setMonth(dueDate.getMonth() + (i - 1));

    installments.push({
      user_id: parentExpense.user_id,
      amount: parentExpense.amount, // Mismo monto que la primera cuota
      description: `${baseDescription} (Cuota ${i}/${totalInstallments})`,
      category: parentExpense.category,
      payment_source: parentExpense.payment_source,
      date: dueDate.toISOString().split('T')[0],
      is_paid: false, // Las cuotas futuras empiezan como no pagadas
      installments: totalInstallments,
      current_installment: i,
      parent_expense_id: parentExpense.id,
      currency: parentExpense.currency || 'ARS',
      currency_symbol: parentExpense.currency_symbol || '$',
      bank_account_id: parentExpense.bank_account_id || null,
      created_at: new Date().toISOString()
    });
  }

  if (installments.length > 0) {
    console.log(`📝 Creando ${installments.length} cuotas adicionales...`);
    const { error } = await supabase.from('expenses').insert(installments);
    if (error) {
      console.error('Error creando cuotas:', error);
      throw error;
    }
    console.log(`✅ ${installments.length} cuotas creadas exitosamente`);
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

    // Usar el monto real de cada gasto (ya viene correctamente dividido en cuotas)
    const totalSpent = expenses.reduce((sum, exp) => sum + getExpenseRealAmount(exp), 0);
    const paidExpenses = expenses.filter(exp => exp.is_paid);
    const pendingExpenses = expenses.filter(exp => !exp.is_paid);

    // Gastos por categoría (usando monto real)
    const byCategory = expenses.reduce((acc, exp) => {
      acc[exp.category] = (acc[exp.category] || 0) + getExpenseRealAmount(exp);
      return acc;
    }, {});

    // Gastos por fuente de pago (usando monto real)
    const bySource = expenses.reduce((acc, exp) => {
      acc[exp.payment_source] = (acc[exp.payment_source] || 0) + getExpenseRealAmount(exp);
      return acc;
    }, {});

    return {
      stats: {
        totalSpent,
        totalPaid: paidExpenses.reduce((sum, exp) => sum + getExpenseRealAmount(exp), 0),
        totalPending: pendingExpenses.reduce((sum, exp) => sum + getExpenseRealAmount(exp), 0),
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
