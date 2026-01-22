-- =====================================================
-- FIX: Políticas RLS para tabla notifications
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- 1. Primero, ver políticas actuales (para diagnóstico)
SELECT 
  policyname, 
  permissive, 
  roles, 
  cmd,
  qual::text as using_clause,
  with_check::text as with_check_clause
FROM pg_policies 
WHERE tablename = 'notifications';

-- 2. Eliminar políticas existentes que puedan estar mal configuradas
DROP POLICY IF EXISTS "Users can view their notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can create notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON notifications;
DROP POLICY IF EXISTS "Allow all for authenticated" ON notifications;
DROP POLICY IF EXISTS "notifications_select_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_update_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_delete_policy" ON notifications;

-- 3. Habilitar RLS si no está habilitado
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 4. Crear políticas correctas

-- SELECT: Los usuarios pueden ver sus propias notificaciones
CREATE POLICY "notifications_select_policy" ON notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: Cualquier usuario autenticado puede crear notificaciones para otros usuarios
-- (Esto es necesario para enviar notificaciones a amigos)
CREATE POLICY "notifications_insert_policy" ON notifications
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: Los usuarios solo pueden actualizar sus propias notificaciones
-- (Para marcar como leídas)
CREATE POLICY "notifications_update_policy" ON notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- DELETE: Los usuarios solo pueden eliminar sus propias notificaciones
CREATE POLICY "notifications_delete_policy" ON notifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Verificar que las políticas se crearon correctamente
SELECT 
  policyname, 
  cmd,
  permissive
FROM pg_policies 
WHERE tablename = 'notifications';

-- 6. También arreglar la tabla payment_confirmations si existe
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payment_confirmations') THEN
    -- Eliminar políticas existentes
    DROP POLICY IF EXISTS "Users can view their confirmations" ON payment_confirmations;
    DROP POLICY IF EXISTS "Users can create confirmations" ON payment_confirmations;
    DROP POLICY IF EXISTS "Users can update confirmations" ON payment_confirmations;
    DROP POLICY IF EXISTS "payment_confirmations_select_policy" ON payment_confirmations;
    DROP POLICY IF EXISTS "payment_confirmations_insert_policy" ON payment_confirmations;
    DROP POLICY IF EXISTS "payment_confirmations_update_policy" ON payment_confirmations;
    
    -- Habilitar RLS
    ALTER TABLE payment_confirmations ENABLE ROW LEVEL SECURITY;
    
    -- SELECT: Usuario puede ver confirmaciones donde es requester o confirmer
    CREATE POLICY "payment_confirmations_select_policy" ON payment_confirmations
      FOR SELECT
      USING (auth.uid() = requester_id OR auth.uid() = confirmer_id);
    
    -- INSERT: Usuarios autenticados pueden crear confirmaciones
    CREATE POLICY "payment_confirmations_insert_policy" ON payment_confirmations
      FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL);
    
    -- UPDATE: Solo el confirmer puede actualizar (para responder)
    CREATE POLICY "payment_confirmations_update_policy" ON payment_confirmations
      FOR UPDATE
      USING (auth.uid() = confirmer_id);
    
    RAISE NOTICE 'Políticas de payment_confirmations actualizadas';
  END IF;
END $$;

-- 7. Mensaje de éxito
DO $$
BEGIN
  RAISE NOTICE '✅ Políticas RLS de notifications actualizadas correctamente';
END $$;
