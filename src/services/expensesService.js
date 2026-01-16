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
      is_paid: expenseData.isPaid ?? true
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
    console.error('Error creando gasto:', error);
    return { expense: null, error };
  }
};

/**
 * Crear cuotas para un gasto
 */
const createInstallments = async (parentExpense, totalInstallments) => {
  const installmentAmount = parentExpense.amount;
  const installments = [];

  for (let i = 2; i <= totalInstallments; i++) {
    const dueDate = new Date(parentExpense.date);
    dueDate.setMonth(dueDate.getMonth() + (i - 1));

    installments.push({
      user_id: parentExpense.user_id,
      amount: installmentAmount,
      description: `${parentExpense.description} (Cuota ${i}/${totalInstallments})`,
      category: parentExpense.category,
      payment_source: parentExpense.payment_source,
      friend_id: parentExpense.friend_id,
      date: dueDate.toISOString().split('T')[0],
      is_paid: false,
      installments: totalInstallments,
      current_installment: i,
      parent_expense_id: parentExpense.id,
      created_at: new Date().toISOString()
    });
  }

  // Actualizar el gasto padre con la descripción de cuota
  await supabase
    .from('expenses')
    .update({
      description: `${parentExpense.description} (Cuota 1/${totalInstallments})`
    })
    .eq('id', parentExpense.id);

  if (installments.length > 0) {
    await supabase.from('expenses').insert(installments);
  }
};

/**
 * Obtener gastos de un usuario
 */
export const getExpenses = async (userId, filters = {}) => {
  try {
    console.log('🔍 Buscando gastos para:', userId, 'Filtros:', filters);
    
    // Prueba simple primero
    console.log('🧪 Probando conexión a Supabase...');
    const testStart = Date.now();
    
    const { data, error } = await supabase
      .from('expenses')
      .select('id, description, amount, date')
      .eq('user_id', userId)
      .limit(10);
    
    console.log('⏱️ Query tomó:', Date.now() - testStart, 'ms');
    console.log('📡 Respuesta:', { data, error });

    if (error) {
      console.error('❌ Error obteniendo gastos:', error);
      // Si hay error, devolver array vacío en lugar de fallar
      return { expenses: [], error };
    }
    
    console.log('📊 Gastos encontrados:', data?.length || 0);
    return { expenses: data || [], error: null };
  } catch (error) {
    console.error('💥 Error en getExpenses:', error);
    return { expenses: [], error };
  }
};

/**
 * Obtener resumen mensual
 */
export const getMonthlyStats = async (userId, year, month) => {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const { data: expenses, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0]);

    if (error) throw error;

    // Obtener ingreso mensual del perfil (si existe la columna)
    let income = 0;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('monthly_income')
        .eq('id', userId)
        .maybeSingle();
      income = profile?.monthly_income || 0;
    } catch (e) {
      // Columna puede no existir, ignorar
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
    console.error('Error marcando como pagado:', error);
    return { expense: null, error };
  }
};

/**
 * Actualizar gasto
 */
export const updateExpense = async (expenseId, updates) => {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .update(updates)
      .eq('id', expenseId)
      .select()
      .single();

    if (error) throw error;
    return { expense: data, error: null };
  } catch (error) {
    console.error('Error actualizando gasto:', error);
    return { expense: null, error };
  }
};

/**
 * Eliminar gasto
 */
export const deleteExpense = async (expenseId) => {
  try {
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
    return { error: null };
  } catch (error) {
    console.error('Error eliminando gasto:', error);
    return { error };
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
