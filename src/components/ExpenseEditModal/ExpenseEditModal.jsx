/**
 * Expense Edit Modal - Modal para editar gastos con lógica de aprobación
 */
import { useState, useEffect } from 'react';
import { Modal, Button, Input, Select } from '../';
import { useAuth, useFriends, useUI } from '../../context';
import expensesService from '../../services/expensesService';
import virtualFriendsService from '../../services/virtualFriendsService';
import styles from './ExpenseEditModal.module.css';

const ExpenseEditModal = ({ isOpen, onClose, expense, onSuccess }) => {
  const { user } = useAuth();
  const { friends } = useFriends();
  const { showSuccess, showError, siteConfig } = useUI();
  const [loading, setLoading] = useState(false);
  const [virtualFriends, setVirtualFriends] = useState([]);
  const [pendingApproval, setPendingApproval] = useState(false);
  
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    category: '',
    paymentSource: '',
    friendId: '',
    friendType: 'real',
    date: '',
    isPaid: false
  });

  // Cargar amigos virtuales
  useEffect(() => {
    if (!user) return;
    const loadVirtualFriends = async () => {
      const result = await virtualFriendsService.getVirtualFriends(user.id);
      if (!result.error) {
        setVirtualFriends(result.friends || []);
      }
    };
    loadVirtualFriends();
  }, [user]);

  // Cargar datos del gasto
  useEffect(() => {
    if (expense) {
      setFormData({
        amount: expense.amount.toString(),
        description: expense.description || '',
        category: expense.category || '',
        paymentSource: expense.payment_source || '',
        friendId: expense.friend_id || '',
        friendType: expense.friend_type || 'real',
        date: expense.date || '',
        isPaid: expense.is_paid || false
      });
    }
  }, [expense]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setPendingApproval(false);

    const updates = {
      amount: parseFloat(formData.amount),
      description: formData.description,
      category: formData.category,
      payment_source: formData.paymentSource,
      friend_id: formData.paymentSource === 'friend' ? formData.friendId : null,
      friend_type: formData.friendType,
      date: formData.date,
      is_paid: formData.isPaid
    };

    // Determinar si es amigo virtual o real
    const isVirtualFriend = formData.friendType === 'virtual' || 
                           (formData.friendId && virtualFriends.some(f => f.id === formData.friendId));

    const result = await expensesService.updateExpense(
      expense.id,
      updates,
      isVirtualFriend ? 'virtual' : 'real',
      formData.friendId,
      user.id
    );

    setLoading(false);

    if (result.error) {
      showError('Error al actualizar el gasto');
      return;
    }

    if (result.needsApproval) {
      setPendingApproval(true);
      showSuccess('Solicitud de cambio enviada. Esperando confirmación del amigo.');
      setTimeout(() => {
        onClose();
        if (onSuccess) onSuccess();
      }, 2000);
    } else {
      showSuccess('Gasto actualizado exitosamente');
      onClose();
      if (onSuccess) onSuccess();
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('¿Estás seguro de eliminar este gasto?')) {
      return;
    }

    setLoading(true);

    const isVirtualFriend = formData.friendType === 'virtual' || 
                           (formData.friendId && virtualFriends.some(f => f.id === formData.friendId));

    const result = await expensesService.deleteExpense(
      expense.id,
      isVirtualFriend ? 'virtual' : 'real',
      formData.friendId,
      user.id
    );

    setLoading(false);

    if (result.error) {
      showError('Error al eliminar el gasto');
      return;
    }

    if (result.needsApproval) {
      showSuccess('Solicitud de eliminación enviada. Esperando confirmación.');
      setTimeout(() => {
        onClose();
        if (onSuccess) onSuccess();
      }, 2000);
    } else {
      showSuccess('Gasto eliminado exitosamente');
      onClose();
      if (onSuccess) onSuccess();
    }
  };

  if (!expense) return null;

  const currency = siteConfig?.currency || '$';
  const category = expensesService.EXPENSE_CATEGORIES.find(c => c.id === formData.category);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="✏️ Editar Gasto"
      size="md"
    >
      <div className={styles.modalContent}>
        {/* Información del gasto */}
        <div className={styles.expenseInfo}>
          <div className={styles.expenseHeader}>
            <span className={styles.expenseIcon}>
              {category?.icon || '📦'}
            </span>
            <div className={styles.expenseDetails}>
              <h3>{expense.description}</h3>
              <p>{currency}{expense.amount.toLocaleString('es-AR')}</p>
            </div>
            {expense.installments > 1 && (
              <span className={styles.installmentBadge}>
                {expense.installment_number || 1}/{expense.installments}
              </span>
            )}
          </div>
          
          {formData.friendId && (
            <div className={styles.friendInfo}>
              <span className={styles.friendLabel}>
                {formData.friendType === 'virtual' ? '👤' : '👥'} 
                {' '}
                {formData.friendType === 'virtual' ? 'Contacto Ficticio' : 'Amigo Real'}
              </span>
            </div>
          )}
        </div>

        {pendingApproval ? (
          <div className={styles.pendingMessage}>
            <div className={styles.pendingIcon}>⏳</div>
            <div className={styles.pendingText}>
              <h4>Esperando Confirmación</h4>
              <p>Se ha enviado una solicitud de cambio a tu amigo. Recibirás una notificación cuando responda.</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <Input
              label="Monto"
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              required
              step="0.01"
              min="0"
            />

            <Input
              label="Descripción"
              type="text"
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
            />

            <Select
              label="Categoría"
              name="category"
              value={formData.category}
              onChange={handleChange}
              options={expensesService.EXPENSE_CATEGORIES.map(c => ({
                value: c.id,
                label: `${c.icon} ${c.label}`
              }))}
              required
            />

            <Select
              label="Fuente de pago"
              name="paymentSource"
              value={formData.paymentSource}
              onChange={handleChange}
              options={expensesService.PAYMENT_SOURCES.map(p => ({
                value: p.id,
                label: `${p.icon} ${p.label}`
              }))}
              required
            />

            {formData.paymentSource === 'friend' && (
              <>
                <Select
                  label="Tipo de amigo"
                  name="friendType"
                  value={formData.friendType}
                  onChange={handleChange}
                  options={[
                    { value: 'real', label: '👥 Amigo Real' },
                    { value: 'virtual', label: '👤 Contacto Ficticio' }
                  ]}
                />

                <Select
                  label={formData.friendType === 'real' ? 'Amigo' : 'Contacto'}
                  name="friendId"
                  value={formData.friendId}
                  onChange={handleChange}
                  options={
                    formData.friendType === 'real'
                      ? friends.map(f => ({
                          value: f.id,
                          label: `${f.first_name} ${f.last_name || ''}`
                        }))
                      : virtualFriends.map(f => ({
                          value: f.id,
                          label: f.name
                        }))
                  }
                  required
                />
              </>
            )}

            <Input
              label="Fecha"
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              required
            />

            <label className={styles.checkbox}>
              <input
                type="checkbox"
                name="isPaid"
                checked={formData.isPaid}
                onChange={handleChange}
              />
              <span>Ya está pagado</span>
            </label>

            {formData.friendId && formData.friendType === 'real' && (
              <div className={styles.approvalWarning}>
                <span className={styles.warningIcon}>⚠️</span>
                <span>Los cambios en gastos con amigos reales requieren aprobación</span>
              </div>
            )}

            <div className={styles.formActions}>
              <Button 
                type="button" 
                variant="danger" 
                onClick={handleDelete}
                loading={loading}
              >
                🗑️ Eliminar
              </Button>
              <div className={styles.rightActions}>
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={onClose}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  loading={loading}
                >
                  Guardar
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};

export default ExpenseEditModal;
