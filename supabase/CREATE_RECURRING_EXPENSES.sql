-- ============================================
-- SISTEMA DE GASTOS RECURRENTES
-- ============================================
-- Gastos fijos mensuales (gym, deportes, suscripciones, etc.)
-- ============================================

BEGIN;

-- Tabla de gastos recurrentes
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'ARS',
  currency_symbol VARCHAR(5) DEFAULT '$',
  category VARCHAR(50) DEFAULT 'other',
  
  -- Configuración de recurrencia
  frequency VARCHAR(20) DEFAULT 'monthly', -- 'monthly', 'weekly', 'yearly'
  day_of_month INTEGER DEFAULT 1, -- Día del mes para generar (1-31)
  start_date DATE NOT NULL,
  end_date DATE, -- NULL = sin fecha de fin
  
  -- Control de generación
  last_generated_date DATE, -- Última vez que se generó un gasto
  next_generation_date DATE, -- Próxima fecha de generación
  is_active BOOLEAN DEFAULT true,
  
  -- Cuenta bancaria asociada
  bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
  
  -- Metadatos
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_user_id 
ON recurring_expenses(user_id);

CREATE INDEX IF NOT EXISTS idx_recurring_expenses_active 
ON recurring_expenses(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_recurring_expenses_next_generation 
ON recurring_expenses(next_generation_date) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_recurring_expenses_bank_account 
ON recurring_expenses(bank_account_id) WHERE bank_account_id IS NOT NULL;

-- Comentarios
COMMENT ON TABLE recurring_expenses IS 'Gastos fijos recurrentes (gym, suscripciones, etc.)';
COMMENT ON COLUMN recurring_expenses.frequency IS 'Frecuencia: monthly, weekly, yearly';
COMMENT ON COLUMN recurring_expenses.day_of_month IS 'Día del mes para generar el gasto (1-31)';
COMMENT ON COLUMN recurring_expenses.next_generation_date IS 'Próxima fecha de generación automática';

-- Función para calcular próxima fecha de generación
CREATE OR REPLACE FUNCTION calculate_next_generation_date(
  p_current_date DATE,
  p_frequency VARCHAR,
  p_day_of_month INTEGER
) RETURNS DATE AS $$
DECLARE
  v_next_date DATE;
BEGIN
  CASE p_frequency
    WHEN 'monthly' THEN
      -- Próximo mes, mismo día
      v_next_date := (DATE_TRUNC('month', p_current_date) + INTERVAL '1 month' + (p_day_of_month - 1) * INTERVAL '1 day')::DATE;
    WHEN 'weekly' THEN
      -- Próxima semana
      v_next_date := p_current_date + INTERVAL '1 week';
    WHEN 'yearly' THEN
      -- Próximo año, mismo día
      v_next_date := (DATE_TRUNC('year', p_current_date) + INTERVAL '1 year' + (p_day_of_month - 1) * INTERVAL '1 day')::DATE;
    ELSE
      v_next_date := p_current_date + INTERVAL '1 month';
  END CASE;
  
  RETURN v_next_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger para actualizar next_generation_date al crear
CREATE OR REPLACE FUNCTION set_initial_next_generation_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.next_generation_date IS NULL THEN
    NEW.next_generation_date := calculate_next_generation_date(
      NEW.start_date,
      NEW.frequency,
      NEW.day_of_month
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_next_generation_date ON recurring_expenses;
CREATE TRIGGER trigger_set_next_generation_date
  BEFORE INSERT ON recurring_expenses
  FOR EACH ROW
  EXECUTE FUNCTION set_initial_next_generation_date();

-- Función para generar gastos desde recurrentes (llamar manualmente o con cron)
CREATE OR REPLACE FUNCTION generate_recurring_expenses(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  recurring_id UUID,
  expense_id UUID,
  generated_date DATE,
  amount DECIMAL
) AS $$
DECLARE
  v_recurring RECORD;
  v_expense_id UUID;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Obtener todos los recurrentes que deben generarse
  FOR v_recurring IN
    SELECT *
    FROM recurring_expenses
    WHERE is_active = true
      AND next_generation_date <= v_today
      AND (end_date IS NULL OR end_date >= v_today)
      AND (p_user_id IS NULL OR user_id = p_user_id)
  LOOP
    -- Crear el gasto en la tabla expenses
    INSERT INTO expenses (
      user_id,
      amount,
      description,
      category,
      date,
      currency,
      currency_symbol,
      bank_account_id,
      is_recurring,
      recurring_expense_id
    ) VALUES (
      v_recurring.user_id,
      v_recurring.amount,
      v_recurring.name || ' - ' || COALESCE(v_recurring.description, 'Gasto recurrente'),
      v_recurring.category,
      v_recurring.next_generation_date,
      v_recurring.currency,
      v_recurring.currency_symbol,
      v_recurring.bank_account_id,
      true,
      v_recurring.id
    ) RETURNING id INTO v_expense_id;
    
    -- Actualizar el recurring
    UPDATE recurring_expenses
    SET 
      last_generated_date = v_recurring.next_generation_date,
      next_generation_date = calculate_next_generation_date(
        v_recurring.next_generation_date,
        v_recurring.frequency,
        v_recurring.day_of_month
      ),
      updated_at = NOW()
    WHERE id = v_recurring.id;
    
    -- Retornar información del gasto generado
    RETURN QUERY SELECT 
      v_recurring.id,
      v_expense_id,
      v_recurring.next_generation_date,
      v_recurring.amount;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Agregar columnas a expenses para vincular con recurrentes
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS recurring_expense_id UUID REFERENCES recurring_expenses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_recurring 
ON expenses(recurring_expense_id) WHERE recurring_expense_id IS NOT NULL;

COMMENT ON COLUMN expenses.is_recurring IS 'Indica si el gasto fue generado automáticamente';
COMMENT ON COLUMN expenses.recurring_expense_id IS 'Referencia al gasto recurrente que lo generó';

-- RLS (Row Level Security)
ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS recurring_expenses_select_own ON recurring_expenses;
DROP POLICY IF EXISTS recurring_expenses_insert_own ON recurring_expenses;
DROP POLICY IF EXISTS recurring_expenses_update_own ON recurring_expenses;
DROP POLICY IF EXISTS recurring_expenses_delete_own ON recurring_expenses;

-- Política: Los usuarios solo pueden ver sus propios gastos recurrentes
CREATE POLICY recurring_expenses_select_own
  ON recurring_expenses FOR SELECT
  USING (auth.uid() = user_id);

-- Política: Los usuarios solo pueden insertar sus propios gastos recurrentes
CREATE POLICY recurring_expenses_insert_own
  ON recurring_expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: Los usuarios solo pueden actualizar sus propios gastos recurrentes
CREATE POLICY recurring_expenses_update_own
  ON recurring_expenses FOR UPDATE
  USING (auth.uid() = user_id);

-- Política: Los usuarios solo pueden eliminar sus propios gastos recurrentes
CREATE POLICY recurring_expenses_delete_own
  ON recurring_expenses FOR DELETE
  USING (auth.uid() = user_id);

-- Permisos
GRANT SELECT, INSERT, UPDATE, DELETE ON recurring_expenses TO authenticated;
GRANT EXECUTE ON FUNCTION generate_recurring_expenses TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_next_generation_date TO authenticated;

COMMIT;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

SELECT 'Tabla recurring_expenses:' as verificacion, COUNT(*) as existe
FROM information_schema.tables 
WHERE table_name = 'recurring_expenses';

SELECT 'Columnas en expenses:' as verificacion, column_name
FROM information_schema.columns 
WHERE table_name = 'expenses' 
  AND column_name IN ('is_recurring', 'recurring_expense_id');

SELECT '✅ GASTOS RECURRENTES CREADOS EXITOSAMENTE' as resultado;
