/**
 * Debts Context - Manejo global de deudas
 * Versión ultra-simplificada
 */
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import debtsService from '../services/debtsService';import { supabase } from '../services/supabase';
const DebtsContext = createContext(null);

export const useDebts = () => {
  const context = useContext(DebtsContext);
  if (!context) {
    throw new Error('useDebts debe usarse dentro de DebtsProvider');
  }
  return context;
};

export const DebtsProvider = ({ children }) => {
  const { user } = useAuth();
  const [debtsAsCreditor, setDebtsAsCreditor] = useState([]);
  const [debtsAsDebtor, setDebtsAsDebtor] = useState([]);
  const [summary, setSummary] = useState(null);
  const [debtsByFriend, setDebtsByFriend] = useState([]);
  const [pendingDebtsCount, setPendingDebtsCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadingRef = useRef(false);
  const userIdRef = useRef(null);

  const loadDebts = async (forceUserId = null) => {
    const userId = forceUserId || user?.id;
    if (!userId || loadingRef.current) return;
    
    loadingRef.current = true;
    setLoading(true);
    
    try {
      const [creditorResult, debtorResult, summaryResult, byFriendResult] = await Promise.all([
        debtsService.getDebtsAsCreditor(userId),
        debtsService.getDebtsAsDebtor(userId),
        debtsService.getDebtsSummary(userId),
        debtsService.getDebtsByFriend(userId)
      ]);

      setDebtsAsCreditor(creditorResult.debts || []);
      setDebtsAsDebtor(debtorResult.debts || []);
      setSummary(summaryResult.summary || null);
      setDebtsByFriend(byFriendResult.debtsByFriend || []);
      
      // Calcular deudas pendientes (que me deben y no están pagadas)
      const pendingCount = (creditorResult.debts || []).filter(debt => 
        debt.status === 'pending' || debt.status === 'partial'
      ).length;
      setPendingDebtsCount(pendingCount);
      
      setError(null);
    } catch (err) {
      console.error('Error cargando deudas:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  useEffect(() => {
    // Cargar inmediatamente sin timeout
    if (user?.id && user.id !== userIdRef.current) {
      userIdRef.current = user.id;
      loadDebts(user.id);
    } else if (!user?.id) {
      userIdRef.current = null;
      setDebtsAsCreditor([]);
      setDebtsAsDebtor([]);
      setSummary(null);
      setPendingDebtsCount(0);
    }
  }, [user?.id]);

  // Real-time subscription para debts
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('debts-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'debts',
          filter: `creditor_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            // Recargar deudas cuando hay cambios
            loadingRef.current = false;
            loadDebts(user.id);
          } else if (payload.eventType === 'DELETE') {
            // Actualizar la lista
            setDebtsAsCreditor(prev => prev.filter(debt => debt.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const createDebt = async (debtData) => {
    if (!user) return { success: false };
    
    try {
      // NO sobrescribir creditorId ni debtorId - vienen correctos desde Debts.jsx
      const result = await debtsService.createDebt(debtData);
      
      if (result.error) {
        return { success: false, error: result.error };
      }
      
      // Recargar inmediatamente sin respetar el flag de loading
      loadingRef.current = false;
      await loadDebts(user.id);
      
      return { success: true, debt: result.debt };
    } catch (err) {
      return { success: false, error: err };
    }
  };

  const acceptDebt = async (debtId) => {
    if (!user) return { success: false };
    
    try {
      const result = await debtsService.acceptDebt(debtId, user.id);
      if (result.error) {
        return { success: false, error: result.error };
      }
      loadingRef.current = false;
      await loadDebts(user.id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err };
    }
  };

  const rejectDebt = async (debtId) => {
    try {
      const result = await debtsService.rejectDebt(debtId);
      if (result.error) {
        return { success: false, error: result.error };
      }
      loadingRef.current = false;
      await loadDebts(user?.id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err };
    }
  };

  const markAsPaid = async (debtId, markedByCreditor = false) => {
    try {
      const result = await debtsService.markDebtAsPaid(debtId, markedByCreditor);
      if (result.error) {
        return { success: false, error: result.error };
      }
      loadingRef.current = false;
      await loadDebts(user?.id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err };
    }
  };

  const pendingDebts = debtsAsDebtor.filter(d => d.status === 'pending');

  const value = {
    debtsAsCreditor,
    debtsAsDebtor,
    pendingDebts,
    summary,
    debtsByFriend,
    loading,
    error,
    pendingCount: pendingDebts.length,
    createDebt,
    acceptDebt,
    rejectDebt,
    markAsPaid,
    pendingDebtsCount,
    refreshDebts: () => { loadingRef.current = false; loadDebts(user?.id); },
    // Funciones helper para multi-moneda
    getDebtsByCurrency: (currency) => {
      if (!currency) return [...debtsAsCreditor, ...debtsAsDebtor];
      return [...debtsAsCreditor, ...debtsAsDebtor].filter(debt => debt.currency === currency);
    },
    getAvailableCurrencies: () => {
      const currencies = new Set(
        [...debtsAsCreditor, ...debtsAsDebtor]
          .map(d => d.currency)
          .filter(Boolean)
      );
      return Array.from(currencies);
    },
    getSummaryByCurrency: (currency) => {
      const filteredCreditor = debtsAsCreditor.filter(d => d.currency === currency);
      const filteredDebtor = debtsAsDebtor.filter(d => d.currency === currency);
      
      return {
        totalOwedToMe: filteredCreditor
          .filter(d => d.status === 'accepted')
          .reduce((sum, d) => sum + parseFloat(d.amount || 0), 0),
        totalIOwe: filteredDebtor
          .filter(d => d.status === 'accepted')
          .reduce((sum, d) => sum + parseFloat(d.amount || 0), 0),
        countOwedToMe: filteredCreditor.filter(d => d.status === 'accepted').length,
        countIOwe: filteredDebtor.filter(d => d.status === 'accepted').length
      };
    }
  };

  return (
    <DebtsContext.Provider value={value}>
      {children}
    </DebtsContext.Provider>
  );
};

export default DebtsContext;
