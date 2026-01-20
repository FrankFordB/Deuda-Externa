-- ============================================
-- FIX INMEDIATO - Copia y pega esto en Supabase SQL Editor
-- ============================================

-- Eliminar política restrictiva de debts
DROP POLICY IF EXISTS "debts_insert_own" ON debts;
DROP POLICY IF EXISTS "debts_insert_both" ON debts;
DROP POLICY IF EXISTS "Users can create debts as creditor" ON debts;
DROP POLICY IF EXISTS "allow_debt_inserts" ON debts;

-- Crear política permisiva para debts
CREATE POLICY "allow_debt_inserts"
  ON debts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creditor_id OR auth.uid() = debtor_id);

-- Verificar
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'debts' AND cmd = 'INSERT';

-- DESPUÉS DE EJECUTAR:
-- 1. CIERRA SESIÓN en la app (importante!)
-- 2. VUELVE A INICIAR SESIÓN
-- 3. Intenta crear una deuda de nuevo
