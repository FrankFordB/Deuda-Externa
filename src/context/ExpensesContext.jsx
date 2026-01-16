/**
 * Expenses Context - Manejo global de gastos
 * Versión ultra-simplificada
 */
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import expensesService from '../services/expensesService';

const ExpensesContext = createContext(null);

export const useExpenses = () => {
  const context = useContext(ExpensesContext);
  if (!context) {
    throw new Error('useExpenses debe usarse dentro de ExpensesProvider');
  }
  return context;
};

export const ExpensesProvider = ({ children }) => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [monthlyStats, setMonthlyStats] = useState(null);
  const [upcomingPayments, setUpcomingPayments] = useState({ payments: [], totalDue: 0, count: 0 });
  const [activeInstallments, setActiveInstallments] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  
  const loadingRef = useRef(false);
  const userIdRef = useRef(null);

  // Función de carga con timeout
  const loadExpenses = async (forceUserId = null) => {
    const userId = forceUserId || user?.id;
    if (!userId || loadingRef.current) return;
    
    loadingRef.current = true;
    setLoading(true);
    console.log('🚀 Iniciando carga de gastos...');
    
    // Timeout de 30 segundos
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout - Supabase no responde')), 30000)
    );
    
    try {
      // Solo cargar gastos primero (más simple)
      const expensesResult = await Promise.race([
        expensesService.getExpenses(userId, { month: selectedMonth, year: selectedYear }),
        timeoutPromise
      ]);
      
      console.log('✅ Gastos cargados:', expensesResult);
      setExpenses(expensesResult.expenses || []);
      
      // Cargar stats en paralelo pero sin bloquear
      Promise.all([
        expensesService.getMonthlyStats(userId, selectedYear, selectedMonth),
        expensesService.getUpcomingPayments(userId),
        expensesService.getActiveInstallments(userId)
      ]).then(([statsResult, paymentsResult, installmentsResult]) => {
        console.log('✅ Stats cargados');
        setMonthlyStats(statsResult?.stats || null);
        setUpcomingPayments(paymentsResult || { payments: [], totalDue: 0, count: 0 });
        setActiveInstallments(installmentsResult?.installments || {});
      }).catch(err => {
        console.warn('⚠️ Error cargando stats:', err);
      });
      
      setError(null);
    } catch (err) {
      console.error('❌ Error cargando gastos:', err);
      setError(err.message);
      setExpenses([]);
    } finally {
      setLoading(false);
      loadingRef.current = false;
      console.log('🏁 Carga finalizada');
    }
  };

  // Cargar solo cuando cambia el usuario
  useEffect(() => {
    if (user?.id && user.id !== userIdRef.current) {
      userIdRef.current = user.id;
      loadExpenses(user.id);
    } else if (!user?.id) {
      userIdRef.current = null;
      setExpenses([]);
      setMonthlyStats(null);
    }
  }, [user?.id]);

  // Cargar cuando cambia mes/año (solo si hay usuario)
  useEffect(() => {
    if (userIdRef.current) {
      loadExpenses(userIdRef.current);
    }
  }, [selectedMonth, selectedYear]);

  const createExpense = async (expenseData) => {
    if (!user) return { success: false };
    
    try {
      const result = await expensesService.createExpense({
        ...expenseData,
        userId: user.id
      });
      
      if (result.error) {
        return { success: false, error: result.error };
      }
      
      // Recargar
      loadingRef.current = false;
      await loadExpenses(user.id);
      return { success: true, expense: result.expense };
    } catch (err) {
      return { success: false, error: err };
    }
  };

  const markAsPaid = async (expenseId) => {
    try {
      const result = await expensesService.markExpenseAsPaid(expenseId);
      if (result.error) {
        return { success: false, error: result.error };
      }
      loadingRef.current = false;
      await loadExpenses(user?.id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err };
    }
  };

  const updateExpense = async (expenseId, updates) => {
    try {
      const result = await expensesService.updateExpense(expenseId, updates);
      if (result.error) {
        return { success: false, error: result.error };
      }
      loadingRef.current = false;
      await loadExpenses(user?.id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err };
    }
  };

  const deleteExpense = async (expenseId) => {
    try {
      const result = await expensesService.deleteExpense(expenseId);
      if (result.error) {
        return { success: false, error: result.error };
      }
      loadingRef.current = false;
      await loadExpenses(user?.id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err };
    }
  };

  const value = {
    expenses,
    monthlyStats,
    upcomingPayments,
    activeInstallments,
    loading,
    error,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
    createExpense,
    markAsPaid,
    updateExpense,
    deleteExpense,
    refreshExpenses: () => { loadingRef.current = false; loadExpenses(user?.id); },
    categories: expensesService.EXPENSE_CATEGORIES,
    paymentSources: expensesService.PAYMENT_SOURCES
  };

  return (
    <ExpensesContext.Provider value={value}>
      {children}
    </ExpensesContext.Provider>
  );
};

export default ExpensesContext;
