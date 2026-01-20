/**
 * useNotificationSound - Hook para reproducir sonido de notificaciones
 */
import { useEffect, useRef } from 'react';

export const useNotificationSound = (enabled = true) => {
  const audioRef = useRef(null);

  useEffect(() => {
    // Crear elemento de audio con sonido de notificación
    // Usamos un data URL con un sonido simple generado
    if (enabled) {
      audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSpx0fPTgjMGHm7A7+OZURE');
    }
  }, [enabled]);

  const play = () => {
    if (audioRef.current && enabled) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((error) => {
        console.warn('No se pudo reproducir el sonido de notificación:', error);
      });
    }
  };

  return { play };
};

export default useNotificationSound;
