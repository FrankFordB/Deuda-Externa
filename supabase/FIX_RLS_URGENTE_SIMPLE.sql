-- ============================================
-- FIX URGENTE - Aplicar y CERRAR SESIÓN después
-- ============================================

-- DEBTS: Permitir crear como creditor O debtor
DROP POLICY IF EXISTS "Users can create debts as creditor" ON debts;
DROP POLICY IF EXISTS "debts_insert_own" ON debts;

CREATE POLICY "debts_insert_both"
  ON debts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creditor_id OR auth.uid() = debtor_id);

-- NOTIFICATIONS: Permitir crear para cualquier usuario
DROP POLICY IF EXISTS "notifications_insert_any" ON notifications;
DROP POLICY IF EXISTS "notifications_insert" ON notifications;

CREATE POLICY "notifications_insert_free"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- DESPUÉS DE EJECUTAR:
-- 1. CIERRA SESIÓN en la aplicación
-- 2. Vuelve a INICIAR SESIÓN
-- 3. Intenta crear una deuda nuevamente
-- ============================================

-- Verificar
SELECT policyname, cmd FROM pg_policies WHERE tablename IN ('debts', 'notifications');
