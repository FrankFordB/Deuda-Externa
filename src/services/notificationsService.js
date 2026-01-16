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
    console.error('Error contando notificaciones:', error);
    return { count: 0, error };
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
 */
export const createPaymentConfirmation = async (debtId, requesterId, confirmerId) => {
  try {
    // Crear la solicitud
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

    if (error) throw error;

    // Obtener datos de la deuda y el solicitante
    const { data: debt } = await supabase
      .from('debts')
      .select('description, amount')
      .eq('id', debtId)
      .single();

    const { data: requester } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', requesterId)
      .single();

    // Crear notificación para el confirmador
    await createNotification({
      userId: confirmerId,
      type: 'payment_confirmation',
      title: '¿Confirmás el pago?',
      message: `${requester?.full_name || 'Alguien'} dice que pagó la deuda "${debt?.description}" por $${debt?.amount}. ¿Es correcto?`,
      data: { 
        confirmation_id: confirmation.id,
        debt_id: debtId,
        requester_id: requesterId,
        amount: debt?.amount
      },
      actionRequired: true,
      actionType: 'confirm_payment'
    });

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
