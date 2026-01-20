-- ============================================
-- FIX RLS para Notifications (APLICAR EN SUPABASE SQL EDITOR)
-- ============================================
-- Este script corrige el problema de 403 Forbidden en notifications

-- PASO 1: DESHABILITAR RLS temporalmente para limpiar
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- PASO 2: ELIMINAR TODAS las políticas existentes de notifications
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

-- PASO 3: HABILITAR RLS nuevamente
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- PASO 4: CREAR POLÍTICAS PERMISIVAS

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

-- PASO 5: VERIFICAR RESULTADO
SELECT 
  tablename,
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'notifications'
ORDER BY policyname;

-- PASO 6: Verificar que RLS está habilitado
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'notifications';
