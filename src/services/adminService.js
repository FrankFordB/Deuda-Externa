/**
 * Admin Service - Funciones de administración
 */
import { supabase } from './supabase';

/**
 * Verificar si el usuario es superadmin
 */
export const checkIsSuperAdmin = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return { isSuperAdmin: data?.role === 'superadmin', error: null };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) return { isSuperAdmin: false, error: null };
    console.error('Error verificando rol:', error);
    return { isSuperAdmin: false, error };
  }
};

/**
 * Obtener todos los usuarios (solo superadmin)
 */
export const getAllUsers = async (filters = {}) => {
  try {
    let query = supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.search) {
      query = query.or(`email.ilike.%${filters.search}%,nickname.ilike.%${filters.search}%,first_name.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { users: data, error: null };
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    return { users: [], error };
  }
};

/**
 * Obtener estadísticas de un usuario
 */
export const getUserStats = async (userId) => {
  try {
    // Contar gastos
    const { count: expenseCount } = await supabase
      .from('expenses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Contar deudas activas
    const { count: debtCount } = await supabase
      .from('debts')
      .select('*', { count: 'exact', head: true })
      .or(`creditor_id.eq.${userId},debtor_id.eq.${userId}`)
      .in('status', ['pending', 'accepted']);

    // Contar amigos
    const { count: friendCount } = await supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'accepted')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    return {
      stats: {
        expenseCount: expenseCount || 0,
        debtCount: debtCount || 0,
        friendCount: friendCount || 0
      },
      error: null
    };
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    return { stats: null, error };
  }
};

/**
 * Actualizar usuario (admin)
 */
export const updateUser = async (userId, updates) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return { user: data, error: null };
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    return { user: null, error };
  }
};

/**
 * Suspender usuario
 */
export const suspendUser = async (userId) => {
  return updateUser(userId, { status: 'suspended' });
};

/**
 * Activar usuario
 */
export const activateUser = async (userId) => {
  return updateUser(userId, { status: 'active' });
};

/**
 * Eliminar usuario (soft delete o real)
 */
export const deleteUser = async (userId) => {
  try {
    // Primero eliminar datos relacionados
    await supabase.from('expenses').delete().eq('user_id', userId);
    await supabase.from('debts').delete().or(`creditor_id.eq.${userId},debtor_id.eq.${userId}`);
    await supabase.from('friendships').delete().or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    // Eliminar perfil
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    return { error };
  }
};

/**
 * Obtener configuración del sitio
 */
export const getSiteConfig = async () => {
  try {
    const { data, error } = await supabase
      .from('site_config')
      .select('*');

    // Ignorar errores comunes
    if (error) {
      // PGRST116 = No rows returned
      // 42P01 = Table doesn't exist
      if (error.code === 'PGRST116' || error.code === '42P01') {
        // Retornar configuración por defecto sin error
        return { 
          config: {
            header_title: 'GestorDeudas',
            header_links: [],
            footer_text: '© 2026 GestorDeudas. Todos los derechos reservados.',
            footer_links: [],
            theme: 'light',
            currency: '$'
          }, 
          error: null 
        };
      }
      throw error;
    }
    
    // Convertir array de {key, value} a objeto
    const configObj = {
      header_title: 'GestorDeudas',
      header_links: [],
      footer_text: '© 2026 GestorDeudas. Todos los derechos reservados.',
      footer_links: [],
      theme: 'light',
      currency: '$'
    };
    
    if (data && Array.isArray(data)) {
      data.forEach(item => {
        if (item.key === 'site_name') configObj.header_title = item.value;
        else if (item.key === 'header_links') configObj.header_links = item.value || [];
        else if (item.key === 'footer_text') configObj.footer_text = item.value;
        else if (item.key === 'footer_links') configObj.footer_links = item.value || [];
        else if (item.key === 'theme') configObj.theme = item.value;
        else if (item.key === 'currency') configObj.currency = item.value;
      });
    }
    
    return { config: configObj, error: null };
  } catch (error) {
    // Ignorar AbortError y errores de tabla inexistente
    if (error.name === 'AbortError' || error.message?.includes('AbortError') || error.code === '42P01') {
      return { 
        config: {
          header_title: 'GestorDeudas',
          header_links: [],
          footer_text: '© 2026 GestorDeudas. Todos los derechos reservados.',
          footer_links: [],
          theme: 'light',
          currency: '$'
        }, 
        error: null 
      };
    }
    // Solo loguear errores reales, no AbortError
    if (error.name !== 'AbortError' && !error.message?.includes('AbortError')) {
      console.warn('Error obteniendo configuración (usando defaults):', error.message);
    }
    return { 
      config: {
        header_title: 'GestorDeudas',
        header_links: [],
        footer_text: '© 2026 GestorDeudas. Todos los derechos reservados.',
        footer_links: [],
        theme: 'light',
        currency: '$'
      }, 
      error: null 
    };
  }
};

/**
 * Actualizar configuración del sitio
 */
export const updateSiteConfig = async (config) => {
  try {
    // Verificar si existe
    const { data: existing } = await supabase
      .from('site_config')
      .select('id')
      .single();

    let result;
    if (existing) {
      result = await supabase
        .from('site_config')
        .update(config)
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('site_config')
        .insert(config)
        .select()
        .single();
    }

    if (result.error) throw result.error;
    return { config: result.data, error: null };
  } catch (error) {
    console.error('Error actualizando configuración:', error);
    return { config: null, error };
  }
};

/**
 * Obtener estadísticas globales
 */
export const getGlobalStats = async () => {
  try {
    const { count: userCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const { count: activeUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    const { count: totalExpenses } = await supabase
      .from('expenses')
      .select('*', { count: 'exact', head: true });

    const { count: totalDebts } = await supabase
      .from('debts')
      .select('*', { count: 'exact', head: true });

    const { data: expenseSum } = await supabase
      .from('expenses')
      .select('amount');

    const totalAmount = (expenseSum || []).reduce((sum, e) => sum + e.amount, 0);

    return {
      stats: {
        userCount: userCount || 0,
        activeUsers: activeUsers || 0,
        suspendedUsers: (userCount || 0) - (activeUsers || 0),
        totalExpenses: totalExpenses || 0,
        totalDebts: totalDebts || 0,
        totalAmount
      },
      error: null
    };
  } catch (error) {
    console.error('Error obteniendo estadísticas globales:', error);
    return { stats: null, error };
  }
};

export default {
  checkIsSuperAdmin,
  getAllUsers,
  getUserStats,
  updateUser,
  suspendUser,
  activateUser,
  deleteUser,
  getSiteConfig,
  updateSiteConfig,
  getGlobalStats
};
