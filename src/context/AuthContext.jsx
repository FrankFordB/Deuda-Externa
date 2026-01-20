/**
 * Auth Context - Manejo global de autenticación
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import authService from '../services/authService';
import adminService from '../services/adminService';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [initialized, setInitialized] = useState(false);

  // Función para cargar el perfil (función normal, no useCallback para evitar loop)
  const loadProfile = async (userId) => {
    if (!userId) return null;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, nickname, first_name, last_name, country, birth_date, role, avatar_url, is_superadmin')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) {
        // Ignorar AbortError
        if (error.name === 'AbortError' || error.message?.includes('AbortError')) {
          return null;
        }
        console.warn('Error cargando perfil:', error.message);
        return null;
      }
      
      return data;
    } catch (e) {
      if (e.name === 'AbortError' || e.message?.includes('AbortError')) return null;
      console.warn('Perfil no encontrado:', e.message);
      return null;
    }
  };

  // Inicializar autenticación
  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;
    
    const initAuth = async () => {
      try {
        const startTime = performance.now();
        console.log('🔄 Inicializando autenticación...');
        
        // Timeout de seguridad: si tarda más de 10 segundos, forzar fin de loading
        timeoutId = setTimeout(() => {
          if (isMounted && loading) {
            console.warn('⚠️ Timeout de autenticación - forzando fin de loading');
            setLoading(false);
            setInitialized(true);
          }
        }, 10000);
        
        // Obtener sesión actual
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log(`⏱️ getSession tardó: ${(performance.now() - startTime).toFixed(2)}ms`);
        
        if (!isMounted) return;
        
        if (sessionError) {
          // Ignorar AbortError
          if (sessionError.name === 'AbortError') return;
          console.warn('Error obteniendo sesión:', sessionError.message);
          setLoading(false);
          setInitialized(true);
          return;
        }
        
        if (session?.user) {
          console.log('✅ Sesión encontrada:', session.user.email);
          setUser(session.user);
          
          // Cargar perfil con timeout
          const profileStart = performance.now();
          try {
            const profileData = await Promise.race([
              loadProfile(session.user.id),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Profile timeout')), 5000)
              )
            ]);
            console.log(`⏱️ loadProfile tardó: ${(performance.now() - profileStart).toFixed(2)}ms`);
            if (isMounted && profileData) {
              setProfile(profileData);
              setIsSuperAdmin(profileData.role === 'superadmin');
              console.log('✅ Perfil cargado:', { nickname: profileData.nickname, role: profileData.role });
            } else {
              console.warn('⚠️ No se pudo cargar el perfil del usuario');
            }
          } catch (profileErr) {
            console.warn('⚠️ Error o timeout cargando perfil:', profileErr.message);
            // Continuar sin perfil - no bloquear la app
          }
        } else {
          console.log('ℹ️ No hay sesión activa');
        }
      } catch (err) {
        // Ignorar AbortError
        if (err.name === 'AbortError') return;
        console.error('Error inicializando auth:', err);
        if (isMounted) setError(err?.message || 'Error desconocido');
      } finally {
        // Limpiar timeout ANTES de terminar
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        if (isMounted) {
          setLoading(false);
          setInitialized(true);
          console.log('✅ Autenticación inicializada');
        }
      }
    };

    initAuth();

    // Escuchar cambios de autenticación (SIMPLIFICADO - sin cargas adicionales)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        
        console.log('🔔 Auth state change:', event);
        
        // Solo actualizar estado, NO cargar perfil aquí
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          setLoading(false);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setIsSuperAdmin(false);
          setLoading(false);
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('🔄 Token refrescado');
          // Actualizar usuario si hay sesión
          if (session?.user) {
            setUser(session.user);
          }
        } else if (event === 'USER_UPDATED') {
          console.log('👤 Usuario actualizado');
          if (session?.user) {
            setUser(session.user);
          }
        }
      }
    );

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      subscription?.unsubscribe();
    };
  }, []); // Sin dependencias - solo ejecutar una vez al montar

  const signIn = async (email, password) => {
    setError(null);
    setLoading(true);
    try {
      const result = await authService.signIn(email, password);
      if (result.error) {
        setError(result.error.message);
        return { success: false, error: result.error };
      }
      setUser(result.user);
      setProfile(result.profile);
      
      const { isSuperAdmin: isAdmin } = await adminService.checkIsSuperAdmin(result.user.id);
      setIsSuperAdmin(isAdmin);
      
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (userData) => {
    setError(null);
    setLoading(true);
    try {
      const result = await authService.signUp(userData);
      console.log('📦 Resultado de authService.signUp:', result);
      
      if (result.error) {
        setError(result.error.message);
        return { success: false, error: result.error };
      }
      
      console.log('✅ Retornando success con nickname:', result.nickname);
      return { success: true, nickname: result.nickname };
    } catch (err) {
      console.error('❌ Error en signUp:', err);
      setError(err.message);
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    // No esperar, cerrar sesión inmediatamente en el cliente
    setUser(null);
    setProfile(null);
    setIsSuperAdmin(false);
    setLoading(false);
    
    // Intentar cerrar en Supabase en background (no bloquea)
    try {
      await authService.signOut();
    } catch (err) {
      console.warn('Error cerrando sesión en servidor:', err);
      // Ignorar error, ya cerramos localmente
    }
  };

  const updateProfile = async (updates) => {
    if (!user) return { success: false, error: { message: 'No autenticado' } };
    
    try {
      const result = await authService.updateProfile(user.id, updates);
      if (result.error) {
        console.error('Error en updateProfile:', result.error);
        return { success: false, error: result.error };
      }
      
      // Si el update fue exitoso, actualizar el perfil local
      if (result.profile) {
        setProfile(result.profile);
      } else {
        // Si no retornó perfil, refrescar desde la BD
        const { data: freshProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        
        if (freshProfile) {
          setProfile(freshProfile);
        }
      }
      
      return { success: true };
    } catch (err) {
      console.error('Error en updateProfile:', err);
      return { success: false, error: err };
    }
  };

  // Enviar email de recuperación de contraseña
  const sendPasswordReset = async (email) => {
    setError(null);
    try {
      const result = await authService.sendPasswordResetEmail(email);
      if (result.error) {
        // No revelar si el email existe o no
        return { success: true }; // Siempre retornar éxito por seguridad
      }
      return { success: true };
    } catch (err) {
      // No revelar errores específicos
      return { success: true };
    }
  };

  // Actualizar contraseña con token de recuperación
  const updatePasswordWithToken = async (newPassword) => {
    setError(null);
    try {
      const result = await authService.updatePasswordWithToken(newPassword);
      if (result.error) {
        setError(result.error.message);
        return { success: false, error: result.error };
      }
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err };
    }
  };

  // Cambiar contraseña (usuario logueado)
  const changePassword = async (currentPassword, newPassword) => {
    if (!user) return { success: false, error: { message: 'No autenticado' } };
    
    setError(null);
    try {
      const result = await authService.changePassword(currentPassword, newPassword);
      if (result.error) {
        setError(result.error.message);
        return { success: false, error: result.error };
      }
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err };
    }
  };

  // Verificar sesión de recuperación
  const checkRecoverySession = async () => {
    try {
      return await authService.checkPasswordRecoverySession();
    } catch (err) {
      return { isRecoverySession: false, error: err };
    }
  };

  // Recargar perfil del usuario actual
  const reloadProfile = async () => {
    if (!user) return;
    
    try {
      const profileData = await loadProfile(user.id);
      if (profileData) {
        setProfile(profileData);
        setIsSuperAdmin(profileData.role === 'superadmin');
      }
    } catch (err) {
      console.warn('Error recargando perfil:', err);
    }
  };

  // Eliminar cuenta permanentemente
  const deleteAccount = async () => {
    if (!user) return { success: false, error: { message: 'No autenticado' } };
    
    try {
      const result = await authService.deleteAccount(user.id);
      if (result.error) {
        return { success: false, error: result.error };
      }
      
      // Limpiar estado local
      setUser(null);
      setProfile(null);
      setIsSuperAdmin(false);
      setLoading(false);
      
      return { success: true };
    } catch (err) {
      return { success: false, error: err };
    }
  };

  const value = {
    user,
    profile,
    isSuperAdmin,
    loading,
    error,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signOut,
    updateProfile,
    reloadProfile,
    sendPasswordReset,
    updatePasswordWithToken,
    changePassword,
    checkRecoverySession,
    deleteAccount,
    clearError: () => setError(null)
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
