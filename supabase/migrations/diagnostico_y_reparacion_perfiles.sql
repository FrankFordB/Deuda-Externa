-- =====================================================
-- DIAGNÓSTICO Y REPARACIÓN DE PERFILES
-- Asegura que todos los usuarios tengan un perfil completo
-- =====================================================

-- 0. REPARAR CONSTRAINT DE PAYMENT_METHODS (si existe la tabla)
-- El constraint antiguo no permite 'bank' y 'card', necesitamos actualizarlo
DO $$ 
BEGIN
  -- Verificar si existe la tabla
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_methods') THEN
    -- Eliminar constraint antiguo
    ALTER TABLE public.payment_methods DROP CONSTRAINT IF EXISTS payment_methods_type_check;
    
    -- Crear constraint nuevo con todos los tipos
    ALTER TABLE public.payment_methods 
    ADD CONSTRAINT payment_methods_type_check 
    CHECK (type IN ('cash', 'debit_card', 'credit_card', 'bank_transfer', 'digital_wallet', 'bank', 'card', 'other'));
    
    RAISE NOTICE '✅ Constraint de payment_methods actualizado';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Error actualizando payment_methods: %', SQLERRM;
END $$;

-- 1. DIAGNÓSTICO: Ver usuarios sin perfil
DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '🔍 DIAGNÓSTICO DE PERFILES';
  RAISE NOTICE '========================================';
END $$;

-- Contar usuarios sin perfil
SELECT 
  'Usuarios sin perfil' as descripcion,
  COUNT(*) as cantidad
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- Listar usuarios sin perfil (primeros 10)
SELECT 
  u.id,
  u.email,
  u.created_at as "registrado_en"
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ORDER BY u.created_at DESC
LIMIT 10;

-- 2. CREAR PERFILES FALTANTES
-- Inserta perfiles para usuarios que no tienen uno
INSERT INTO public.profiles (
  id,
  email,
  nickname,
  first_name,
  last_name,
  country,
  birth_date,
  role,
  is_superadmin,
  created_at,
  updated_at
)
SELECT 
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'nickname', SPLIT_PART(u.email, '@', 1)) as nickname,
  COALESCE(u.raw_user_meta_data->>'first_name', '') as first_name,
  COALESCE(u.raw_user_meta_data->>'last_name', '') as last_name,
  COALESCE(u.raw_user_meta_data->>'country', 'ARS') as country,
  (u.raw_user_meta_data->>'birth_date')::DATE as birth_date,
  'user' as role,
  false as is_superadmin,
  u.created_at,
  NOW() as updated_at
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 3. VERIFICAR FUNCIÓN DEL TRIGGER
-- Re-crear la función del trigger por si no existe o está corrupta
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    nickname,
    first_name,
    last_name,
    country,
    birth_date,
    role,
    is_superadmin,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nickname', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'country', 'ARS'),
    (NEW.raw_user_meta_data->>'birth_date')::DATE,
    'user',
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    nickname = COALESCE(EXCLUDED.nickname, profiles.nickname),
    first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
    country = COALESCE(EXCLUDED.country, profiles.country),
    birth_date = COALESCE(EXCLUDED.birth_date, profiles.birth_date),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$;

-- 4. RE-CREAR EL TRIGGER
-- Eliminar trigger anterior si existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Crear trigger nuevo
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. VERIFICAR PERFILES INCOMPLETOS
-- Listar perfiles que tienen campos NULL o vacíos
SELECT 
  id,
  email,
  nickname,
  first_name,
  last_name,
  country,
  birth_date,
  CASE 
    WHEN nickname IS NULL OR nickname = '' THEN '⚠️ Sin nickname'
    WHEN first_name IS NULL OR first_name = '' THEN '⚠️ Sin nombre'
    WHEN last_name IS NULL OR last_name = '' THEN '⚠️ Sin apellido'
    WHEN birth_date IS NULL THEN '⚠️ Sin fecha de nacimiento'
    ELSE '✅ Completo'
  END as estado
FROM public.profiles
WHERE 
  nickname IS NULL OR nickname = '' OR
  first_name IS NULL OR first_name = '' OR
  last_name IS NULL OR last_name = '' OR
  birth_date IS NULL
ORDER BY created_at DESC
LIMIT 20;

-- 6. ACTUALIZAR PERFILES INCOMPLETOS
-- Llenar campos vacíos con valores predeterminados
UPDATE public.profiles
SET 
  nickname = COALESCE(NULLIF(nickname, ''), SPLIT_PART(email, '@', 1)),
  first_name = COALESCE(NULLIF(first_name, ''), 'Usuario'),
  last_name = COALESCE(NULLIF(last_name, ''), 'Nuevo'),
  country = COALESCE(country, 'ARS'),
  updated_at = NOW()
WHERE 
  nickname IS NULL OR nickname = '' OR
  first_name IS NULL OR first_name = '' OR
  last_name IS NULL OR last_name = '';

-- 7. VERIFICACIÓN FINAL
DO $$ 
DECLARE
  total_usuarios INTEGER;
  total_perfiles INTEGER;
  perfiles_completos INTEGER;
BEGIN
  -- Contar usuarios
  SELECT COUNT(*) INTO total_usuarios FROM auth.users;
  
  -- Contar perfiles
  SELECT COUNT(*) INTO total_perfiles FROM public.profiles;
  
  -- Contar perfiles completos
  SELECT COUNT(*) INTO perfiles_completos 
  FROM public.profiles
  WHERE 
    nickname IS NOT NULL AND nickname != '' AND
    first_name IS NOT NULL AND first_name != '' AND
    last_name IS NOT NULL AND last_name != '';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ REPARACIÓN COMPLETADA';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total de usuarios: %', total_usuarios;
  RAISE NOTICE 'Total de perfiles: %', total_perfiles;
  RAISE NOTICE 'Perfiles completos: %', perfiles_completos;
  RAISE NOTICE '';
  
  IF total_usuarios = total_perfiles THEN
    RAISE NOTICE '✅ Todos los usuarios tienen perfil';
  ELSE
    RAISE NOTICE '⚠️ Faltan % perfiles', (total_usuarios - total_perfiles);
  END IF;
  
  IF perfiles_completos = total_perfiles THEN
    RAISE NOTICE '✅ Todos los perfiles están completos';
  ELSE
    RAISE NOTICE '⚠️ Hay % perfiles incompletos', (total_perfiles - perfiles_completos);
  END IF;
  
  RAISE NOTICE '========================================';
END $$;

-- 8. MOSTRAR PRIMEROS 5 PERFILES COMO EJEMPLO
SELECT 
  p.id,
  p.email,
  p.nickname,
  p.first_name,
  p.last_name,
  p.country,
  p.birth_date,
  p.role,
  '✅' as estado
FROM public.profiles p
ORDER BY p.created_at DESC
LIMIT 5;
