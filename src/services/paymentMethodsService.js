/**
 * Payment Methods Service - Gestión de métodos de pago
 */
import { supabase } from './supabase';

/**
 * Obtener métodos de pago del usuario
 */
export const getPaymentMethods = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;
    return { methods: data || [], error: null };
  } catch (error) {
    console.error('Error obteniendo métodos de pago:', error);
    return { methods: [], error };
  }
};

/**
 * Crear nuevo método de pago
 */
export const createPaymentMethod = async (userId, methodData) => {
  try {
    const { data, error } = await supabase
      .from('payment_methods')
      .insert({
        user_id: userId,
        name: methodData.name,
        type: methodData.type || 'other',
        icon: methodData.icon || '💳',
        color: methodData.color || '#6366f1',
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    return { method: data, error: null };
  } catch (error) {
    console.error('Error creando método de pago:', error);
    return { method: null, error };
  }
};

/**
 * Actualizar método de pago
 */
export const updatePaymentMethod = async (methodId, updates) => {
  try {
    const { data, error } = await supabase
      .from('payment_methods')
      .update(updates)
      .eq('id', methodId)
      .select()
      .single();

    if (error) throw error;
    return { method: data, error: null };
  } catch (error) {
    console.error('Error actualizando método de pago:', error);
    return { method: null, error };
  }
};

/**
 * Desactivar método de pago
 */
export const deactivatePaymentMethod = async (methodId) => {
  try {
    const { data, error } = await supabase
      .from('payment_methods')
      .update({ is_active: false })
      .eq('id', methodId)
      .select()
      .single();

    if (error) throw error;
    return { method: data, error: null };
  } catch (error) {
    console.error('Error desactivando método de pago:', error);
    return { method: null, error };
  }
};

/**
 * Eliminar método de pago
 */
export const deletePaymentMethod = async (methodId) => {
  try {
    const { error } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', methodId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error eliminando método de pago:', error);
    return { error };
  }
};

// Tipos de métodos predefinidos
export const PAYMENT_METHOD_TYPES = {
  bank: { label: 'Banco', icon: '🏦' },
  cash: { label: 'Efectivo', icon: '💵' },
  card: { label: 'Tarjeta', icon: '💳' },
  digital_wallet: { label: 'Billetera Digital', icon: '📱' },
  other: { label: 'Otro', icon: '💰' }
};

export default {
  getPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deactivatePaymentMethod,
  deletePaymentMethod,
  PAYMENT_METHOD_TYPES
};
