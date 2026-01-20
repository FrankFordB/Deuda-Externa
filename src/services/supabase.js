/**
 * Supabase Client Configuration
 * Este archivo configura la conexión con Supabase
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ Supabase credentials not found. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  }
);

// Silenciar errores globales de AbortError (ocurren cuando se cancelan peticiones al desmontar componentes)
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = (...args) => {
    // Filtrar AbortError
    if (args[0]?.message?.includes?.('AbortError') || 
        args[0]?.toString?.()?.includes?.('AbortError') ||
        args[1]?.message?.includes?.('AbortError')) {
      return; // No mostrar
    }
    originalConsoleError.apply(console, args);
  };
  
  // Capturar errores no manejados de promesas
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.name === 'AbortError' || 
        event.reason?.message?.includes?.('AbortError')) {
      event.preventDefault(); // Silenciar
    }
  });
}

export default supabase;
