-- ============================================
-- Fix COMPLETO RLS para Notifications
-- ============================================
-- Solución definitiva: eliminar TODAS las políticas conflictivas

-- PASO 1: DESHABILITAR RLS temporalmente para limpiar
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_confirmations DISABLE ROW LEVEL SECURITY;

-- PASO 2: ELIMINAR TODAS las políticas existentes
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    -- Eliminar políticas de profiles
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', pol.policyname);
    END LOOP;
    
    -- Eliminar políticas de notifications
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'notifications'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON notifications', pol.policyname);
    END LOOP;
    
    -- Eliminar políticas de payment_confirmations
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'payment_confirmations'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON payment_confirmations', pol.policyname);
    END LOOP;
END $$;

-- PASO 3: HABILITAR RLS nuevamente
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_confirmations ENABLE ROW LEVEL SECURITY;

-- PASO 4: CREAR POLÍTICAS SIMPLES Y PERMISIVAS

-- PROFILES - Lectura total, escritura propia
CREATE POLICY "profiles_select_all"
  ON profiles FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- NOTIFICATIONS - Cualquiera puede crear, solo ver las propias
CREATE POLICY "notifications_insert_any"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "notifications_delete_own"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- PAYMENT_CONFIRMATIONS - Crear y responder
CREATE POLICY "payment_confirmations_insert"
  ON payment_confirmations FOR INSERT
  TO authenticated
  WITH CHECK (requester_id = auth.uid());

CREATE POLICY "payment_confirmations_select"
  ON payment_confirmations FOR SELECT
  TO authenticated
  USING (requester_id = auth.uid() OR confirmer_id = auth.uid());

CREATE POLICY "payment_confirmations_update"
  ON payment_confirmations FOR UPDATE
  TO authenticated
  USING (confirmer_id = auth.uid())
  WITH CHECK (confirmer_id = auth.uid());

-- PASO 5: VERIFICAR RESULTADO
SELECT 
  tablename,
  policyname,
  cmd,
  permissive,
  roles
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('profiles', 'notifications', 'payment_confirmations')
ORDER BY tablename, policyname;

-- PASO 6: Verificar que RLS está habilitado
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'notifications', 'payment_confirmations');
