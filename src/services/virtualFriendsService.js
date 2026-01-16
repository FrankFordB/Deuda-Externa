/**
 * Virtual Friends Service - Amigos sin cuenta (creados por el usuario)
 */
import { supabase } from './supabase';

/**
 * Obtener amigos virtuales del usuario
 */
export const getVirtualFriends = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('virtual_friends')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) throw error;
    return { friends: data || [], error: null };
  } catch (error) {
    console.error('Error obteniendo amigos virtuales:', error);
    return { friends: [], error };
  }
};

/**
 * Crear amigo virtual
 */
export const createVirtualFriend = async (userId, friendData) => {
  try {
    const { data, error } = await supabase
      .from('virtual_friends')
      .insert({
        user_id: userId,
        name: friendData.name,
        email: friendData.email || null,
        phone: friendData.phone || null,
        notes: friendData.notes || null
      })
      .select()
      .single();

    if (error) throw error;
    return { friend: data, error: null };
  } catch (error) {
    console.error('Error creando amigo virtual:', error);
    return { friend: null, error };
  }
};

/**
 * Actualizar amigo virtual
 */
export const updateVirtualFriend = async (friendId, updates) => {
  try {
    const { data, error } = await supabase
      .from('virtual_friends')
      .update({
        name: updates.name,
        email: updates.email || null,
        phone: updates.phone || null,
        notes: updates.notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', friendId)
      .select()
      .single();

    if (error) throw error;
    return { friend: data, error: null };
  } catch (error) {
    console.error('Error actualizando amigo virtual:', error);
    return { friend: null, error };
  }
};

/**
 * Eliminar amigo virtual
 */
export const deleteVirtualFriend = async (friendId) => {
  try {
    const { error } = await supabase
      .from('virtual_friends')
      .delete()
      .eq('id', friendId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error eliminando amigo virtual:', error);
    return { error };
  }
};

/**
 * Buscar amigo virtual por nombre
 */
export const searchVirtualFriends = async (userId, searchTerm) => {
  try {
    const { data, error } = await supabase
      .from('virtual_friends')
      .select('*')
      .eq('user_id', userId)
      .ilike('name', `%${searchTerm}%`)
      .limit(10);

    if (error) throw error;
    return { friends: data || [], error: null };
  } catch (error) {
    console.error('Error buscando amigos virtuales:', error);
    return { friends: [], error };
  }
};

export default {
  getVirtualFriends,
  createVirtualFriend,
  updateVirtualFriend,
  deleteVirtualFriend,
  searchVirtualFriends
};
