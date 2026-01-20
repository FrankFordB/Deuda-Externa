-- ============================================
-- FIX COMPLETO RLS - DEBTS + NOTIFICATIONS
-- ============================================
-- Aplicar este script UNA SOLA VEZ en Supabase SQL Editor

-- ============================================
-- PARTE 1: FIX DEBTS
-- ============================================

-- PASO 1.1: DESHABILITAR RLS temporalmente
ALTER TABLE debts DISABLE ROW LEVEL SECURITY;

-- PASO 1.2: ELIMINAR políticas existentes de debts
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'debts'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON debts', pol.policyname);
    END LOOP;
END $$;

-- PASO 1.3: HABILITAR RLS nuevamente
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;

-- PASO 1.4: CREAR POLÍTICAS CORRECTAS PARA DEBTS

-- Permitir crear deudas donde eres CREDITOR (te deben) O DEBTOR (debes)
CREATE POLICY "debts_insert_own"
  ON debts FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = creditor_id OR 
    auth.uid() = debtor_id
  );

-- Ver deudas donde eres parte (creditor o debtor)
CREATE POLICY "debts_select_own"
  ON debts FOR SELECT
  TO authenticated
  USING (
    auth.uid() = creditor_id OR 
    auth.uid() = debtor_id
  );

-- Actualizar deudas donde eres parte
CREATE POLICY "debts_update_own"
  ON debts FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = creditor_id OR 
    auth.uid() = debtor_id
  )
  WITH CHECK (
    auth.uid() = creditor_id OR 
    auth.uid() = debtor_id
  );

-- Eliminar deudas donde eres el creditor
CREATE POLICY "debts_delete_creditor"
  ON debts FOR DELETE
  TO authenticated
  USING (auth.uid() = creditor_id);

-- ============================================
-- PARTE 2: FIX NOTIFICATIONS
-- ============================================

-- PASO 2.1: DESHABILITAR RLS temporalmente
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- PASO 2.2: ELIMINAR políticas existentes de notifications
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'notifications'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON notifications', pol.policyname);
    END LOOP;
END $$;

-- PASO 2.3: HABILITAR RLS nuevamente
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- PASO 2.4: CREAR POLÍTICAS CORRECTAS PARA NOTIFICATIONS

-- Permitir que CUALQUIER usuario autenticado cree notificaciones para OTROS usuarios
CREATE POLICY "notifications_insert_any"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Solo ver las notificaciones propias
CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Solo actualizar las notificaciones propias
CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Solo eliminar las notificaciones propias
CREATE POLICY "notifications_delete_own"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================
-- VERIFICACIÓN FINAL
-- ============================================

-- Verificar políticas de DEBTS
SELECT 
  'DEBTS' as tabla,
  policyname,
  cmd,
  permissive,
  roles
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'debts'
ORDER BY policyname;

-- Verificar políticas de NOTIFICATIONS
SELECT 
  'NOTIFICATIONS' as tabla,
  policyname,
  cmd,
  permissive,
  roles
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'notifications'
ORDER BY policyname;

-- Verificar que RLS está habilitado en ambas tablas
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('debts', 'notifications');

-- ============================================
-- RESULTADO ESPERADO
-- ============================================
-- DEBTS: 4 políticas (insert_own, select_own, update_own, delete_creditor)
-- NOTIFICATIONS: 4 políticas (insert_any, select_own, update_own, delete_own)
-- Ambas tablas con rowsecurity = true
