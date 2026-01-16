-- =====================================================
-- FIX RÁPIDO: Ejecutar esto primero en Supabase SQL Editor
-- =====================================================

-- DESHABILITAR RLS TEMPORALMENTE PARA PROFILES (para permitir INSERT/UPDATE)
-- Esta es una solución temporal para debugging

-- Opción 1: Política permisiva para INSERT (necesario para UPSERT)
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.profiles;
CREATE POLICY "Allow insert for authenticated users"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Opción 2: Política permisiva para UPDATE 
DROP POLICY IF EXISTS "Allow update for own profile" ON public.profiles;
CREATE POLICY "Allow update for own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (true);

-- Verificar que el usuario tenga un perfil
-- Primero obtén tu user_id de auth.users:
-- SELECT id, email FROM auth.users;

-- Luego inserta manualmente si no existe:
-- INSERT INTO public.profiles (id, monthly_income, created_at, updated_at)
-- VALUES ('TU_USER_ID_AQUI', 0, NOW(), NOW())
-- ON CONFLICT (id) DO NOTHING;

-- VERIFICAR políticas activas:
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'profiles';
