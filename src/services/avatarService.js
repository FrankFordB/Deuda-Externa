/**
 * Avatar Service - Manejo de fotos de perfil
 */
import { supabase } from './supabase';

const BUCKET_NAME = 'avatars';

/**
 * Subir avatar de usuario
 * @param {string} userId - ID del usuario
 * @param {File} file - Archivo de imagen
 * @returns {Promise<{url: string|null, error: Error|null}>}
 */
export const uploadAvatar = async (userId, file) => {
  try {
    // Validar tipo de archivo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Tipo de archivo no permitido. Usa JPG, PNG, GIF o WebP.');
    }

    // Validar tamaño (máximo 2MB)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('El archivo es muy grande. Máximo 2MB.');
    }

    // Generar nombre único para el archivo
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    // Eliminar avatar anterior si existe
    try {
      const { data: existingFiles } = await supabase.storage
        .from(BUCKET_NAME)
        .list(userId);
      
      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map(f => `${userId}/${f.name}`);
        await supabase.storage.from(BUCKET_NAME).remove(filesToDelete);
      }
    } catch (e) {
      // Ignorar error si no hay archivos previos
    }

    // Subir nuevo archivo
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // Obtener URL pública
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    const avatarUrl = urlData.publicUrl;

    // Actualizar perfil con la nueva URL
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    return { url: avatarUrl, error: null };
  } catch (error) {
    // Ignorar AbortError
    if (error.name === 'AbortError' || error.message?.includes('AbortError') || error.message?.includes('signal is aborted')) {
      return { url: null, error: null };
    }
    console.error('Error subiendo avatar:', error);
    return { url: null, error };
  }
};

/**
 * Eliminar avatar de usuario
 * @param {string} userId - ID del usuario
 * @returns {Promise<{error: Error|null}>}
 */
export const deleteAvatar = async (userId) => {
  try {
    // Listar archivos del usuario
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(userId);

    if (listError) throw listError;

    // Eliminar archivos
    if (files && files.length > 0) {
      const filesToDelete = files.map(f => `${userId}/${f.name}`);
      const { error: deleteError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove(filesToDelete);

      if (deleteError) throw deleteError;
    }

    // Actualizar perfil
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        avatar_url: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    return { error: null };
  } catch (error) {
    console.error('Error eliminando avatar:', error);
    return { error };
  }
};

/**
 * Obtener URL de avatar de un usuario
 * @param {string} userId - ID del usuario
 * @returns {Promise<{url: string|null, error: Error|null}>}
 */
export const getAvatarUrl = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;

    return { url: data?.avatar_url || null, error: null };
  } catch (error) {
    console.error('Error obteniendo avatar:', error);
    return { url: null, error };
  }
};

export default {
  uploadAvatar,
  deleteAvatar,
  getAvatarUrl
};
