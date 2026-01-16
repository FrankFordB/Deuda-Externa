-- =====================================================
-- FIX DEFINITIVO: Ejecutar AHORA en Supabase SQL Editor
-- =====================================================

-- PASO 1: Hacer email nullable en profiles
ALTER TABLE public.profiles 
ALTER COLUMN email DROP NOT NULL;

-- PASO 2: Asegurar que existe la columna monthly_income
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS monthly_income DECIMAL(12, 2) DEFAULT 0;

-- PASO 3: Limpiar TODAS las políticas RLS de profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can search profiles by nickname" ON public.profiles;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Allow update for own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.profiles;
DROP POLICY IF EXISTS "Allow select own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.profiles;

-- PASO 4: Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- PASO 5: Crear políticas simples y permisivas
-- SELECT: Todos pueden ver todos los perfiles (necesario para buscar amigos)
CREATE POLICY "profiles_select_policy"
  ON public.profiles FOR SELECT
  USING (true);

-- INSERT: Usuarios autenticados pueden insertar su propio perfil
CREATE POLICY "profiles_insert_policy"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- UPDATE: Usuarios solo pueden actualizar su propio perfil
CREATE POLICY "profiles_update_policy"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- DELETE: Usuarios solo pueden eliminar su propio perfil
CREATE POLICY "profiles_delete_policy"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- PASO 6: Verificar que el trigger de nuevo usuario funcione
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Si falla, no bloquear el registro
  RAISE WARNING 'Error creando perfil: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PASO 7: Crear perfiles faltantes para usuarios existentes
INSERT INTO public.profiles (id, email, created_at, updated_at)
SELECT id, email, created_at, NOW()
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- PASO 8: Verificar
SELECT 'Políticas activas:' as info;
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'profiles';

SELECT 'Usuarios sin perfil:' as info;
SELECT COUNT(*) as usuarios_sin_perfil
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

SELECT 'Estructura de profiles:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles' AND table_schema = 'public'
ORDER BY ordinal_position;
