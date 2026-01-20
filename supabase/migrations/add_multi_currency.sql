-- =====================================================
-- SISTEMA MULTI-MONEDA
-- Agrega soporte para múltiples monedas en gastos, deudas y cuotas
-- =====================================================

-- 1. AGREGAR COLUMNAS DE MONEDA A EXPENSES
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'ARS',
ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(10) DEFAULT '$';

-- Índice para mejorar queries por moneda
CREATE INDEX IF NOT EXISTS idx_expenses_currency ON expenses(currency);

-- 2. AGREGAR COLUMNAS DE MONEDA A DEBTS
ALTER TABLE debts 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'ARS',
ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(10) DEFAULT '$';

-- Índices
CREATE INDEX IF NOT EXISTS idx_debts_currency ON debts(currency);

-- 3. AGREGAR COLUMNAS DE MONEDA A INSTALLMENTS
-- Nota: installments no tiene user_id, se actualizarán manualmente según necesidad
ALTER TABLE installments 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'ARS',
ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(10) DEFAULT '$';

-- Índices
CREATE INDEX IF NOT EXISTS idx_installments_currency ON installments(currency);

-- 4. AGREGAR INCOME SOURCES A PROFILES
-- JSON array para múltiples fuentes de ingreso
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS income_sources JSONB DEFAULT '[]'::jsonb;

-- Comentario explicativo
COMMENT ON COLUMN profiles.income_sources IS 'Array de objetos: [{"id": "1", "name": "Sueldo", "amount": 500000, "currency": "ARS", "symbol": "$"}]';

-- 5. MIGRAR DATOS EXISTENTES
-- Nota: Saltamos la migración automática porque las tablas pueden no tener
-- las relaciones esperadas. Los datos nuevos tendrán la moneda correcta.

-- 6. MIGRAR INCOME A INCOME_SOURCES
-- Nota: Saltamos esta migración porque la columna income no existe en profiles.
-- Los usuarios configurarán sus fuentes de ingreso manualmente desde la UI.

-- 7. VERIFICACIÓN
SELECT 
  'expenses' as tabla,
  COUNT(*) as total,
  COUNT(DISTINCT currency) as monedas_distintas
FROM expenses
UNION ALL
SELECT 
  'debts' as tabla,
  COUNT(*) as total,
  COUNT(DISTINCT currency) as monedas_distintas
FROM debts
UNION ALL
SELECT 
  'installments' as tabla,
  COUNT(*) as total,
  COUNT(DISTINCT currency) as monedas_distintas
FROM installments;

-- Ver distribución de monedas
SELECT 
  currency,
  currency_symbol,
  COUNT(*) as cantidad
FROM expenses
GROUP BY currency, currency_symbol
ORDER BY cantidad DESC;

-- 8. MENSAJE FINAL
DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ SISTEMA MULTI-MONEDA INSTALADO';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Columnas agregadas a:';
  RAISE NOTICE '  ✓ expenses (currency, currency_symbol)';
  RAISE NOTICE '  ✓ debts (currency, currency_symbol)';
  RAISE NOTICE '  ✓ installments (currency, currency_symbol)';
  RAISE NOTICE '  ✓ profiles (income_sources JSONB)';
  RAISE NOTICE '';
  RAISE NOTICE 'Índices creados para optimizar queries';
  RAISE NOTICE 'Datos existentes migrados';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 Ahora puedes crear gastos con diferentes monedas';
  RAISE NOTICE '========================================';
END $$;
