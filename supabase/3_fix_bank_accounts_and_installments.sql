-- ============================================
-- SCRIPT 3: Bank Accounts + Cuotas + updated_at
-- ============================================

-- ===================================================
-- PARTE 1: Fix tabla debt_installments (updated_at)
-- ===================================================

-- Agregar columna updated_at a debt_installments si no existe
ALTER TABLE debt_installments 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Función genérica para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger para debt_installments
DROP TRIGGER IF EXISTS update_debt_installments_updated_at ON debt_installments;
CREATE TRIGGER update_debt_installments_updated_at
  BEFORE UPDATE ON debt_installments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===================================================
-- PARTE 2: Fix Triggers de Bank Accounts
-- ===================================================

-- Función para actualizar balance (incluye gastos pendientes)
CREATE OR REPLACE FUNCTION update_account_balance(account_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_expenses DECIMAL(15,2);
  total_debts DECIMAL(15,2);
  total_income DECIMAL(15,2);
  initial_bal DECIMAL(15,2);
BEGIN
  -- Obtener balance inicial
  SELECT initial_balance INTO initial_bal
  FROM bank_accounts
  WHERE id = account_id;
  
  -- Calcular total de TODOS los gastos (pagados Y pendientes)
  SELECT COALESCE(SUM(amount), 0) INTO total_expenses
  FROM expenses
  WHERE bank_account_id = account_id;
  
  -- Calcular total de todas las deudas
  SELECT COALESCE(SUM(amount), 0) INTO total_debts
  FROM debts
  WHERE bank_account_id = account_id;
  
  -- Calcular ingresos vinculados a esta cuenta
  SELECT COALESCE(SUM(amount), 0) INTO total_income
  FROM monthly_incomes
  WHERE bank_account_id = account_id;
  
  -- Actualizar balance: inicial + ingresos - gastos - deudas
  UPDATE bank_accounts
  SET 
    current_balance = initial_bal + total_income - total_expenses - total_debts,
    updated_at = NOW()
  WHERE id = account_id;
END;
$$;

-- Trigger para actualizar balance automáticamente
CREATE OR REPLACE FUNCTION trigger_update_account_on_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Si el gasto tiene cuenta bancaria asignada, actualizar balance
  IF NEW.bank_account_id IS NOT NULL THEN
    PERFORM update_account_balance(NEW.bank_account_id);
  END IF;
  
  -- Si cambió de cuenta, actualizar la cuenta anterior también
  IF TG_OP = 'UPDATE' AND OLD.bank_account_id IS DISTINCT FROM NEW.bank_account_id THEN
    IF OLD.bank_account_id IS NOT NULL THEN
      PERFORM update_account_balance(OLD.bank_account_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_expense_paid ON public.expenses;
CREATE TRIGGER on_expense_paid
  AFTER INSERT OR UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_account_on_expense();

-- ===================================================
-- PARTE 3: Agregar paid_installments a debts
-- ===================================================

-- Agregar columna para contar cuotas pagadas
ALTER TABLE debts 
ADD COLUMN IF NOT EXISTS paid_installments INTEGER DEFAULT 0;

-- Función para actualizar cuotas pagadas
CREATE OR REPLACE FUNCTION update_debt_paid_installments(debt_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  paid_count INTEGER;
BEGIN
  -- Contar cuotas pagadas de debt_installments
  SELECT COUNT(*)
  INTO paid_count
  FROM debt_installments
  WHERE debt_id = debt_id_param AND paid = true;
  
  -- Actualizar la deuda
  UPDATE debts
  SET 
    paid_installments = paid_count,
    updated_at = NOW()
  WHERE id = debt_id_param;
END;
$$;

-- Trigger para actualizar paid_installments automáticamente
CREATE OR REPLACE FUNCTION trigger_update_debt_installments()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Cuando cambia el estado paid de una cuota, actualizar la deuda
  IF TG_OP = 'INSERT' OR OLD.paid IS DISTINCT FROM NEW.paid THEN
    PERFORM update_debt_paid_installments(NEW.debt_id);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_debt_installment_paid_update_debt ON public.debt_installments;
CREATE TRIGGER on_debt_installment_paid_update_debt
  AFTER INSERT OR UPDATE OF paid ON public.debt_installments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_debt_installments();

-- ===================================================
-- PARTE 4: Recalcular datos existentes
-- ===================================================

-- Recalcular paid_installments para todas las deudas
UPDATE debts d
SET paid_installments = (
  SELECT COUNT(*)
  FROM debt_installments di
  WHERE di.debt_id = d.id AND di.paid = true
)
WHERE d.installments > 1;

-- Recalcular balance de todas las cuentas
DO $$
DECLARE
  account RECORD;
BEGIN
  FOR account IN SELECT id FROM bank_accounts
  LOOP
    PERFORM update_account_balance(account.id);
  END LOOP;
  RAISE NOTICE '✅ Balances recalculados';
END $$;

-- ===================================================
-- VERIFICACIÓN
-- ===================================================

SELECT 
  'Verificación de columnas' as test,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'debt_installments' AND column_name = 'updated_at')
    OR (table_name = 'debts' AND column_name = 'paid_installments')
  )
ORDER BY table_name, column_name;

SELECT 
  'Verificación de triggers' as test,
  trigger_name,
  event_object_table
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('expenses', 'debt_installments', 'bank_accounts')
ORDER BY event_object_table, trigger_name;

-- ===================================================
-- MENSAJE FINAL
-- ===================================================

DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ SISTEMA COMPLETO ACTUALIZADO';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Cambios aplicados:';
  RAISE NOTICE '  ✓ Columna updated_at en debt_installments';
  RAISE NOTICE '  ✓ Bank accounts restan gastos pendientes';
  RAISE NOTICE '  ✓ Columna paid_installments en debts';
  RAISE NOTICE '  ✓ Triggers automáticos instalados';
  RAISE NOTICE '  ✓ Balances recalculados';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANTE: Habilitar Realtime en Supabase';
  RAISE NOTICE '   Dashboard → Database → Replication';
  RAISE NOTICE '   Activar para: notifications, debts, friends';
  RAISE NOTICE '========================================';
END $$;
