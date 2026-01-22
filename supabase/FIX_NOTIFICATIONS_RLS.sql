-- =====================================================
-- FIX SIMPLE Y DIRECTO: Notificaciones
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- PASO 1: Eliminar TODAS las políticas de notifications
DROP POLICY IF EXISTS "notif_select" ON notifications;
DROP POLICY IF EXISTS "notif_insert" ON notifications;
DROP POLICY IF EXISTS "notif_update" ON notifications;
DROP POLICY IF EXISTS "notif_delete" ON notifications;
DROP POLICY IF EXISTS "notif_select_v2" ON notifications;
DROP POLICY IF EXISTS "notif_insert_v2" ON notifications;
DROP POLICY IF EXISTS "notif_update_v2" ON notifications;
DROP POLICY IF EXISTS "notif_delete_v2" ON notifications;
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_any" ON notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;

-- Eliminar cualquier otra que exista
DO $$ 
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'notifications'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON notifications', r.policyname);
    END LOOP;
END $$;

-- PASO 2: Habilitar RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- PASO 3: Crear política de INSERT que permite todo
CREATE POLICY "allow_insert_all" 
ON notifications 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- PASO 4: Crear otras políticas
CREATE POLICY "allow_select_own" 
ON notifications 
FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY "allow_update_own" 
ON notifications 
FOR UPDATE 
TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY "allow_delete_own" 
ON notifications 
FOR DELETE 
TO authenticated 
USING (user_id = auth.uid());

-- PASO 5: Crear función RPC como backup
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT NULL,
  p_action_required BOOLEAN DEFAULT FALSE,
  p_action_type TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO notifications (user_id, type, title, message, data, action_required, action_type, read, created_at)
  VALUES (p_user_id, p_type, p_title, p_message, p_data, p_action_required, p_action_type, false, NOW())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_notification TO authenticated;

-- VERIFICACIÓN
SELECT '✅ Políticas creadas:' as status;
SELECT policyname, cmd, permissive FROM pg_policies WHERE tablename = 'notifications';

SELECT '✅ Función creada:' as status;
SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'create_notification') as funcion_existe;
