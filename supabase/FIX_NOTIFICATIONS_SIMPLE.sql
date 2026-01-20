-- ============================================
-- FIX INMEDIATO - Copia y pega esto en Supabase SQL Editor
-- ============================================

-- Eliminar política restrictiva
DROP POLICY IF EXISTS "notifications_insert_any" ON notifications;
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
DROP POLICY IF EXISTS "Users can insert their own notifications" ON notifications;
DROP POLICY IF EXISTS "allow_all_inserts" ON notifications;

-- Crear política permisiva
CREATE POLICY "allow_all_inserts"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Verificar
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'notifications' AND cmd = 'INSERT';

-- DESPUÉS DE EJECUTAR:
-- 1. CIERRA SESIÓN en la app (importante!)
-- 2. VUELVE A INICIAR SESIÓN
-- 3. Intenta crear una deuda de nuevo
