-- ============================================
-- Fix RLS Policies para Notifications y Profiles
-- ============================================
-- Corrige políticas de seguridad que impiden crear notificaciones

-- 1. PROFILES - Permitir lectura de perfiles públicos
DROP POLICY IF EXISTS "Profiles públicos son visibles" ON profiles;
CREATE POLICY "Profiles públicos son visibles"
  ON profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Usuarios pueden ver perfiles" ON profiles;
CREATE POLICY "Usuarios pueden ver perfiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- 2. NOTIFICATIONS - Permitir a usuarios crear notificaciones para otros
DROP POLICY IF EXISTS "Usuarios pueden crear notificaciones" ON notifications;
CREATE POLICY "Usuarios pueden crear notificaciones"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Usuarios pueden ver sus notificaciones" ON notifications;
CREATE POLICY "Usuarios pueden ver sus notificaciones"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Usuarios pueden actualizar sus notificaciones" ON notifications;
CREATE POLICY "Usuarios pueden actualizar sus notificaciones"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Usuarios pueden borrar sus notificaciones" ON notifications;
CREATE POLICY "Usuarios pueden borrar sus notificaciones"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 3. PAYMENT_CONFIRMATIONS - Permitir crear y responder confirmaciones
DROP POLICY IF EXISTS "Usuarios pueden crear confirmaciones" ON payment_confirmations;
CREATE POLICY "Usuarios pueden crear confirmaciones"
  ON payment_confirmations FOR INSERT
  TO authenticated
  WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS "Usuarios pueden ver sus confirmaciones" ON payment_confirmations;
CREATE POLICY "Usuarios pueden ver sus confirmaciones"
  ON payment_confirmations FOR SELECT
  TO authenticated
  USING (requester_id = auth.uid() OR confirmer_id = auth.uid());

DROP POLICY IF EXISTS "Usuarios pueden responder confirmaciones" ON payment_confirmations;
CREATE POLICY "Usuarios pueden responder confirmaciones"
  ON payment_confirmations FOR UPDATE
  TO authenticated
  USING (confirmer_id = auth.uid())
  WITH CHECK (confirmer_id = auth.uid());

-- Verificar políticas creadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('profiles', 'notifications', 'payment_confirmations')
ORDER BY tablename, policyname;
