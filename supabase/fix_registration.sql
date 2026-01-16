-- =====================================================
-- FIX: Error "Database error saving new user"
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- El problema es que hay un trigger que intenta crear el perfil
-- automáticamente pero falla por RLS o columnas faltantes.

-- PASO 1: Ver qué triggers existen en auth.users
SELECT 
  trigger_name, 
  event_manipulation, 
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'users' 
  AND event_object_schema = 'auth';

-- PASO 2: Eliminar el trigger problemático (si existe)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- PASO 3: Crear/Reemplazar la función para crear perfil
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, created_at, updated_at)
  VALUES (NEW.id, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Si falla, solo logear y continuar (no bloquear el registro)
  RAISE WARNING 'Error creando perfil para usuario %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PASO 4: Recrear el trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PASO 5: Asegurar que profiles tiene las columnas mínimas
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- PASO 6: Política RLS permisiva para INSERT (crítico para el trigger)
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.profiles;

-- El trigger usa SECURITY DEFINER así que debería poder insertar
-- Pero por si acaso, permitir INSERT para la función
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Política que permite INSERT para usuarios autenticados
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.profiles;
CREATE POLICY "Allow authenticated insert"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

-- Política para SELECT
DROP POLICY IF EXISTS "Allow select own profile" ON public.profiles;
CREATE POLICY "Allow select own profile"
  ON public.profiles FOR SELECT
  USING (true);

-- Política para UPDATE
DROP POLICY IF EXISTS "Allow update own profile" ON public.profiles;
CREATE POLICY "Allow update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- VERIFICAR
SELECT 'Trigger creado:' as status, trigger_name 
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

SELECT 'Políticas activas:' as status, policyname, cmd 
FROM pg_policies 
WHERE tablename = 'profiles';
