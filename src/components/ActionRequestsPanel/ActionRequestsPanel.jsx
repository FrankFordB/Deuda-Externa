import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Clock, 
  AlertTriangle,
  User,
  MessageCircle,
  Loader2 
} from 'lucide-react';
import { useAuth, useUI } from '../../context';
import { 
  getPendingActionRequests, 
  approveActionRequest, 
  rejectActionRequest 
} from '../../services/actionValidationsService';
import ConfirmModal from '../ConfirmModal';
import styles from './ActionRequestsPanel.module.css';

const ActionRequestsPanel = ({ onUpdate }) => {
  const { user } = useAuth();
  const { showSuccess, showError } = useUI();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  
  // Modal de rechazo con razón
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [requestToReject, setRequestToReject] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    loadRequests();
  }, [user]);

  const loadRequests = async () => {
    if (!user) return;
    
    setLoading(true);
    const { success, requests: data } = await getPendingActionRequests(user.id);
    
    if (success) {
      setRequests(data);
    }
    setLoading(false);
  };

  const handleApprove = async (request) => {
    setProcessingId(request.action_id);
    
    const { success, data, executed, error } = await approveActionRequest(
      request.action_id, 
      user.id
    );
    
    if (success) {
      if (executed) {
        showSuccess(`✅ ${request.action_type === 'delete' ? 'Gasto eliminado' : 'Cambios aplicados'} exitosamente`);
      } else {
        showSuccess(`✅ Aprobación registrada, faltan ${data.pending_count} aprobaciones`);
      }
      setRequests(prev => prev.filter(r => r.action_id !== request.action_id));
      onUpdate?.();
    } else {
      showError(error || 'Error al aprobar');
    }
    
    setProcessingId(null);
  };

  const openRejectModal = (request) => {
    setRequestToReject(request);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!requestToReject) return;
    
    setProcessingId(requestToReject.action_id);
    setShowRejectModal(false);
    
    const { success, error } = await rejectActionRequest(
      requestToReject.action_id,
      user.id,
      rejectReason || null
    );
    
    if (success) {
      showSuccess('❌ Solicitud rechazada');
      setRequests(prev => prev.filter(r => r.action_id !== requestToReject.action_id));
      onUpdate?.();
    } else {
      showError(error || 'Error al rechazar');
    }
    
    setProcessingId(null);
    setRequestToReject(null);
  };

  const getActionIcon = (type) => {
    switch (type) {
      case 'delete':
        return <Trash2 size={18} className={styles.deleteIcon} />;
      case 'modify':
        return <Edit3 size={18} className={styles.modifyIcon} />;
      default:
        return <AlertTriangle size={18} />;
    }
  };

  const getActionLabel = (type) => {
    switch (type) {
      case 'delete':
        return 'Eliminar';
      case 'modify':
        return 'Modificar';
      default:
        return 'Acción';
    }
  };

  if (loading) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <Shield size={20} />
          <span>Solicitudes de Validación</span>
        </div>
        <div className={styles.loading}>
          <Loader2 className={styles.spinner} size={24} />
          <span>Cargando...</span>
        </div>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <Shield size={20} />
          <span>Solicitudes de Validación</span>
        </div>
        <div className={styles.empty}>
          <Check size={32} className={styles.emptyIcon} />
          <p>No hay solicitudes pendientes</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.panel}>
        <div className={styles.header}>
          <Shield size={20} />
          <span>Solicitudes de Validación</span>
          <span className={styles.badge}>{requests.length}</span>
        </div>

        <div className={styles.list}>
          {requests.map(request => (
            <div key={request.response_id} className={styles.request}>
              <div className={styles.requestHeader}>
                <div className={styles.actionType}>
                  {getActionIcon(request.action_type)}
                  <span className={`${styles.actionLabel} ${styles[request.action_type]}`}>
                    {getActionLabel(request.action_type)}
                  </span>
                </div>
                <div className={styles.groupName}>{request.group_name}</div>
              </div>

              <div className={styles.expenseInfo}>
                <div className={styles.expenseDesc}>{request.expense_description}</div>
                <div className={styles.expenseAmount}>
                  {request.currency_symbol}{request.expense_amount?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className={styles.requester}>
                <User size={14} />
                <span>Solicitado por: <strong>{request.requester_name}</strong></span>
              </div>

              {request.reason && (
                <div className={styles.reason}>
                  <MessageCircle size={14} />
                  <span>"{request.reason}"</span>
                </div>
              )}

              <div className={styles.timestamp}>
                <Clock size={12} />
                <span>
                  {new Date(request.created_at).toLocaleDateString('es-AR', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>

              <div className={styles.actions}>
                <button
                  className={`${styles.btn} ${styles.rejectBtn}`}
                  onClick={() => openRejectModal(request)}
                  disabled={processingId === request.action_id}
                >
                  {processingId === request.action_id ? (
                    <Loader2 size={16} className={styles.spinner} />
                  ) : (
                    <>
                      <X size={16} />
                      <span>Rechazar</span>
                    </>
                  )}
                </button>
                <button
                  className={`${styles.btn} ${styles.approveBtn}`}
                  onClick={() => handleApprove(request)}
                  disabled={processingId === request.action_id}
                >
                  {processingId === request.action_id ? (
                    <Loader2 size={16} className={styles.spinner} />
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Aprobar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal para rechazar con razón */}
      <ConfirmModal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRequestToReject(null);
        }}
        onConfirm={handleReject}
        title="Rechazar Solicitud"
        message={`¿Estás seguro de rechazar la solicitud de ${requestToReject?.action_type === 'delete' ? 'eliminar' : 'modificar'} "${requestToReject?.expense_description}"?`}
        type="warning"
        confirmText="Rechazar"
        cancelText="Cancelar"
      >
        <div className={styles.rejectReasonContainer}>
          <label>Razón del rechazo (opcional):</label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Explica por qué rechazas esta solicitud..."
            rows={3}
            className={styles.rejectReasonInput}
          />
        </div>
      </ConfirmModal>
    </>
  );
};

export default ActionRequestsPanel;
