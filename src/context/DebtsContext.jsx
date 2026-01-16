/**
 * Debts Context - Manejo global de deudas
 * Versión ultra-simplificada
 */
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import debtsService from '../services/debtsService';

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
    if (user?.id && user.id !== userIdRef.current) {
      userIdRef.current = user.id;
      loadDebts(user.id);
    } else if (!user?.id) {
      userIdRef.current = null;
      setDebtsAsCreditor([]);
      setDebtsAsDebtor([]);
      setSummary(null);
    }
  }, [user?.id]);

  const createDebt = async (debtData) => {
    if (!user) return { success: false };
    
    try {
      const result = await debtsService.createDebt({
        ...debtData,
        creditorId: user.id
      });
      
      if (result.error) {
        return { success: false, error: result.error };
      }
      
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

  const markAsPaid = async (debtId) => {
    try {
      const result = await debtsService.markDebtAsPaid(debtId);
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
    refreshDebts: () => { loadingRef.current = false; loadDebts(user?.id); }
  };

  return (
    <DebtsContext.Provider value={value}>
      {children}
    </DebtsContext.Provider>
  );
};

export default DebtsContext;
