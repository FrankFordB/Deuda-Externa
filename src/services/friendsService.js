/**
 * Friends Service - Manejo de sistema de amigos
 */
import { supabase } from './supabase';

/**
 * Buscar usuario por nickname
 */
export const searchUserByNickname = async (nickname) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, nickname, first_name, last_name, country, avatar_url')
      .ilike('nickname', `%${nickname}%`)
      .limit(10);

    if (error) throw error;
    return { users: data, error: null };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { users: [], error: null };
    console.error('Error buscando usuario:', error);
    return { users: [], error };
  }
};

/**
 * Enviar solicitud de amistad
 */
export const sendFriendRequest = async (senderId, receiverNickname) => {
  try {
    // Buscar el ID del receptor por nickname
    const { data: receiver, error: searchError } = await supabase
      .from('profiles')
      .select('id')
      .eq('nickname', receiverNickname)
      .maybeSingle();

    if (searchError || !receiver) {
      throw new Error('Usuario no encontrado');
    }

    if (receiver.id === senderId) {
      throw new Error('No puedes agregarte a ti mismo');
    }

    // Verificar si ya existe una relación
    const { data: existing } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(user_id.eq.${senderId},friend_id.eq.${receiver.id}),and(user_id.eq.${receiver.id},friend_id.eq.${senderId})`)
      .maybeSingle();

    if (existing) {
      throw new Error('Ya existe una solicitud de amistad o ya son amigos');
    }

    // Crear solicitud de amistad
    const { data, error } = await supabase
      .from('friendships')
      .insert({
        user_id: senderId,
        friend_id: receiver.id,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return { friendship: data, error: null };
  } catch (error) {
    console.error('Error enviando solicitud:', error);
    return { friendship: null, error };
  }
};

/**
 * Aceptar solicitud de amistad
 */
export const acceptFriendRequest = async (friendshipId) => {
  try {
    const { data, error } = await supabase
      .from('friendships')
      .update({ 
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', friendshipId)
      .select()
      .single();

    if (error) throw error;
    return { friendship: data, error: null };
  } catch (error) {
    console.error('Error aceptando solicitud:', error);
    return { friendship: null, error };
  }
};

/**
 * Rechazar solicitud de amistad
 */
export const rejectFriendRequest = async (friendshipId) => {
  try {
    const { data, error } = await supabase
      .from('friendships')
      .update({ status: 'rejected' })
      .eq('id', friendshipId)
      .select()
      .single();

    if (error) throw error;
    return { friendship: data, error: null };
  } catch (error) {
    console.error('Error rechazando solicitud:', error);
    return { friendship: null, error };
  }
};

/**
 * Obtener lista de amigos aceptados
 */
export const getFriends = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id,
        status,
        created_at,
        user_id,
        friend_id
      `)
      .eq('status', 'accepted')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    if (error) throw error;

    // Obtener los IDs de los amigos
    const friendIds = data.map(f => f.user_id === userId ? f.friend_id : f.user_id);
    
    if (friendIds.length === 0) {
      return { friends: [], error: null };
    }

    // Obtener los perfiles de los amigos
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, nickname, first_name, last_name, country, avatar_url')
      .in('id', friendIds);

    if (profilesError) throw profilesError;

    // Combinar datos
    const friends = data.map(f => {
      const friendId = f.user_id === userId ? f.friend_id : f.user_id;
      const friendProfile = profiles?.find(p => p.id === friendId);
      return {
        friendshipId: f.id,
        friend: friendProfile || { id: friendId, nickname: 'Unknown', first_name: '', last_name: '' },
        since: f.created_at
      };
    });

    return { friends, error: null };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { friends: [], error: null };
    console.error('Error obteniendo amigos:', error);
    return { friends: [], error };
  }
};

/**
 * Obtener solicitudes pendientes recibidas
 */
export const getPendingRequests = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('friendships')
      .select('id, status, created_at, user_id')
      .eq('friend_id', userId)
      .eq('status', 'pending');

    if (error) throw error;
    
    if (!data || data.length === 0) {
      return { requests: [], error: null };
    }

    // Obtener perfiles de los solicitantes
    const userIds = data.map(r => r.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, nickname, first_name, last_name, country, avatar_url')
      .in('id', userIds);

    const requests = data.map(r => ({
      id: r.id,
      status: r.status,
      created_at: r.created_at,
      user: profiles?.find(p => p.id === r.user_id) || { id: r.user_id, nickname: 'Unknown' }
    }));

    return { requests, error: null };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { requests: [], error: null };
    console.error('Error obteniendo solicitudes:', error);
    return { requests: [], error };
  }
};

/**
 * Obtener solicitudes enviadas
 */
export const getSentRequests = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('friendships')
      .select('id, status, created_at, friend_id')
      .eq('user_id', userId)
      .eq('status', 'pending');

    if (error) throw error;
    
    if (!data || data.length === 0) {
      return { requests: [], error: null };
    }

    // Obtener perfiles de los destinatarios
    const friendIds = data.map(r => r.friend_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, nickname, first_name, last_name, country, avatar_url')
      .in('id', friendIds);

    const requests = data.map(r => ({
      id: r.id,
      status: r.status,
      created_at: r.created_at,
      friend: profiles?.find(p => p.id === r.friend_id) || { id: r.friend_id, nickname: 'Unknown' }
    }));

    return { requests, error: null };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { requests: [], error: null };
    console.error('Error obteniendo solicitudes enviadas:', error);
    return { requests: [], error };
  }
};

/**
 * Eliminar amistad
 */
export const removeFriend = async (friendshipId) => {
  try {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error eliminando amistad:', error);
    return { error };
  }
};

/**
 * Suscripción en tiempo real a cambios en amistades
 * DESHABILITADO para evitar loops
 */
export const subscribeFriendships = (userId, callback) => {
  return () => {};
};

export default {
  searchUserByNickname,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriends,
  getPendingRequests,
  getSentRequests,
  removeFriend,
  subscribeFriendships
};
