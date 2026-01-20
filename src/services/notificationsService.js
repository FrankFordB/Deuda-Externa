/**
 * Notifications Service - Sistema de notificaciones en tiempo real
 */
import { supabase } from './supabase';

// Sonido de notificación
const NOTIFICATION_SOUND = '/notification.mp3';

/**
 * Reproducir sonido de notificación
 */
export const playNotificationSound = () => {
  try {
    const audio = new Audio(NOTIFICATION_SOUND);
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Ignorar error si el navegador bloquea el sonido
    });
  } catch (e) {
    console.warn('No se pudo reproducir sonido');
  }
};

/**
 * Obtener notificaciones del usuario
 */
export const getNotifications = async (userId, onlyUnread = false) => {
  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (onlyUnread) {
      query = query.eq('read', false);
    }

    const { data, error } = await query;
    if (error) throw error;
    return { notifications: data || [], error: null };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { notifications: [], error: null };
    console.error('Error obteniendo notificaciones:', error);
    return { notifications: [], error };
  }
};

/**
 * Obtener cantidad de notificaciones no leídas
 */
export const getUnreadCount = async (userId) => {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) throw error;
    return { count: count || 0, error: null };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { count: 0, error: null };
    console.error('Error contando notificaciones:', error);
    return { count: 0, error };
  }
};

/**
 * Obtener contadores de notificaciones para "Yo Debo"
 */
export const getDebtorNotificationsCount = async (userId) => {
  try {
    const { data, error } = await supabase
      .rpc('get_debtor_notifications_count', { p_user_id: userId });

    if (error) throw error;
    return { 
      counts: data?.[0] || { unread_count: 0, pending_accept_count: 0, payment_marked_count: 0 }, 
      error: null 
    };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) {
      return { counts: { unread_count: 0, pending_accept_count: 0, payment_marked_count: 0 }, error: null };
    }
    console.error('Error obteniendo contadores de deudor:', error);
    return { counts: { unread_count: 0, pending_accept_count: 0, payment_marked_count: 0 }, error };
  }
};

/**
 * Obtener contadores de notificaciones para "Me Deben"
 */
export const getCreditorNotificationsCount = async (userId) => {
  try {
    const { data, error } = await supabase
      .rpc('get_creditor_notifications_count', { p_user_id: userId });

    if (error) throw error;
    return { 
      counts: data?.[0] || { unread_count: 0, payment_confirmation_count: 0, collection_due_count: 0 }, 
      error: null 
    };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) {
      return { counts: { unread_count: 0, payment_confirmation_count: 0, collection_due_count: 0 }, error: null };
    }
    console.error('Error obteniendo contadores de acreedor:', error);
    return { counts: { unread_count: 0, payment_confirmation_count: 0, collection_due_count: 0 }, error };
  }
};

/**
 * Obtener todos los contadores de notificaciones de deudas
 */
export const getAllDebtNotificationsCount = async (userId) => {
  try {
    const { data, error } = await supabase
      .rpc('get_all_debt_notifications_count', { p_user_id: userId });

    if (error) throw error;
    return { 
      counts: data?.[0] || { total_unread: 0, debtor_unread: 0, creditor_unread: 0, pending_actions: 0 }, 
      error: null 
    };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) {
      return { counts: { total_unread: 0, debtor_unread: 0, creditor_unread: 0, pending_actions: 0 }, error: null };
    }
    console.error('Error obteniendo contadores generales:', error);
    return { counts: { total_unread: 0, debtor_unread: 0, creditor_unread: 0, pending_actions: 0 }, error };
  }
};

/**
 * Crear notificación
 */
export const createNotification = async ({
  userId,
  type,
  title,
  message,
  data = null,
  actionRequired = false,
  actionType = null
}) => {
  try {
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        data,
        action_required: actionRequired,
        action_type: actionType
      })
      .select()
      .single();

    if (error) throw error;
    return { notification, error: null };
  } catch (error) {
    console.error('Error creando notificación:', error);
    return { notification: null, error };
  }
};

/**
 * Marcar notificación como leída
 */
export const markAsRead = async (notificationId) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error marcando como leída:', error);
    return { error };
  }
};

/**
 * Marcar todas las notificaciones como leídas
 */
export const markAllAsRead = async (userId) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error marcando todas como leídas:', error);
    return { error };
  }
};

/**
 * Eliminar notificación
 */
export const deleteNotification = async (notificationId) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error eliminando notificación:', error);
    return { error };
  }
};

/**
 * Suscribirse a notificaciones en tiempo real
 * DESHABILITADO para evitar loops
 */
export const subscribeToNotifications = (userId, onNotification) => {
  return () => {};
};

// ========== PAYMENT CONFIRMATIONS ==========

/**
 * Crear solicitud de confirmación de pago
 * VERSIÓN CON TRIGGER - La notificación se crea automáticamente en la base de datos
 */
export const createPaymentConfirmation = async (debtId, requesterId, confirmerId, debtData = {}) => {
  try {
    // Solo crear la confirmación - el trigger se encarga de la notificación
    const { data: confirmation, error } = await supabase
      .from('payment_confirmations')
      .insert({
        debt_id: debtId,
        requester_id: requesterId,
        confirmer_id: confirmerId,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Error al insertar payment_confirmation:', error);
      throw error;
    }

    console.log('✅ Confirmación de pago creada, trigger creará la notificación automáticamente');
    return { confirmation, error: null };
  } catch (error) {
    console.error('Error creando confirmación de pago:', error);
    return { confirmation: null, error };
  }
};

/**
 * Responder a solicitud de confirmación de pago
 */
export const respondPaymentConfirmation = async (confirmationId, confirmed, responderId) => {
  try {
    const status = confirmed ? 'confirmed' : 'rejected';
    
    // Actualizar confirmación
    const { data: confirmation, error } = await supabase
      .from('payment_confirmations')
      .update({ 
        status,
        responded_at: new Date().toISOString()
      })
      .eq('id', confirmationId)
      .select('*, debt:debts(*)')
      .single();

    if (error) throw error;

    // Si fue confirmado, marcar deuda como pagada
    if (confirmed) {
      await supabase
        .from('debts')
        .update({ status: 'paid' })
        .eq('id', confirmation.debt_id);
    }

    // Obtener datos del respondedor
    const { data: responder } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', responderId)
      .single();

    // Notificar al solicitante
    await createNotification({
      userId: confirmation.requester_id,
      type: 'payment_response',
      title: confirmed ? '¡Pago confirmado!' : 'Pago rechazado',
      message: confirmed 
        ? `${responder?.full_name || 'Tu amigo'} confirmó que pagaste la deuda "${confirmation.debt?.description}".`
        : `${responder?.full_name || 'Tu amigo'} no confirmó el pago de "${confirmation.debt?.description}". Por favor, verifica.`,
      data: { 
        confirmation_id: confirmationId,
        debt_id: confirmation.debt_id,
        confirmed 
      }
    });

    return { confirmation, error: null };
  } catch (error) {
    console.error('Error respondiendo confirmación:', error);
    return { confirmation: null, error };
  }
};

/**
 * Obtener confirmaciones pendientes
 */
export const getPendingConfirmations = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('payment_confirmations')
      .select('*, debt:debts(*), requester:profiles!requester_id(*)')
      .eq('confirmer_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { confirmations: data || [], error: null };
  } catch (error) {
    console.error('Error obteniendo confirmaciones:', error);
    return { confirmations: [], error };
  }
};

export default {
  getNotifications,
  getUnreadCount,
  getDebtorNotificationsCount,
  getCreditorNotificationsCount,
  createNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  subscribeToNotifications,
  playNotificationSound,
  createPaymentConfirmation,
  respondPaymentConfirmation,
  getPendingConfirmations
};
