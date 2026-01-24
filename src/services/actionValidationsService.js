import { supabase } from './supabase';

/**
 * Solicitar eliminación de un gasto compartido
 * Requiere aprobación de todos los participantes
 */
export const requestExpenseDeletion = async (expenseId, userId, reason = null) => {
  try {
    const { data, error } = await supabase.rpc('request_expense_deletion', {
      p_expense_id: expenseId,
      p_user_id: userId,
      p_reason: reason
    });

    if (error) throw error;
    
    return { success: true, data };
  } catch (error) {
    console.error('Error requesting expense deletion:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Aprobar una solicitud de acción (eliminar/modificar)
 */
export const approveActionRequest = async (actionId, userId) => {
  try {
    const { data, error } = await supabase.rpc('approve_action_request', {
      p_action_id: actionId,
      p_user_id: userId
    });

    if (error) throw error;
    
    // Crear notificación para el solicitante si la acción fue aprobada completamente
    if (data?.action_approved && data?.action_executed) {
      // La acción fue ejecutada
      return { success: true, data, executed: true };
    }
    
    return { success: true, data, executed: false };
  } catch (error) {
    console.error('Error approving action request:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Rechazar una solicitud de acción
 */
export const rejectActionRequest = async (actionId, userId, reason = null) => {
  try {
    const { data, error } = await supabase.rpc('reject_action_request', {
      p_action_id: actionId,
      p_user_id: userId,
      p_reason: reason
    });

    if (error) throw error;
    
    return { success: true, data };
  } catch (error) {
    console.error('Error rejecting action request:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Cancelar mi solicitud de acción
 */
export const cancelActionRequest = async (actionId, userId) => {
  try {
    const { data, error } = await supabase.rpc('cancel_action_request', {
      p_action_id: actionId,
      p_user_id: userId
    });

    if (error) throw error;
    
    return { success: true, data };
  } catch (error) {
    console.error('Error cancelling action request:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Obtener solicitudes de acción pendientes para mí (para aprobar/rechazar)
 */
export const getPendingActionRequests = async (userId) => {
  try {
    const { data, error } = await supabase.rpc('get_pending_action_requests', {
      p_user_id: userId
    });

    if (error) throw error;
    
    return { success: true, requests: data || [] };
  } catch (error) {
    console.error('Error getting pending action requests:', error);
    return { success: false, error: error.message, requests: [] };
  }
};

/**
 * Obtener mis solicitudes enviadas (para ver el estado)
 */
export const getMyActionRequests = async (userId) => {
  try {
    const { data, error } = await supabase.rpc('get_my_action_requests', {
      p_user_id: userId
    });

    if (error) throw error;
    
    return { success: true, requests: data || [] };
  } catch (error) {
    console.error('Error getting my action requests:', error);
    return { success: false, error: error.message, requests: [] };
  }
};

/**
 * Verificar si un gasto tiene una solicitud pendiente
 */
export const hasPendingRequest = async (expenseId) => {
  try {
    const { data, error } = await supabase
      .from('action_validations')
      .select('id, action_type, status')
      .eq('expense_id', expenseId)
      .eq('status', 'pending')
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
    
    return { 
      success: true, 
      hasPending: !!data,
      pendingRequest: data
    };
  } catch (error) {
    console.error('Error checking pending request:', error);
    return { success: false, error: error.message, hasPending: false };
  }
};

/**
 * Contar solicitudes pendientes para notificaciones
 */
export const countPendingActionRequests = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('action_validation_responses')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('status', 'pending');

    if (error) throw error;
    
    return { success: true, count: data?.length || 0 };
  } catch (error) {
    console.error('Error counting pending requests:', error);
    return { success: false, error: error.message, count: 0 };
  }
};

export default {
  requestExpenseDeletion,
  approveActionRequest,
  rejectActionRequest,
  cancelActionRequest,
  getPendingActionRequests,
  getMyActionRequests,
  hasPendingRequest,
  countPendingActionRequests
};
