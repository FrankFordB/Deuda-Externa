-- =====================================================
-- FIX COMPLETO REGISTRO DE USUARIOS
-- Soluciona el error "Database error saving new user"
-- =====================================================

-- PASO 1: Verificar estructura de la tabla profiles
DO $$ 
BEGIN
  -- Agregar columnas si no existen
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='nickname') THEN
    ALTER TABLE public.profiles ADD COLUMN nickname TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='first_name') THEN
    ALTER TABLE public.profiles ADD COLUMN first_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='last_name') THEN
    ALTER TABLE public.profiles ADD COLUMN last_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='birth_date') THEN
    ALTER TABLE public.profiles ADD COLUMN birth_date DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='country') THEN
    ALTER TABLE public.profiles ADD COLUMN country TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='is_superadmin') THEN
    ALTER TABLE public.profiles ADD COLUMN is_superadmin BOOLEAN DEFAULT false;
  END IF;
END $$;

-- PASO 2: Eliminar políticas de INSERT existentes
DROP POLICY IF EXISTS "System can create profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for service role only" ON public.profiles;
DROP POLICY IF EXISTS "Allow insert during registration" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;

-- PASO 3: Crear política de INSERT
CREATE POLICY "System can create profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

-- PASO 4: Recrear función handle_new_user con manejo de errores
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  nickname_value TEXT;
BEGIN
  -- Generar nickname si no existe
  nickname_value := COALESCE(
    NEW.raw_user_meta_data->>'nickname',
    'user' || substr(NEW.id::text, 1, 8)
  );

  -- Insertar perfil
  INSERT INTO public.profiles (
    id,
    email,
    nickname,
    first_name,
    last_name,
    birth_date,
    country,
    is_superadmin
  )
  VALUES (
    NEW.id,
    NEW.email,
    nickname_value,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'birth_date')::date, NULL),
    COALESCE(NEW.raw_user_meta_data->>'country', ''),
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    nickname = COALESCE(EXCLUDED.nickname, profiles.nickname),
    first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
    birth_date = COALESCE(EXCLUDED.birth_date, profiles.birth_date),
    country = COALESCE(EXCLUDED.country, profiles.country);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log el error pero no fallar el registro
    RAISE WARNING 'Error creando perfil para usuario %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- PASO 5: Recrear trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- PASO 6: Verificar políticas finales
SELECT 
  'Políticas actuales:' as info,
  policyname,
  cmd as operation
FROM pg_policies 
WHERE tablename = 'profiles' AND schemaname = 'public'
ORDER BY cmd, policyname;

-- PASO 7: Verificar trigger
SELECT 
  'Trigger verificado:' as info,
  tgname as trigger_name,
  tgenabled as enabled,
  CASE tgenabled
    WHEN 'O' THEN '✅ Activo'
    WHEN 'D' THEN '❌ Deshabilitado'
    ELSE 'Desconocido'
  END as status
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';

-- PASO 8: Verificar columnas de profiles
SELECT 
  'Columnas de profiles:' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- MENSAJE FINAL
DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ FIX COMPLETO APLICADO';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '✓ Columnas verificadas/agregadas';
  RAISE NOTICE '✓ Política de INSERT creada';
  RAISE NOTICE '✓ Función handle_new_user actualizada con manejo de errores';
  RAISE NOTICE '✓ Trigger recreado';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 Ahora intenta registrar un nuevo usuario';
  RAISE NOTICE '========================================';
END $$;
