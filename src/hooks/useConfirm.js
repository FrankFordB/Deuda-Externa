/**
 * useConfirm - Hook para usar ConfirmModal de forma declarativa
 * Similar a window.confirm pero con UI moderna
 */
import { useState, useCallback } from 'react';

export const useConfirm = () => {
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    type: 'warning',
    onConfirm: () => {},
    loading: false
  });

  const confirm = useCallback(({
    title = '¿Estás seguro?',
    message = '',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    type = 'warning'
  }) => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        title,
        message,
        confirmText,
        cancelText,
        type,
        loading: false,
        onConfirm: () => {
          setConfirmState(prev => ({ ...prev, isOpen: false }));
          resolve(true);
        },
        onCancel: () => {
          setConfirmState(prev => ({ ...prev, isOpen: false }));
          resolve(false);
        }
      });
    });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const setLoading = useCallback((loading) => {
    setConfirmState(prev => ({ ...prev, loading }));
  }, []);

  return {
    confirmState,
    confirm,
    closeConfirm,
    setLoading
  };
};

export default useConfirm;
