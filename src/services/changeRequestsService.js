/**
 * Change Requests Service
 * Maneja solicitudes de cambios que requieren aprobación entre usuarios
 */
import { supabase } from './supabase';

const changeRequestsService = {
  /**
   * Obtener solicitudes de cambio pendientes del usuario actual (como aprobador)
   */
  async getPendingRequests(userId) {
    try {
      const { data, error } = await supabase
        .from('pending_change_requests_detailed')
        .select('*')
        .eq('approver_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { requests: data };
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      return { error, requests: [] };
    }
  },

  /**
   * Obtener solicitudes de cambio enviadas por el usuario actual
   */
  async getSentRequests(userId) {
    try {
      const { data, error } = await supabase
        .from('change_requests')
        .select(`
          *,
          requester:requester_id(id, first_name, last_name, nickname),
          approver:approver_id(id, first_name, last_name, nickname)
        `)
        .eq('requester_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { requests: data };
    } catch (error) {
      console.error('Error fetching sent requests:', error);
      return { error, requests: [] };
    }
  },

  /**
   * Crear solicitud de cambio para una deuda
   */
  async createDebtChangeRequest(requesterId, approverId, entityId, actionType, changeData, reason = null) {
    try {
      const { data, error } = await supabase.rpc('create_change_request', {
        p_requester_id: requesterId,
        p_approver_id: approverId,
        p_entity_type: 'debt',
        p_entity_id: entityId,
        p_action_type: actionType,
        p_change_data: changeData,
        p_reason: reason
      });

      if (error) throw error;

      return { success: true, requestId: data };
    } catch (error) {
      console.error('Error creating debt change request:', error);
      return { error, success: false };
    }
  },

  /**
   * Crear solicitud de cambio para un gasto
   */
  async createExpenseChangeRequest(requesterId, approverId, entityId, actionType, changeData, reason = null) {
    try {
      const { data, error } = await supabase.rpc('create_change_request', {
        p_requester_id: requesterId,
        p_approver_id: approverId,
        p_entity_type: 'expense',
        p_entity_id: entityId,
        p_action_type: actionType,
        p_change_data: changeData,
        p_reason: reason
      });

      if (error) throw error;

      return { success: true, requestId: data };
    } catch (error) {
      console.error('Error creating expense change request:', error);
      return { error, success: false };
    }
  },

  /**
   * Aprobar una solicitud de cambio
   */
  async approveRequest(requestId, responseMessage = null) {
    try {
      const { error } = await supabase
        .from('change_requests')
        .update({
          status: 'approved',
          response_message: responseMessage,
          responded_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error approving request:', error);
      return { error, success: false };
    }
  },

  /**
   * Rechazar una solicitud de cambio
   */
  async rejectRequest(requestId, responseMessage = null) {
    try {
      const { error } = await supabase
        .from('change_requests')
        .update({
          status: 'rejected',
          response_message: responseMessage,
          responded_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error rejecting request:', error);
      return { error, success: false };
    }
  },

  /**
   * Obtener historial de solicitudes para una entidad específica
   */
  async getEntityHistory(entityType, entityId) {
    try {
      const { data, error } = await supabase
        .from('change_requests')
        .select(`
          *,
          requester:requester_id(id, first_name, last_name, nickname),
          approver:approver_id(id, first_name, last_name, nickname)
        `)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { history: data };
    } catch (error) {
      console.error('Error fetching entity history:', error);
      return { error, history: [] };
    }
  },

  /**
   * Suscribirse a cambios en solicitudes pendientes
   */
  subscribeToRequests(userId, callback) {
    const channel = supabase
      .channel(`change_requests_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'change_requests',
          filter: `approver_id=eq.${userId}`
        },
        (payload) => {
          console.log('Change request update:', payload);
          callback();
        }
      )
      .subscribe();

    return channel;
  },

  /**
   * Helper: Determinar si una deuda/gasto requiere aprobación
   * (si está compartida con otro usuario real)
   */
  requiresApproval(entity, currentUserId) {
    if (!entity) return false;
    
    // Para deudas
    if (entity.creditor_id && entity.debtor_id) {
      // Solo requiere aprobación si es con un amigo real (no virtual)
      if (entity.debtor_type === 'virtual') return false;
      
      // Requiere aprobación si involucra a otro usuario
      return entity.creditor_id !== currentUserId || entity.debtor_id !== currentUserId;
    }
    
    // Para gastos compartidos (si tienen shared_with en el futuro)
    if (entity.shared_with && Array.isArray(entity.shared_with)) {
      return entity.shared_with.length > 0;
    }
    
    return false;
  }
};

export default changeRequestsService;
