/**
 * ConfirmModal - Modal de confirmación moderno con gradientes
 * Reemplaza window.confirm con una experiencia visual moderna
 */
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, CheckCircle, XCircle, Info, HelpCircle } from 'lucide-react';
import styles from './ConfirmModal.module.css';

const ConfirmModal = ({
  isOpen,
  onConfirm,
  onCancel,
  title = '¿Estás seguro?',
  message = '',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'warning', // 'warning' | 'danger' | 'success' | 'info' | 'question'
  loading = false,
  showIcon = true
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && !loading) {
        onCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onCancel, loading]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return <Trash2 size={32} />;
      case 'success':
        return <CheckCircle size={32} />;
      case 'info':
        return <Info size={32} />;
      case 'question':
        return <HelpCircle size={32} />;
      case 'warning':
      default:
        return <AlertTriangle size={32} />;
    }
  };

  return createPortal(
    <div className={styles.overlay} onClick={!loading ? onCancel : undefined}>
      <div 
        className={`${styles.modal} ${styles[type]}`}
        onClick={(e) => e.stopPropagation()}
      >
        {showIcon && (
          <div className={`${styles.iconWrapper} ${styles[`icon${type.charAt(0).toUpperCase() + type.slice(1)}`]}`}>
            {getIcon()}
          </div>
        )}
        
        <h3 className={styles.title}>{title}</h3>
        
        {message && (
          <p className={styles.message}>{message}</p>
        )}
        
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`${styles.confirmBtn} ${styles[`confirm${type.charAt(0).toUpperCase() + type.slice(1)}`]}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <span className={styles.loadingSpinner}></span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmModal;
