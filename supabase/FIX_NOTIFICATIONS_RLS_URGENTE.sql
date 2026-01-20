-- ============================================
-- FIX URGENTE: RLS Notifications 403 Error
-- ============================================
-- APLICAR ESTE SCRIPT EN SUPABASE SQL EDITOR
-- Corrige el error: "new row violates row-level security policy"

-- PASO 1: Eliminar todas las políticas existentes
DROP POLICY IF EXISTS "notifications_insert_any" ON notifications;
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_free" ON notifications;
DROP POLICY IF EXISTS "notifications_select" ON notifications;
DROP POLICY IF EXISTS "notifications_update" ON notifications;
DROP POLICY IF EXISTS "notifications_delete" ON notifications;
DROP POLICY IF EXISTS "Users can manage their notifications" ON notifications;

-- PASO 2: Asegurar que RLS está habilitado
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- PASO 3: Crear políticas nuevas y permisivas

-- INSERTAR: Cualquier usuario autenticado puede crear notificaciones para otros
CREATE POLICY "notifications_insert_any"
  ON notifications 
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

-- SELECCIONAR: Solo ver notificaciones propias
CREATE POLICY "notifications_select_own"
  ON notifications 
  FOR SELECT 
  TO authenticated
  USING (user_id = auth.uid());

-- ACTUALIZAR: Solo actualizar notificaciones propias
CREATE POLICY "notifications_update_own"
  ON notifications 
  FOR UPDATE 
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ELIMINAR: Solo eliminar notificaciones propias
CREATE POLICY "notifications_delete_own"
  ON notifications 
  FOR DELETE 
  TO authenticated
  USING (user_id = auth.uid());

-- PASO 4: Verificar políticas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'notifications'
ORDER BY policyname;

-- ============================================
-- RESULTADO ESPERADO:
-- ============================================
-- 4 políticas activas:
-- ✅ notifications_insert_any (INSERT, WITH CHECK: true)
-- ✅ notifications_select_own (SELECT, USING: user_id = auth.uid())
-- ✅ notifications_update_own (UPDATE, USING y WITH CHECK: user_id = auth.uid())
-- ✅ notifications_delete_own (DELETE, USING: user_id = auth.uid())
