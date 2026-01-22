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

  // Función de carga simplificada sin timeout
  const loadExpenses = async (forceUserId = null) => {
    const userId = forceUserId || user?.id;
    if (!userId || loadingRef.current) return;
    
    console.log('🔄 Cargando gastos para usuario:', userId, { month: selectedMonth, year: selectedYear });
    loadingRef.current = true;
    setLoading(true);
    const startTime = performance.now();
    
    try {
      // Cargar gastos primero (más importante)
      const expensesResult = await expensesService.getExpenses(userId, { 
        month: selectedMonth, 
        year: selectedYear 
      });
      console.log(`⏱️ getExpenses tardó: ${(performance.now() - startTime).toFixed(2)}ms - Gastos encontrados: ${expensesResult.expenses?.length || 0}`);
      
      setExpenses(expensesResult.expenses || []);
      
      // Cargar stats en paralelo sin bloquear
      Promise.all([
        expensesService.getMonthlyStats(userId, selectedYear, selectedMonth),
        expensesService.getUpcomingPayments(userId).catch(() => ({ payments: [], totalDue: 0, count: 0 })),
        expensesService.getActiveInstallments(userId).catch(() => ({ installments: {} }))
      ]).then(([statsResult, paymentsResult, installmentsResult]) => {
        setMonthlyStats(statsResult?.stats || null);
        setUpcomingPayments(paymentsResult || { payments: [], totalDue: 0, count: 0 });
        setActiveInstallments(installmentsResult?.installments || {});
      }).catch(err => {
        console.warn('Error cargando stats adicionales:', err);
      });
      
      setError(null);
      console.log('✅ Gastos cargados correctamente:', expenses.length);
    } catch (err) {
      console.error('❌ Error cargando gastos:', err);
      setError(err.message);
      setExpenses([]);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  // Cargar solo cuando cambia el usuario (sin delay, es crítico)
  useEffect(() => {
    if (user?.id && user.id !== userIdRef.current) {
      userIdRef.current = user.id;
      // Sin timeout - cargar inmediatamente
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
      
      // Recargar inmediatamente sin respetar el flag de loading
      const prevLoadingFlag = loadingRef.current;
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

  // Función para obtener estadísticas de un mes específico
  const getMonthlyStats = async (month, year) => {
    if (!user?.id) return null;
    try {
      const result = await expensesService.getMonthlyStats(user.id, year, month);
      return result.stats;
    } catch (err) {
      console.error('Error obteniendo stats mensuales:', err);
      return null;
    }
  };

  // Función helper para filtrar gastos por moneda
  const getExpensesByCurrency = (currency) => {
    if (!currency) return expenses;
    return expenses.filter(expense => expense.currency === currency);
  };

  // Función helper para obtener monedas únicas
  const getAvailableCurrencies = () => {
    const currencies = new Set(expenses.map(e => e.currency).filter(Boolean));
    return Array.from(currencies);
  };

  // Helper: obtener monto real de un gasto (ya viene correcto en cuotas nuevas)
  const getExpenseAmount = (expense) => {
    return parseFloat(expense.amount || 0);
  };

  // Función para calcular stats por moneda
  const getStatsByCurrency = (currency) => {
    const filteredExpenses = getExpensesByCurrency(currency);
    const totalSpent = filteredExpenses
      .filter(e => e.is_paid)
      .reduce((sum, e) => sum + getExpenseAmount(e), 0);
    const totalPending = filteredExpenses
      .filter(e => !e.is_paid)
      .reduce((sum, e) => sum + getExpenseAmount(e), 0);
    
    return {
      totalSpent,
      totalPending,
      count: filteredExpenses.length,
      paidCount: filteredExpenses.filter(e => e.is_paid).length,
      pendingCount: filteredExpenses.filter(e => !e.is_paid).length
    };
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
    getMonthlyStats,
    getExpensesByCurrency,
    getAvailableCurrencies,
    getStatsByCurrency,
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
