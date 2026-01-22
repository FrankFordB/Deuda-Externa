/**
 * Auth Service - Manejo de autenticación con Supabase
 */
import { supabase } from './supabase';

/**
 * Genera un nickname único basado en nombre y número aleatorio
 */
const generateUniqueNickname = async (firstName) => {
  const baseName = firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
  let nickname = '';
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    const randomNum = Math.floor(Math.random() * 9999);
    nickname = `${baseName}${randomNum}`;
    
    const { data } = await supabase
      .from('profiles')
      .select('nickname')
      .eq('nickname', nickname)
      .maybeSingle();
    
    if (!data) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    nickname = `${baseName}${Date.now()}`;
  }

  return nickname;
};

/**
 * Registro de nuevo usuario
 * Pasa los datos del formulario en el metadata para que el trigger los use
 */
export const signUp = async ({ 
  email, 
  password, 
  firstName, 
  lastName, 
  birthDate, 
  country 
}) => {
  try {
    // Generar nickname único
    const nickname = await generateUniqueNickname(firstName);

    console.log('📝 Registrando usuario con nickname:', nickname);

    // Registrar usuario en Supabase Auth con metadata
    // El trigger on_auth_user_created usará estos datos para crear el perfil
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: 'https://deuda-externa.vercel.app/email-verified',
        data: {
          first_name: firstName,
          last_name: lastName,
          birth_date: birthDate,
          country: country,
          nickname: nickname
        }
      }
    });

    if (authError) throw authError;

    console.log('✅ Usuario registrado en auth:', authData.user?.id);

    // Cerrar sesión inmediatamente para forzar verificación de email
    // Esto previene que el usuario sea redirigido al dashboard antes de verificar
    await supabase.auth.signOut();

    // NO intentar crear el perfil manualmente - el trigger lo hará
    // Esto evita que se quede esperando y hace el registro más rápido

    return { 
      user: authData.user, 
      nickname,
      error: null 
    };
  } catch (error) {
    console.error('❌ Error en registro:', error);
    return { user: null, error };
  }
};

/**
 * Reenviar email de verificación
 */
export const resendVerificationEmail = async (email) => {
  try {
    const { data, error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: 'https://deuda-externa.vercel.app/email-verified'
      }
    });

    if (error) throw error;

    return { success: true, error: null };
  } catch (error) {
    console.error('❌ Error reenviando email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Inicio de sesión
 */
export const signIn = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // Verificar si el email está confirmado
    if (!data.user.email_confirmed_at) {
      await supabase.auth.signOut();
      throw new Error('Por favor verifica tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada.');
    }

    // Obtener perfil del usuario (puede no existir aún)
    let profile = null;
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();
      
      if (!profileError && profileData) {
        profile = profileData;
      } else if (profileError && profileError.name !== 'AbortError' && !profileError.message?.includes('AbortError')) {
        console.warn('Error obteniendo perfil:', profileError.message);
      }
    } catch (e) {
      // Ignorar AbortError
      if (e.name !== 'AbortError' && !e.message?.includes('AbortError')) {
        console.warn('Perfil no encontrado, se creará automáticamente');
      }
    }

    // Verificar si la cuenta está suspendida
    if (profile?.status === 'suspended') {
      await supabase.auth.signOut();
      throw new Error('Tu cuenta ha sido suspendida. Contacta al administrador.');
    }

    return { user: data.user, profile, error: null };
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) {
      return { user: null, profile: null, error: null };
    }
    console.error('Error en login:', error);
    return { user: null, profile: null, error };
  }
};

/**
 * Cerrar sesión
 */
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error en logout:', error);
    return { error };
  }
};

/**
 * Obtener sesión actual
 */
export const getCurrentSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return { session, error: null };
  } catch (error) {
    // Ignorar AbortError
    if (error.name === 'AbortError') {
      return { session: null, error: null };
    }
    console.error('Error obteniendo sesión:', error);
    return { session: null, error };
  }
};

/**
 * Obtener usuario actual
 */
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    
    if (user) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      if (profileError && profileError.code !== 'PGRST116') throw profileError;
      return { user, profile: profile || null, error: null };
    }
    
    return { user: null, profile: null, error: null };
  } catch (error) {
    // Ignorar AbortError
    if (error.name === 'AbortError') {
      return { user: null, profile: null, error: null };
    }
    console.error('Error obteniendo usuario:', error);
    return { user: null, profile: null, error };
  }
};

/**
 * Actualizar perfil - Primero intenta UPDATE, si no existe hace INSERT
 */
export const updateProfile = async (userId, updates) => {
  try {
    console.log('🔄 authService.updateProfile llamado:', { userId, updates });
    
    // Filtrar campos undefined o null
    const cleanUpdates = {};
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        cleanUpdates[key] = updates[key];
      }
    });

    console.log('📝 Updates limpios:', cleanUpdates);

    // Si no hay nada que actualizar, retornar sin error
    if (Object.keys(cleanUpdates).length === 0) {
      console.warn('⚠️ No hay campos para actualizar');
      return { profile: null, error: null };
    }

    // Primero intentar UPDATE
    console.log('📡 Intentando UPDATE...');
    const { data: updateData, error: updateError } = await supabase
      .from('profiles')
      .update({
        ...cleanUpdates,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .maybeSingle();

    // Si UPDATE funcionó y retornó datos
    if (updateData) {
      console.log('✅ Perfil actualizado:', updateData);
      return { profile: updateData, error: null };
    }

    // Si no hay datos (perfil no existe), crear con INSERT
    if (!updateData && !updateError) {
      console.log('📝 Perfil no existe, creando con INSERT...');
      
      // Obtener email del usuario autenticado
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: insertData, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: user?.email || '',
          ...cleanUpdates,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Error en INSERT:', insertError);
        throw insertError;
      }

      console.log('✅ Perfil creado:', insertData);
      return { profile: insertData, error: null };
    }

    if (updateError) {
      console.error('❌ Error en UPDATE:', updateError);
      throw updateError;
    }

    return { profile: null, error: null };
  } catch (error) {
    console.error('❌ Error actualizando perfil:', error);
    return { profile: null, error };
  }
};

/**
 * Restablecer contraseña - Enviar email
 */
export const sendPasswordResetEmail = async (email) => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
    return { success: true, error: null };
  } catch (error) {
    console.error('Error en reset password:', error);
    return { success: false, error };
  }
};

/**
 * Actualizar contraseña con token (desde email de recuperación)
 */
export const updatePasswordWithToken = async (newPassword) => {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    
    if (error) throw error;
    
    // Cerrar sesión en otros dispositivos invalidando el refresh token
    await supabase.auth.signOut({ scope: 'others' });
    
    return { success: true, error: null };
  } catch (error) {
    console.error('Error actualizando contraseña:', error);
    return { success: false, error };
  }
};

/**
 * Cambiar contraseña (usuario logueado)
 */
export const changePassword = async (currentPassword, newPassword) => {
  try {
    // Primero verificar la contraseña actual reautenticando
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) throw new Error('Usuario no autenticado');

    // Intentar reautenticar con la contraseña actual
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword
    });

    if (signInError) {
      return { success: false, error: { message: 'Contraseña actual incorrecta' } };
    }

    // Actualizar a la nueva contraseña
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (updateError) throw updateError;

    // Cerrar sesión en otros dispositivos
    await supabase.auth.signOut({ scope: 'others' });

    return { success: true, error: null };
  } catch (error) {
    console.error('Error cambiando contraseña:', error);
    return { success: false, error };
  }
};

/**
 * Verificar si hay una sesión de recuperación activa
 */
export const checkPasswordRecoverySession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    
    // Verificar si la sesión viene de un link de recuperación
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');
    
    if (type === 'recovery' && accessToken) {
      return { isRecoverySession: true, error: null };
    }
    
    return { isRecoverySession: !!session, error: null };
  } catch (error) {
    console.error('Error verificando sesión de recuperación:', error);
    return { isRecoverySession: false, error };
  }
};

/**
 * Eliminar cuenta completa del usuario
 * Elimina todos los datos relacionados y la cuenta de auth
 */
export const deleteAccount = async (userId) => {
  try {
    console.log('🗑️ Iniciando eliminación de cuenta:', userId);

    // 1. Eliminar datos relacionados en orden
    await supabase.from('expenses').delete().eq('user_id', userId);
    await supabase.from('monthly_incomes').delete().eq('user_id', userId);
    await supabase.from('virtual_friends').delete().eq('user_id', userId);
    await supabase.from('change_requests').delete().eq('user_id', userId);
    await supabase.from('notifications').delete().eq('user_id', userId);
    
    // Eliminar deudas (como acreedor y deudor)
    await supabase.from('debts').delete().or(`creditor_id.eq.${userId},debtor_id.eq.${userId}`);
    
    // Eliminar amistades
    await supabase.from('friendships').delete().or(`user_id.eq.${userId},friend_id.eq.${userId}`);
    
    // 2. Eliminar avatar del storage
    const { data: files } = await supabase.storage
      .from('avatars')
      .list(userId);
    
    if (files && files.length > 0) {
      const filesToDelete = files.map(f => `${userId}/${f.name}`);
      await supabase.storage.from('avatars').remove(filesToDelete);
    }

    // 3. Eliminar perfil
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) throw profileError;

    // 4. Cerrar sesión (el usuario ya no existe)
    await supabase.auth.signOut();

    console.log('✅ Cuenta eliminada exitosamente');
    return { error: null };
  } catch (error) {
    console.error('❌ Error eliminando cuenta:', error);
    return { error };
  }
};

export default {
  signUp,
  signIn,
  signOut,
  getCurrentSession,
  getCurrentUser,
  updateProfile,
  sendPasswordResetEmail,
  updatePasswordWithToken,
  changePassword,
  checkPasswordRecoverySession,
  deleteAccount
};
