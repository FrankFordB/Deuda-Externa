/**
 * Reminders Service - Servicio de recordatorios de pago
 */
import { supabase } from './supabase';

/**
 * Verificar y generar recordatorios pendientes
 * Esta función debería llamarse periódicamente (ej: al cargar el dashboard)
 */
export const checkAndGenerateReminders = async (userId) => {
  try {
    // Llamar a la función de PostgreSQL que genera recordatorios
    const { error } = await supabase.rpc('generate_payment_reminders');
    
    if (error) {
      // Ignorar AbortError
      if (error.name !== 'AbortError' && !error.message?.includes('AbortError')) {
        console.warn('Error generando recordatorios automáticos:', error);
      }
      // No es crítico, continuar
    }

    return { success: true };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { success: false, error: null };
    console.error('Error en checkAndGenerateReminders:', error);
    return { success: false, error };
  }
};

/**
 * Obtener recordatorios pendientes del usuario
 */
export const getPendingReminders = async (userId) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const twoDays = new Date(Date.now() + 172800000).toISOString().split('T')[0];

    // Obtener notificaciones de tipo recordatorio
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .in('type', ['payment_due', 'payment_reminder', 'collection_due', 'expense_due', 'installment_due'])
      .eq('read', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { reminders: data || [], error: null };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { reminders: [], error: null };
    console.error('Error obteniendo recordatorios:', error);
    return { reminders: [], error };
  }
};

/**
 * Crear recordatorio manual
 */
export const createReminder = async (userId, reminderData) => {
  try {
    const { data, error } = await supabase
      .from('payment_reminders')
      .insert({
        user_id: userId,
        reminder_type: reminderData.type,
        reference_id: reminderData.referenceId,
        reminder_date: reminderData.reminderDate,
        days_before: reminderData.daysBefore || 1,
        message: reminderData.message
      })
      .select()
      .single();

    if (error) throw error;
    return { reminder: data, error: null };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { reminder: null, error: null };
    console.error('Error creando recordatorio:', error);
    return { reminder: null, error };
  }
};

/**
 * Obtener próximos vencimientos (deudas, gastos, cuotas)
 */
export const getUpcomingDueDates = async (userId) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    // Deudas que debo pagar
    const { data: debtsIOwe, error: debtsError } = await supabase
      .from('debts')
      .select(`
        id,
        amount,
        description,
        due_date,
        status,
        creditor:creditor_id (
          id,
          first_name,
          last_name,
          nickname
        )
      `)
      .eq('debtor_id', userId)
      .eq('status', 'accepted')
      .gte('due_date', today)
      .lte('due_date', nextWeek)
      .order('due_date', { ascending: true });

    if (debtsError) throw debtsError;

    // Deudas que me deben (para cobrar)
    const { data: debtsOwedToMe, error: owedError } = await supabase
      .from('debts')
      .select(`
        id,
        amount,
        description,
        due_date,
        status,
        debtor_type,
        debtor:debtor_id (
          id,
          first_name,
          last_name,
          nickname
        ),
        virtual_friend:virtual_friend_id (
          id,
          name
        )
      `)
      .eq('creditor_id', userId)
      .eq('status', 'accepted')
      .gte('due_date', today)
      .lte('due_date', nextWeek)
      .order('due_date', { ascending: true });

    if (owedError) throw owedError;

    // Gastos pendientes
    const { data: expenses, error: expError } = await supabase
      .from('expenses')
      .select('id, amount, description, due_date, category')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .gte('due_date', today)
      .lte('due_date', nextWeek)
      .order('due_date', { ascending: true });

    if (expError) throw expError;

    // Cuotas pendientes
    const { data: installments, error: instError } = await supabase
      .from('installments')
      .select(`
        id,
        installment_number,
        amount,
        due_date,
        expense:expense_id (
          id,
          description,
          user_id
        )
      `)
      .eq('paid', false)
      .gte('due_date', today)
      .lte('due_date', nextWeek)
      .order('due_date', { ascending: true });

    // Filtrar cuotas del usuario
    const userInstallments = (installments || []).filter(i => i.expense?.user_id === userId);

    return {
      debtsIOwe: debtsIOwe || [],
      debtsOwedToMe: debtsOwedToMe || [],
      expenses: expenses || [],
      installments: userInstallments,
      error: null
    };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { debtsIOwe: [], debtsOwedToMe: [], expenses: [], installments: [], error: null };
    console.error('Error obteniendo próximos vencimientos:', error);
    return { debtsIOwe: [], debtsOwedToMe: [], expenses: [], installments: [], error };
  }
};

/**
 * Crear notificación de recordatorio manual
 */
export const sendReminderNotification = async (userId, data) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.metadata || {}
      });

    if (error) throw error;
    return { success: true, error: null };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { success: false, error: null };
    console.error('Error enviando notificación:', error);
    return { success: false, error };
  }
};

export default {
  checkAndGenerateReminders,
  getPendingReminders,
  createReminder,
  getUpcomingDueDates,
  sendReminderNotification
};
