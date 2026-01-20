-- ============================================
-- PRUEBA: Verificar filtrado por moneda
-- ============================================

-- 1. Ver cuentas y sus monedas
SELECT 
  id,
  name,
  currency,
  currency_symbol,
  initial_balance,
  current_balance,
  (current_balance - initial_balance) as diferencia
FROM bank_accounts
WHERE is_active = true
ORDER BY currency, name;

-- 2. Ver gastos agrupados por cuenta y moneda
SELECT 
  ba.name as cuenta,
  ba.currency as moneda_cuenta,
  e.currency as moneda_gasto,
  COUNT(*) as cantidad_gastos,
  SUM(e.amount) as total_gastos,
  CASE 
    WHEN ba.currency = e.currency THEN '✅ COINCIDE'
    ELSE '❌ NO COINCIDE'
  END as validacion
FROM bank_accounts ba
LEFT JOIN expenses e ON e.bank_account_id = ba.id
WHERE ba.is_active = true
GROUP BY ba.id, ba.name, ba.currency, e.currency
ORDER BY ba.currency, ba.name;

-- 3. Ver si hay gastos con moneda diferente a su cuenta
SELECT 
  ba.name as cuenta,
  ba.currency as moneda_cuenta,
  e.description as gasto,
  e.amount,
  e.currency as moneda_gasto,
  '⚠️ PROBLEMA: Moneda no coincide' as alerta
FROM bank_accounts ba
INNER JOIN expenses e ON e.bank_account_id = ba.id
WHERE ba.currency != e.currency
  AND ba.is_active = true;

-- 4. Recalcular balance de todas las cuentas activas
DO $$
DECLARE
  account_rec RECORD;
BEGIN
  FOR account_rec IN 
    SELECT id, name, currency FROM bank_accounts WHERE is_active = true
  LOOP
    PERFORM update_account_balance(account_rec.id);
    RAISE NOTICE 'Balance actualizado para: % (%)', account_rec.name, account_rec.currency;
  END LOOP;
  RAISE NOTICE '✅ Todos los balances recalculados';
END $$;

-- 5. Verificar balances después del recálculo
SELECT 
  name,
  currency,
  currency_symbol,
  initial_balance,
  current_balance,
  (SELECT COUNT(*) FROM expenses 
   WHERE bank_account_id = ba.id AND currency = ba.currency) as gastos_misma_moneda,
  (SELECT COUNT(*) FROM expenses 
   WHERE bank_account_id = ba.id AND currency != ba.currency) as gastos_otra_moneda,
  CASE 
    WHEN current_balance < 0 THEN '🔴 NEGATIVO'
    ELSE '🟢 POSITIVO'
  END as estado
FROM bank_accounts ba
WHERE is_active = true
ORDER BY currency, name;
