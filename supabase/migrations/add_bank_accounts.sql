-- =====================================================
-- SISTEMA DE CUENTAS BANCARIAS MULTI-MONEDA
-- Balance automático por moneda
-- =====================================================

-- 1. CREAR TABLA BANK_ACCOUNTS
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'ARS',
  currency_symbol VARCHAR(10) NOT NULL DEFAULT '$',
  initial_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  current_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraint: máximo 4 cuentas por usuario
  CONSTRAINT unique_user_account UNIQUE (user_id, name, currency)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON public.bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_currency ON public.bank_accounts(currency);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_currency ON public.bank_accounts(user_id, currency);

-- Comentarios
COMMENT ON TABLE public.bank_accounts IS 'Cuentas bancarias de usuarios con balance por moneda';
COMMENT ON COLUMN public.bank_accounts.current_balance IS 'Balance actual calculado: initial_balance - gastos + ingresos';

-- 2. POLÍTICAS RLS
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Users can view own accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Users can create own accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Users can delete own accounts" ON public.bank_accounts;

-- Los usuarios solo ven sus propias cuentas
CREATE POLICY "Users can view own accounts"
  ON public.bank_accounts FOR SELECT
  USING (auth.uid() = user_id);

-- Los usuarios pueden crear sus propias cuentas (máx 4)
CREATE POLICY "Users can create own accounts"
  ON public.bank_accounts FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    (SELECT COUNT(*) FROM public.bank_accounts WHERE user_id = auth.uid()) < 4
  );

-- Los usuarios pueden actualizar sus propias cuentas
CREATE POLICY "Users can update own accounts"
  ON public.bank_accounts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Los usuarios pueden eliminar sus propias cuentas
CREATE POLICY "Users can delete own accounts"
  ON public.bank_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- 3. VINCULAR EXPENSES CON BANK_ACCOUNTS
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_bank_account ON public.expenses(bank_account_id);

-- 4. VINCULAR DEBTS CON BANK_ACCOUNTS
ALTER TABLE public.debts 
ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_debts_bank_account ON public.debts(bank_account_id);

-- 5. VINCULAR MONTHLY_INCOMES CON BANK_ACCOUNTS
ALTER TABLE public.monthly_incomes 
ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_monthly_incomes_bank_account ON public.monthly_incomes(bank_account_id);

-- 6. FUNCIÓN PARA ACTUALIZAR BALANCE DE CUENTA
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
  
  -- Calcular total de gastos pagados de esta cuenta
  SELECT COALESCE(SUM(amount), 0) INTO total_expenses
  FROM expenses
  WHERE bank_account_id = account_id AND is_paid = true;
  
  -- Calcular total de deudas pagadas de esta cuenta
  SELECT COALESCE(SUM(amount), 0) INTO total_debts
  FROM debts
  WHERE bank_account_id = account_id AND status = 'paid';
  
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

-- 7. TRIGGER: Actualizar balance al insertar gasto
CREATE OR REPLACE FUNCTION trigger_update_account_on_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.bank_account_id IS NOT NULL AND NEW.is_paid = true THEN
    PERFORM update_account_balance(NEW.bank_account_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_expense_paid ON public.expenses;
CREATE TRIGGER on_expense_paid
  AFTER INSERT OR UPDATE OF is_paid, bank_account_id ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_account_on_expense();

-- 8. TRIGGER: Actualizar balance al insertar deuda
CREATE OR REPLACE FUNCTION trigger_update_account_on_debt()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.bank_account_id IS NOT NULL AND NEW.status = 'paid' THEN
    PERFORM update_account_balance(NEW.bank_account_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_debt_paid ON public.debts;
CREATE TRIGGER on_debt_paid
  AFTER INSERT OR UPDATE OF status, bank_account_id ON public.debts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_account_on_debt();

-- 9. TRIGGER: Actualizar balance al agregar ingreso
CREATE OR REPLACE FUNCTION trigger_update_account_on_income()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.bank_account_id IS NOT NULL THEN
    PERFORM update_account_balance(NEW.bank_account_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_income_added ON public.monthly_incomes;
CREATE TRIGGER on_income_added
  AFTER INSERT OR UPDATE OF amount, bank_account_id ON public.monthly_incomes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_account_on_income();

-- 10. VISTA: Resumen de cuentas por usuario
CREATE OR REPLACE VIEW account_summary AS
SELECT 
  ba.id,
  ba.user_id,
  ba.name,
  ba.currency,
  ba.currency_symbol,
  ba.initial_balance,
  ba.current_balance,
  ba.is_active,
  COUNT(DISTINCT e.id) as total_expenses,
  COALESCE(SUM(CASE WHEN e.is_paid THEN e.amount ELSE 0 END), 0) as paid_expenses,
  COUNT(DISTINCT d.id) as total_debts,
  COALESCE(SUM(CASE WHEN d.status = 'paid' THEN d.amount ELSE 0 END), 0) as paid_debts,
  ba.created_at,
  ba.updated_at
FROM bank_accounts ba
LEFT JOIN expenses e ON e.bank_account_id = ba.id
LEFT JOIN debts d ON d.bank_account_id = ba.id
GROUP BY ba.id;

-- 11. VERIFICACIÓN
SELECT 
  'bank_accounts' as tabla,
  COUNT(*) as total
FROM bank_accounts;

-- 12. MENSAJE FINAL
DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ SISTEMA DE CUENTAS BANCARIAS INSTALADO';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tablas creadas:';
  RAISE NOTICE '  ✓ bank_accounts (cuentas por moneda)';
  RAISE NOTICE '';
  RAISE NOTICE 'Columnas agregadas:';
  RAISE NOTICE '  ✓ expenses.bank_account_id';
  RAISE NOTICE '  ✓ debts.bank_account_id';
  RAISE NOTICE '  ✓ monthly_incomes.bank_account_id';
  RAISE NOTICE '';
  RAISE NOTICE 'Funciones:';
  RAISE NOTICE '  ✓ update_account_balance() - Recalcula balance';
  RAISE NOTICE '  ✓ Triggers automáticos en expenses/debts/incomes';
  RAISE NOTICE '';
  RAISE NOTICE 'Políticas RLS:';
  RAISE NOTICE '  ✓ Máximo 4 cuentas por usuario';
  RAISE NOTICE '  ✓ Balance actualizado automáticamente';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 Ahora puedes crear cuentas bancarias con diferentes monedas';
  RAISE NOTICE '========================================';
END $$;
