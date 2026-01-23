/**
 * BankAccountsPanel - Panel lateral de cuentas bancarias
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context';
import { bankAccountsService } from '../../services';
import { supabase } from '../../services/supabase';
import { Button, Modal, Input, Select, CurrencySelect, CURRENCIES } from '../../components';
import { Plus, ChevronDown, ChevronUp, CreditCard, Wallet } from 'lucide-react';
import styles from './BankAccountsPanel.module.css';

const BankAccountsPanel = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('all');
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

  // Obtener monedas disponibles
  const availableCurrencies = useMemo(() => {
    const currencies = [...new Set(accounts.map(a => a.currency))];
    return currencies;
  }, [accounts]);

  // Filtrar cuentas por moneda seleccionada
  const filteredAccounts = useMemo(() => {
    if (selectedCurrency === 'all') return accounts;
    return accounts.filter(a => a.currency === selectedCurrency);
  }, [accounts, selectedCurrency]);

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
      <div 
        className={styles.header}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className={styles.headerLeft}>
          <CreditCard size={20} />
          <h3 className={styles.title}>Mis Cuentas</h3>
          <span className={styles.accountCount}>({accounts.length})</span>
        </div>
        <div className={styles.headerRight}>
          {accounts.length < 4 && (
            <Button 
              size="sm" 
              onClick={(e) => {
                e.stopPropagation();
                setShowModal(true);
              }}
              icon={<Plus size={16} />}
            >
              Nueva
            </Button>
          )}
          <button className={styles.expandBtn}>
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Filtros de moneda */}
          {availableCurrencies.length > 1 && (
            <div className={styles.currencyFilters}>
              <button
                className={`${styles.currencyBtn} ${selectedCurrency === 'all' ? styles.active : ''}`}
                onClick={() => setSelectedCurrency('all')}
              >
                <Wallet size={14} />
                Todas
              </button>
              {availableCurrencies.map(currency => {
                const currencyData = CURRENCIES.find(c => c.value === currency);
                return (
                  <button
                    key={currency}
                    className={`${styles.currencyBtn} ${selectedCurrency === currency ? styles.active : ''}`}
                    onClick={() => setSelectedCurrency(currency)}
                  >
                    {currencyData?.symbol || currency}
                    {currency}
                  </button>
                );
              })}
            </div>
          )}

          <div className={styles.accountsList}>
            {filteredAccounts.length === 0 ? (
              <div className={styles.empty}>
                <p className={styles.emptyIcon}><Wallet size={48} /></p>
                <p className={styles.emptyText}>
                  {accounts.length === 0 ? 'No tienes cuentas' : 'No hay cuentas en esta moneda'}
                </p>
                {accounts.length === 0 && (
                  <Button onClick={() => setShowModal(true)} size="sm">
                    Crear primera cuenta
                  </Button>
                )}
              </div>
            ) : (
              filteredAccounts.map(account => (
                <div 
                  key={account.id} 
                  className={styles.accountCard}
                  data-currency={account.currency}
                  onClick={() => openAccountDetail(account.id, account.currency)}
                >
                  <div className={styles.accountHeader}>
                    <span className={styles.accountCurrency}>
                      {CURRENCIES.find(c => c.value === account.currency)?.symbol || account.currency_symbol}
                    </span>
                    <span className={styles.accountName}>{account.name}</span>
                  </div>
                  <div className={styles.accountBalance}>
                    <span className={styles.balanceLabel}>Balance disponible</span>
                    <span className={`${styles.balanceAmount} ${account.current_balance < 0 ? styles.negative : ''}`}>
                      {account.currency_symbol}{account.current_balance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Resumen colapsado - muestra cada cuenta */}
      {!isExpanded && accounts.length > 0 && (
        <div className={styles.collapsedSummary}>
          {accounts.map(account => {
            const currencyData = CURRENCIES.find(c => c.value === account.currency);
            return (
              <div 
                key={account.id} 
                className={styles.summaryItem}
                onClick={() => openAccountDetail(account.id, account.currency)}
                style={{ cursor: 'pointer' }}
              >
                <span className={styles.summaryLabel}>{account.name}</span>
                <span className={`${styles.summaryValue} ${account.current_balance < 0 ? styles.negative : ''}`}>
                  {currencyData?.symbol || account.currency_symbol}{account.current_balance.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            );
          })}
        </div>
      )}

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
