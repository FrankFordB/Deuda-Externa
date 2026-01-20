/**
 * BankAccountsPanel - Panel lateral de cuentas bancarias
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context';
import { bankAccountsService } from '../../services';
import { supabase } from '../../services/supabase';
import { Button, Modal, Input, Select, CurrencySelect, CURRENCIES } from '../../components';
import styles from './BankAccountsPanel.module.css';

const BankAccountsPanel = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    currency: 'ARS',
    currency_symbol: '$',
    initial_balance: ''
  });
  const [saving, setSaving] = useState(false);

  const loadAccounts = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    const { accounts: data } = await bankAccountsService.getUserAccounts(user.id);
    setAccounts(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Suscripción en tiempo real para actualizar cuentas cuando cambien
  useEffect(() => {
    if (!user) return;

    // Suscribirse a cambios en bank_accounts
    const accountsSubscription = supabase
      .channel('bank_accounts_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bank_accounts',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🏦 Cambio en cuenta bancaria:', payload);
          // Recargar todas las cuentas cuando hay un cambio
          loadAccounts();
        }
      )
      .subscribe();

    // Suscribirse a cambios en expenses para actualizar balance
    const expensesSubscription = supabase
      .channel('expenses_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expenses',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('💸 Cambio en gasto:', payload);
          // Si el gasto tiene bank_account_id, recargar cuentas
          if (payload.new?.bank_account_id || payload.old?.bank_account_id) {
            loadAccounts();
          }
        }
      )
      .subscribe();

    // Cleanup al desmontar
    return () => {
      accountsSubscription.unsubscribe();
      expensesSubscription.unsubscribe();
    };
  }, [user, loadAccounts]);

  const handleCurrencyChange = (e) => {
    const currencyCode = e.target.value;
    const currency = CURRENCIES.find(c => c.value === currencyCode);
    setFormData(prev => ({
      ...prev,
      currency: currencyCode,
      currency_symbol: currency?.symbol || '$'
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const { account, error } = await bankAccountsService.createAccount(user.id, formData);

    if (!error) {
      setAccounts(prev => [...prev, account]);
      setShowModal(false);
      setFormData({
        name: '',
        currency: 'ARS',
        currency_symbol: '$',
        initial_balance: ''
      });
    } else {
      alert(error);
    }

    setSaving(false);
  };

  const openAccountDetail = (accountId, currency) => {
    navigate(`/account/${accountId}`, { state: { currency } });
  };

  if (loading) {
    return <div className={styles.loading}>Cargando cuentas...</div>;
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>💳 Mis Cuentas</h3>
        {accounts.length < 4 && (
          <Button 
            size="sm" 
            onClick={() => setShowModal(true)}
            icon="➕"
          >
            Nueva
          </Button>
        )}
      </div>

      <div className={styles.accountsList}>
        {accounts.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyIcon}>💰</p>
            <p className={styles.emptyText}>No tienes cuentas</p>
            <Button onClick={() => setShowModal(true)} size="sm">
              Crear primera cuenta
            </Button>
          </div>
        ) : (
          accounts.map(account => (
            <div 
              key={account.id} 
              className={styles.accountCard}
              onClick={() => openAccountDetail(account.id, account.currency)}
            >
              <div className={styles.accountHeader}>
                <span className={styles.accountCurrency}>
                  {CURRENCIES.find(c => c.value === account.currency)?.label.split(' ')[2] || account.currency}
                </span>
                <span className={styles.accountName}>{account.name}</span>
              </div>
              <div className={styles.accountBalance}>
                <span className={styles.balanceLabel}>Balance</span>
                <span className={`${styles.balanceAmount} ${account.current_balance < 0 ? styles.negative : ''}`}>
                  {account.currency_symbol}{account.current_balance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Nueva Cuenta Bancaria"
      >
        <form onSubmit={handleSubmit} className={styles.form}>
          <Input
            label="Nombre de la cuenta"
            name="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Ej: Cuenta Sueldo, Ahorros USD"
            required
          />

          <CurrencySelect
            value={formData.currency}
            onChange={handleCurrencyChange}
            label="Moneda"
          />

          <Input
            label="Balance Inicial"
            name="initial_balance"
            type="number"
            step="0.01"
            value={formData.initial_balance}
            onChange={(e) => setFormData(prev => ({ ...prev, initial_balance: e.target.value }))}
            placeholder="0.00"
            required
          />

          <div className={styles.modalActions}>
            <Button 
              type="button" 
              variant="secondary" 
              onClick={() => setShowModal(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={saving}
            >
              {saving ? 'Creando...' : 'Crear Cuenta'}
            </Button>
          </div>

          {accounts.length >= 3 && (
            <p className={styles.hint}>
              ⚠️ Solo puedes tener máximo 4 cuentas
            </p>
          )}
        </form>
      </Modal>
    </div>
  );
};

export default BankAccountsPanel;
