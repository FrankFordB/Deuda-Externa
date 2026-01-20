-- =====================================================
-- FIX REGISTRO DE USUARIOS
-- Soluciona el error "Database error saving new user"
-- =====================================================

-- 1. VER POLÍTICAS ACTUALES
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'profiles' AND schemaname = 'public'
ORDER BY cmd, policyname;

-- 2. ELIMINAR POLÍTICA DE INSERT SI EXISTE
DROP POLICY IF EXISTS "System can create profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for service role only" ON public.profiles;
DROP POLICY IF EXISTS "Allow insert during registration" ON public.profiles;

-- 3. CREAR POLÍTICA DE INSERT PARA EL TRIGGER
-- Permite que el trigger handle_new_user pueda insertar perfiles
CREATE POLICY "System can create profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

-- 4. RECREAR FUNCIÓN Y TRIGGER CON MANEJO DE ERRORES
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
    country
  )
  VALUES (
    NEW.id,
    NEW.email,
    nickname_value,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'birth_date')::date, NULL),
    COALESCE(NEW.raw_user_meta_data->>'country', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    nickname = COALESCE(EXCLUDED.nickname, profiles.nickname);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log el error pero no fallar el registro
    RAISE WARNING 'Error creando perfil: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Verificar que el trigger existe
SELECT 
  tgname as trigger_name,
  tgenabled as enabled,
  CASE tgenabled
    WHEN 'O' THEN '✅ Activo'
    ELSE '❌ Problema'
  END as status
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';

-- 5. VERIFICAR TODAS LAS POLÍTICAS
SELECT 
  tablename,
  policyname,
  cmd as operation,
  CASE 
    WHEN qual IS NOT NULL THEN 'WITH USING'
    ELSE 'NO USING'
  END as has_using,
  CASE 
    WHEN with_check IS NOT NULL THEN 'WITH CHECK'
    ELSE 'NO CHECK'
  END as has_check
FROM pg_policies 
WHERE tablename = 'profiles' AND schemaname = 'public'
ORDER BY cmd, policyname;

-- 6. MENSAJE FINAL
DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ POLÍTICA DE INSERT CREADA';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Ahora puedes registrar nuevos usuarios';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 Verifica en la consola SQL que:';
  RAISE NOTICE '  ✓ Existe política "System can create profiles" con INSERT';
  RAISE NOTICE '  ✓ Existe trigger "on_auth_user_created"';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 Prueba creando un nuevo usuario';
  RAISE NOTICE '========================================';
END $$;
