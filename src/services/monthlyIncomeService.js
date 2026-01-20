/**
 * Monthly Income Service - Manejo de sueldos mensuales
 */
import { supabase } from './supabase';

/**
 * Obtener sueldo de un mes específico
 */
export const getMonthlyIncome = async (userId, year, month) => {
  try {
    const { data, error } = await supabase
      .from('monthly_incomes')
      .select('*')
      .eq('user_id', userId)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle();

    if (error) throw error;
    return { income: data, error: null };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { income: null, error: null };
    console.error('Error obteniendo sueldo mensual:', error);
    return { income: null, error };
  }
};

/**
 * Guardar o actualizar sueldo de un mes específico
 */
export const setMonthlyIncome = async (userId, year, month, amount, notes = '') => {
  try {
    const { data, error } = await supabase
      .from('monthly_incomes')
      .upsert({
        user_id: userId,
        year,
        month,
        amount: parseFloat(amount),
        notes
      }, {
        onConflict: 'user_id,year,month'
      })
      .select()
      .single();

    if (error) {
      // Si el error es de foreign key, significa que el perfil no existe
      if (error.code === '23503') {
        console.error('❌ Perfil no encontrado. El usuario necesita crear su perfil primero.');
        return { 
          income: null, 
          error: 'Tu perfil no está completo. Por favor, cierra sesión y vuelve a iniciar sesión.' 
        };
      }
      throw error;
    }
    return { income: data, error: null };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { income: null, error: null };
    console.error('Error guardando sueldo mensual:', error);
    return { income: null, error };
  }
};

/**
 * Obtener todos los sueldos de un año
 */
export const getYearlyIncomes = async (userId, year) => {
  try {
    const { data, error } = await supabase
      .from('monthly_incomes')
      .select('*')
      .eq('user_id', userId)
      .eq('year', year)
      .order('month', { ascending: true });

    if (error) throw error;
    return { incomes: data || [], error: null };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { incomes: [], error: null };
    console.error('Error obteniendo sueldos anuales:', error);
    return { incomes: [], error };
  }
};

/**
 * Eliminar sueldo de un mes
 */
export const deleteMonthlyIncome = async (userId, year, month) => {
  try {
    const { error } = await supabase
      .from('monthly_incomes')
      .delete()
      .eq('user_id', userId)
      .eq('year', year)
      .eq('month', month);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { error: null };
    console.error('Error eliminando sueldo mensual:', error);
    return { error };
  }
};

/**
 * Obtener todos los sueldos del usuario (todos los meses/años)
 */
export const getAllIncomes = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('monthly_incomes')
      .select('*')
      .eq('user_id', userId)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (error) throw error;
    return { incomes: data || [], error: null };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { incomes: [], error: null };
    console.error('Error obteniendo todos los sueldos:', error);
    return { incomes: [], error };
  }
};

export default {
  getMonthlyIncome,
  setMonthlyIncome,
  getYearlyIncomes,
  deleteMonthlyIncome,
  getAllIncomes
};
