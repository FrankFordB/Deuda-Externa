/**
 * Servicio para gestionar gastos recurrentes (gym, suscripciones, etc.)
 */
import { supabase } from './supabase';

const recurringExpensesService = {
  /**
   * Obtener todos los gastos recurrentes del usuario
   */
  async getUserRecurringExpenses(userId) {
    try {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error obteniendo gastos recurrentes:', error);
      return [];
    }
  },

  /**
   * Obtener gastos recurrentes activos
   */
  async getActiveRecurringExpenses(userId) {
    try {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('next_generation_date', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error obteniendo gastos recurrentes activos:', error);
      return [];
    }
  },

  /**
   * Crear un nuevo gasto recurrente
   */
  async createRecurringExpense(userId, recurringData) {
    try {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .insert({
          user_id: userId,
          name: recurringData.name,
          description: recurringData.description || null,
          amount: parseFloat(recurringData.amount),
          currency: recurringData.currency || 'ARS',
          currency_symbol: recurringData.currency_symbol || '$',
          category: recurringData.category || 'other',
          frequency: recurringData.frequency || 'monthly',
          day_of_month: recurringData.day_of_month || 1,
          start_date: recurringData.start_date || new Date().toISOString().split('T')[0],
          end_date: recurringData.end_date || null,
          bank_account_id: recurringData.bank_account_id || null,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error creando gasto recurrente:', error);
      throw error;
    }
  },

  /**
   * Actualizar un gasto recurrente
   */
  async updateRecurringExpense(recurringId, updates) {
    try {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', recurringId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error actualizando gasto recurrente:', error);
      throw error;
    }
  },

  /**
   * Activar/Desactivar un gasto recurrente
   */
  async toggleRecurringExpense(recurringId, isActive) {
    try {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', recurringId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error cambiando estado de gasto recurrente:', error);
      throw error;
    }
  },

  /**
   * Eliminar un gasto recurrente
   */
  async deleteRecurringExpense(recurringId) {
    try {
      const { error } = await supabase
        .from('recurring_expenses')
        .delete()
        .eq('id', recurringId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error eliminando gasto recurrente:', error);
      throw error;
    }
  },

  /**
   * Generar gastos desde recurrentes (ejecutar manualmente)
   */
  async generateRecurringExpenses(userId) {
    try {
      const { data, error } = await supabase
        .rpc('generate_recurring_expenses', { p_user_id: userId });

      if (error) throw error;

      return { 
        generated: Array.isArray(data) ? data.length : 0
      };
    } catch (error) {
      console.error('Error generando gastos recurrentes:', error);
      throw error;
    }
  },

  /**
   * Obtener gastos generados por un recurrente específico
   */
  async getGeneratedExpenses(recurringId) {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('recurring_expense_id', recurringId)
        .order('date', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error obteniendo gastos generados:', error);
      return [];
    }
  },

  /**
   * Obtener estadísticas de gastos recurrentes
   */
  async getRecurringStats(userId) {
    try {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('amount, currency, is_active, frequency')
        .eq('user_id', userId);

      if (error) throw error;

      const stats = {
        activeCount: data.filter(r => r.is_active).length,
        inactiveCount: data.filter(r => !r.is_active).length,
        totalMonthly: data
          .filter(r => r.is_active && r.frequency === 'monthly')
          .reduce((sum, r) => sum + parseFloat(r.amount), 0),
        totalYearly: data
          .filter(r => r.is_active)
          .reduce((sum, r) => {
            const amount = parseFloat(r.amount);
            switch(r.frequency) {
              case 'monthly': return sum + (amount * 12);
              case 'weekly': return sum + (amount * 52);
              case 'yearly': return sum + amount;
              default: return sum;
            }
          }, 0)
      };

      return stats;
    } catch (error) {
      console.error('Error obteniendo estadísticas de recurrentes:', error);
      return { activeCount: 0, inactiveCount: 0, totalMonthly: 0, totalYearly: 0 };
    }
  },

  /**
   * Calcular próxima fecha de generación
   */
  calculateNextDate(currentDate, frequency, dayOfMonth) {
    const date = new Date(currentDate);
    
    switch(frequency) {
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        date.setDate(Math.min(dayOfMonth, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
      default:
        date.setMonth(date.getMonth() + 1);
    }
    
    return date.toISOString().split('T')[0];
  }
};

export default recurringExpensesService;
