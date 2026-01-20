/**
 * ChangeRequestsPanel - Panel para ver y aprobar/rechazar solicitudes de cambios
 */
import { useState, useEffect } from 'react';
import { useAuth, useUI } from '../../context';
import { changeRequestsService, supabase } from '../../services';
import { Button, Card, Loading, Modal } from '../../components';
import styles from './ChangeRequestsPanel.module.css';

const ChangeRequestsPanel = () => {
  const { user } = useAuth();
  const { showSuccess, showError, siteConfig } = useUI();
  
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [responseMessage, setResponseMessage] = useState('');
  const [processing, setProcessing] = useState(false);

  const currency = siteConfig?.currency || '$';

  useEffect(() => {
    loadRequests();
    
    // Suscribirse a cambios en tiempo real
    let channel = null;
    if (user?.id) {
      channel = changeRequestsService.subscribeToRequests(
        user.id,
        () => loadRequests()
      );
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user]);

  const loadRequests = async () => {
    if (!user) return;
    setLoading(true);
    const result = await changeRequestsService.getPendingRequests(user.id);
    setRequests(result.requests || []);
    setLoading(false);
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    
    setProcessing(true);
    const result = await changeRequestsService.approveRequest(
      selectedRequest.id,
      responseMessage || null
    );
    setProcessing(false);

    if (result.success) {
      showSuccess('Cambio aprobado exitosamente');
      setShowDetailModal(false);
      setSelectedRequest(null);
      setResponseMessage('');
      loadRequests();
    } else {
      showError('Error al aprobar el cambio');
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    
    setProcessing(true);
    const result = await changeRequestsService.rejectRequest(
      selectedRequest.id,
      responseMessage || null
    );
    setProcessing(false);

    if (result.success) {
      showSuccess('Cambio rechazado');
      setShowDetailModal(false);
      setSelectedRequest(null);
      setResponseMessage('');
      loadRequests();
    } else {
      showError('Error al rechazar el cambio');
    }
  };

  const openDetailModal = (request) => {
    setSelectedRequest(request);
    setShowDetailModal(true);
    setResponseMessage('');
  };

  const formatCurrency = (amount) => {
    return `${currency}${parseFloat(amount).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-AR', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const getActionLabel = (actionType) => {
    const labels = {
      create: '➕ Crear',
      update: '✏️ Modificar',
      delete: '🗑️ Eliminar',
      mark_paid: '✅ Marcar como pagada'
    };
    return labels[actionType] || actionType;
  };

  const getEntityLabel = (entityType) => {
    return entityType === 'debt' ? '💰 Deuda' : '💸 Gasto';
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Loading size="md" text="Cargando solicitudes..." />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <Card>
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>✅</span>
          <h3>No hay solicitudes pendientes</h3>
          <p>Cuando alguien solicite cambios en deudas o gastos compartidos, aparecerán aquí.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>Solicitudes Pendientes ({requests.length})</h3>
        <p className={styles.subtitle}>Aprobar o rechazar cambios propuestos por otros usuarios</p>
      </div>

      <div className={styles.requestsList}>
        {requests.map((request) => (
          <Card key={request.id} className={styles.requestCard}>
            <div className={styles.requestHeader}>
              <div className={styles.requestBadges}>
                <span className={styles.entityBadge}>
                  {getEntityLabel(request.entity_type)}
                </span>
                <span className={styles.actionBadge}>
                  {getActionLabel(request.action_type)}
                </span>
              </div>
              <span className={styles.requestDate}>
                {formatDate(request.created_at)}
              </span>
            </div>

            <div className={styles.requestBody}>
              <div className={styles.requesterInfo}>
                <div className={styles.requesterAvatar}>
                  {request.requester_first_name?.[0]}{request.requester_last_name?.[0]}
                </div>
                <div>
                  <div className={styles.requesterName}>
                    {request.requester_first_name} {request.requester_last_name}
                  </div>
                  <div className={styles.requesterNickname}>
                    @{request.requester_nickname}
                  </div>
                </div>
              </div>

              <div className={styles.requestSummary}>
                {request.entity_type === 'debt' && request.change_data?.description && (
                  <p className={styles.description}>
                    📝 {request.change_data.description}
                  </p>
                )}
                {request.change_data?.amount && (
                  <p className={styles.amount}>
                    💰 {formatCurrency(request.change_data.amount)}
                  </p>
                )}
                {request.reason && (
                  <p className={styles.reason}>
                    <strong>Motivo:</strong> {request.reason}
                  </p>
                )}
              </div>
            </div>

            <div className={styles.requestActions}>
              <Button 
                size="sm" 
                variant="secondary"
                onClick={() => openDetailModal(request)}
              >
                Ver Detalles
              </Button>
              <Button 
                size="sm" 
                variant="success"
                onClick={() => {
                  setSelectedRequest(request);
                  setResponseMessage('');
                  handleApprove();
                }}
              >
                ✓ Aprobar
              </Button>
              <Button 
                size="sm" 
                variant="danger"
                onClick={() => {
                  setSelectedRequest(request);
                  setResponseMessage('');
                  handleReject();
                }}
              >
                ✗ Rechazar
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Modal de detalle */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedRequest(null);
          setResponseMessage('');
        }}
        title="Detalle de Solicitud"
        size="md"
      >
        {selectedRequest && (
          <div className={styles.detailModal}>
            <div className={styles.detailSection}>
              <h4>Solicitante</h4>
              <div className={styles.userInfo}>
                <div className={styles.userAvatar}>
                  {selectedRequest.requester_first_name?.[0]}{selectedRequest.requester_last_name?.[0]}
                </div>
                <div>
                  <div>{selectedRequest.requester_first_name} {selectedRequest.requester_last_name}</div>
                  <div className={styles.userNickname}>@{selectedRequest.requester_nickname}</div>
                </div>
              </div>
            </div>

            <div className={styles.detailSection}>
              <h4>Acción Solicitada</h4>
              <p>
                {getActionLabel(selectedRequest.action_type)} una {selectedRequest.entity_type === 'debt' ? 'deuda' : 'gasto'}
              </p>
            </div>

            {selectedRequest.reason && (
              <div className={styles.detailSection}>
                <h4>Motivo</h4>
                <p>{selectedRequest.reason}</p>
              </div>
            )}

            <div className={styles.detailSection}>
              <h4>Cambios Propuestos</h4>
              <div className={styles.changeData}>
                {Object.entries(selectedRequest.change_data).map(([key, value]) => (
                  <div key={key} className={styles.changeItem}>
                    <span className={styles.changeKey}>{key}:</span>
                    <span className={styles.changeValue}>
                      {key === 'amount' ? formatCurrency(value) : 
                       key.includes('date') ? formatDate(value) : 
                       String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.detailSection}>
              <h4>Mensaje de Respuesta (opcional)</h4>
              <textarea
                className={styles.responseTextarea}
                placeholder="Escribe un mensaje para el solicitante..."
                value={responseMessage}
                onChange={(e) => setResponseMessage(e.target.value)}
                rows={3}
              />
            </div>

            <div className={styles.modalActions}>
              <Button 
                variant="secondary" 
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedRequest(null);
                  setResponseMessage('');
                }}
              >
                Cancelar
              </Button>
              <Button 
                variant="danger"
                onClick={handleReject}
                loading={processing}
              >
                Rechazar
              </Button>
              <Button 
                variant="success"
                onClick={handleApprove}
                loading={processing}
              >
                Aprobar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ChangeRequestsPanel;
