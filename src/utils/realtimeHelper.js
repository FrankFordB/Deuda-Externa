/**
 * Helper para manejo de datos en tiempo real con fallback a polling
 * Soluciona problemas de conexión realtime de Supabase
 */

import supabase from '../services/supabaseClient';

// Cache de canales activos
const activeChannels = new Map();
const activePollers = new Map();

/**
 * Crea una suscripción con fallback automático a polling
 * @param {Object} options - Opciones de configuración
 * @param {string} options.channelName - Nombre único del canal
 * @param {string} options.table - Nombre de la tabla
 * @param {string} options.filter - Filtro SQL (ej: 'user_id=eq.123')
 * @param {Function} options.fetchData - Función para obtener datos frescos
 * @param {Function} options.onData - Callback cuando hay datos nuevos
 * @param {number} options.pollingInterval - Intervalo de polling en ms (default: 5000)
 * @returns {Function} - Función para cancelar la suscripción
 */
export const createHybridSubscription = ({
  channelName,
  table,
  filter,
  fetchData,
  onData,
  pollingInterval = 5000
}) => {
  let usePolling = false;
  let isActive = true;
  let lastDataHash = '';

  // Función para verificar cambios en datos
  const checkForChanges = async () => {
    if (!isActive) return;
    
    try {
      const data = await fetchData();
      const dataHash = JSON.stringify(data);
      
      if (dataHash !== lastDataHash) {
        lastDataHash = dataHash;
        onData(data);
      }
    } catch (error) {
      console.warn(`Error en polling de ${table}:`, error);
    }
  };

  // Iniciar polling como fallback
  const startPolling = () => {
    if (activePollers.has(channelName)) return;
    
    console.log(`📊 Usando polling para ${table} (cada ${pollingInterval/1000}s)`);
    
    // Obtener datos iniciales
    checkForChanges();
    
    // Configurar intervalo de polling
    const pollerId = setInterval(checkForChanges, pollingInterval);
    activePollers.set(channelName, pollerId);
  };

  // Intentar configurar realtime
  const setupRealtime = () => {
    try {
      // Limpiar canal existente si hay
      if (activeChannels.has(channelName)) {
        try {
          supabase.removeChannel(activeChannels.get(channelName));
        } catch (e) {}
      }

      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: table,
            filter: filter
          },
          (payload) => {
            // Realtime funcionando - obtener datos frescos
            checkForChanges();
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log(`✅ Realtime activo para ${table}`);
            // Detener polling si estaba activo
            if (activePollers.has(channelName)) {
              clearInterval(activePollers.get(channelName));
              activePollers.delete(channelName);
            }
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`⚠️ Realtime no disponible para ${table}, usando polling`);
            usePolling = true;
            startPolling();
          } else if (status === 'CLOSED') {
            if (isActive) {
              // Reconexión automática
              setTimeout(setupRealtime, 3000);
            }
          }
        });

      activeChannels.set(channelName, channel);
      
      // Timeout: si no conecta en 3 segundos, usar polling
      setTimeout(() => {
        if (!activePollers.has(channelName) && isActive) {
          // Verificar si realtime está funcionando
          const channel = activeChannels.get(channelName);
          if (!channel || channel.state !== 'joined') {
            console.warn(`⏱️ Timeout realtime para ${table}, usando polling`);
            startPolling();
          }
        }
      }, 3000);

    } catch (error) {
      console.warn(`Error configurando realtime para ${table}:`, error);
      startPolling();
    }
  };

  // Obtener datos iniciales
  checkForChanges();
  
  // Intentar realtime
  setupRealtime();

  // Retornar función de limpieza
  return () => {
    isActive = false;
    
    // Limpiar canal realtime
    if (activeChannels.has(channelName)) {
      try {
        supabase.removeChannel(activeChannels.get(channelName));
      } catch (e) {}
      activeChannels.delete(channelName);
    }
    
    // Limpiar polling
    if (activePollers.has(channelName)) {
      clearInterval(activePollers.get(channelName));
      activePollers.delete(channelName);
    }
  };
};

/**
 * Suscripción simple con solo polling (más confiable)
 */
export const createPollingSubscription = ({
  name,
  fetchData,
  onData,
  interval = 5000
}) => {
  let isActive = true;
  let lastDataHash = '';

  const checkForChanges = async () => {
    if (!isActive) return;
    
    try {
      const data = await fetchData();
      const dataHash = JSON.stringify(data);
      
      if (dataHash !== lastDataHash) {
        lastDataHash = dataHash;
        onData(data);
      }
    } catch (error) {
      console.warn(`Error en polling ${name}:`, error);
    }
  };

  // Datos iniciales
  checkForChanges();
  
  // Polling
  const pollerId = setInterval(checkForChanges, interval);
  activePollers.set(name, pollerId);

  return () => {
    isActive = false;
    if (activePollers.has(name)) {
      clearInterval(activePollers.get(name));
      activePollers.delete(name);
    }
  };
};

/**
 * Limpiar todas las suscripciones activas
 */
export const cleanupAllSubscriptions = () => {
  // Limpiar canales
  activeChannels.forEach((channel, name) => {
    try {
      supabase.removeChannel(channel);
    } catch (e) {}
  });
  activeChannels.clear();
  
  // Limpiar pollers
  activePollers.forEach((pollerId) => {
    clearInterval(pollerId);
  });
  activePollers.clear();
};

export default {
  createHybridSubscription,
  createPollingSubscription,
  cleanupAllSubscriptions
};
