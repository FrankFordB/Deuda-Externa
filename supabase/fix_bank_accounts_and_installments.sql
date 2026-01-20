-- ============================================
-- SOLUCIÓN COMPLETA: Bank Accounts + Cuotas
-- ============================================

-- PROBLEMA 1: Las cuentas bancarias no restan cuando se crea un gasto pendiente
-- PROBLEMA 2: AccountDetail no muestra gastos ni saldo disponible  
-- PROBLEMA 3: Las cuotas no se marcan como "pagadas" cuando se confirman

-- ===================================================
-- PARTE 1: Fix Triggers de Bank Accounts
-- ===================================================

-- Modificar trigger para restar SIEMPRE (pagado o pendiente)
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

-- Modificar función de cálculo de balance para incluir gastos pendientes
-- ACTUALIZADO: Solo cuenta gastos/deudas/ingresos de la MISMA MONEDA
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
  account_currency TEXT;
BEGIN
  -- Obtener balance inicial y moneda de la cuenta
  SELECT initial_balance, currency INTO initial_bal, account_currency
  FROM bank_accounts
  WHERE id = account_id;
  
  -- Calcular total de TODOS los gastos (pagados Y pendientes) DE LA MISMA MONEDA
  SELECT COALESCE(SUM(amount), 0) INTO total_expenses
  FROM expenses
  WHERE bank_account_id = account_id
    AND currency = account_currency;
  
  -- Calcular total de todas las deudas (pagadas Y pendientes) DE LA MISMA MONEDA
  SELECT COALESCE(SUM(amount), 0) INTO total_debts
  FROM debts
  WHERE bank_account_id = account_id
    AND currency = account_currency;
  
  -- Calcular ingresos vinculados a esta cuenta
  -- NOTA: monthly_incomes no tiene columna currency, por lo que se asume que coincide con la cuenta
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

-- ===================================================
-- PARTE 2: Fix tabla debt_installments y agregar paid_installments
-- ===================================================

-- Agregar columna updated_at a debt_installments si no existe
ALTER TABLE debt_installments 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Agregar trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_debt_installments_updated_at ON debt_installments;
CREATE TRIGGER update_debt_installments_updated_at
  BEFORE UPDATE ON debt_installments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Agregar columna para contar cuotas pagadas
ALTER TABLE debts 
ADD COLUMN IF NOT EXISTS paid_installments INTEGER DEFAULT 0;

-- Función para actualizar cuotas pagadas de una deuda
CREATE OR REPLACE FUNCTION update_debt_paid_installments(debt_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  paid_count INTEGER;
BEGIN
  -- Contar cuántos expenses relacionados están pagados
  SELECT COUNT(*)
  INTO paid_count
  FROM expenses
  WHERE debt_id = debt_id_param AND is_paid = true;
  
  -- Actualizar la deuda
  UPDATE debts
  SET 
    paid_installments = paid_count,
    updated_at = NOW()
  WHERE id = debt_id_param;
END;
$$;

-- Trigger para actualizar paid_installments cuando se paga un expense relacionado
CREATE OR REPLACE FUNCTION trigger_update_debt_installments()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Si el expense tiene debt_id y cambió is_paid, actualizar la deuda
  IF NEW.debt_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.is_paid IS DISTINCT FROM NEW.is_paid) THEN
    PERFORM update_debt_paid_installments(NEW.debt_id);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_expense_paid_update_debt ON public.expenses;
CREATE TRIGGER on_expense_paid_update_debt
  AFTER INSERT OR UPDATE OF is_paid ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_debt_installments();

-- ===================================================
-- PARTE 3: Actualizar paid_installments existentes
-- ===================================================

-- Recalcular paid_installments para todas las deudas existentes
UPDATE debts d
SET paid_installments = (
  SELECT COUNT(*)
  FROM expenses e
  WHERE e.debt_id = d.id AND e.is_paid = true
)
WHERE d.installments > 1;

-- ===================================================
-- PARTE 4: Recalcular balances de todas las cuentas
-- ===================================================

-- Recalcular balance de todas las cuentas existentes
DO $$
DECLARE
  account RECORD;
BEGIN
  FOR account IN SELECT id FROM bank_accounts
  LOOP
    PERFORM update_account_balance(account.id);
  END LOOP;
  RAISE NOTICE '✅ Balances recalculados para todas las cuentas';
END $$;

-- ===================================================
-- VERIFICACIÓN
-- ===================================================

SELECT 
  'Verificación de triggers' as test,
  COUNT(*) as trigger_count
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('expenses', 'debts', 'bank_accounts')
  AND trigger_name LIKE '%account%' OR trigger_name LIKE '%debt%';

SELECT 
  'Verificación de columnas' as test,
  column_name,
  table_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'debts'
  AND column_name = 'paid_installments';

-- ===================================================
-- MENSAJE FINAL
-- ===================================================

DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ SISTEMA DE CUENTAS Y CUOTAS ACTUALIZADO';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Cambios aplicados:';
  RAISE NOTICE '  ✓ Bank accounts restan gastos pendientes';
  RAISE NOTICE '  ✓ Trigger actualizado para cambios de cuenta';
  RAISE NOTICE '  ✓ Columna paid_installments agregada a debts';
  RAISE NOTICE '  ✓ Trigger para actualizar cuotas pagadas';
  RAISE NOTICE '  ✓ Balances recalculados automáticamente';
  RAISE NOTICE '';
  RAISE NOTICE 'Ahora:';
  RAISE NOTICE '  • Las cuentas restan gastos al crearlos';
  RAISE NOTICE '  • AccountDetail muestra gastos correctamente';
  RAISE NOTICE '  • Las cuotas pagadas se cuentan automáticamente';
  RAISE NOTICE '========================================';
END $$;
