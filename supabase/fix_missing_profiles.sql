-- =====================================================
-- FIX PERFILES FALTANTES
-- Crea perfiles para usuarios que no los tienen
-- =====================================================

-- 1. VERIFICAR USUARIOS SIN PERFIL
SELECT 
  au.id,
  au.email,
  au.created_at,
  au.raw_user_meta_data
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- 2. CREAR PERFILES PARA USUARIOS SIN PERFIL
INSERT INTO public.profiles (
  id,
  email,
  nickname,
  first_name,
  last_name,
  birth_date,
  country,
  created_at,
  updated_at
)
SELECT 
  au.id,
  au.email,
  COALESCE(
    au.raw_user_meta_data->>'nickname',
    'user' || substr(au.id::text, 1, 8)
  ) as nickname,
  COALESCE(au.raw_user_meta_data->>'firstName', '') as first_name,
  COALESCE(au.raw_user_meta_data->>'lastName', '') as last_name,
  (au.raw_user_meta_data->>'birthDate')::date as birth_date,
  COALESCE(au.raw_user_meta_data->>'country', 'AR') as country,
  au.created_at,
  NOW()
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 3. VERIFICAR QUE TODOS LOS USUARIOS TENGAN PERFIL AHORA
SELECT 
  COUNT(DISTINCT au.id) as total_usuarios,
  COUNT(DISTINCT p.id) as total_perfiles,
  COUNT(DISTINCT au.id) - COUNT(DISTINCT p.id) as sin_perfil
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id;

-- 4. VERIFICAR LA POLÍTICA Y TRIGGER
-- Ver si el trigger existe
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Ver políticas de profiles
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'profiles' AND schemaname = 'public'
ORDER BY cmd, policyname;

-- MENSAJE FINAL
DO $$ 
DECLARE
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO missing_count
  FROM auth.users au
  LEFT JOIN public.profiles p ON au.id = p.id
  WHERE p.id IS NULL;
  
  IF missing_count = 0 THEN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ TODOS LOS USUARIOS TIENEN PERFIL';
    RAISE NOTICE '========================================';
  ELSE
    RAISE NOTICE '========================================';
    RAISE NOTICE '⚠️ TODAVÍA HAY % USUARIOS SIN PERFIL', missing_count;
    RAISE NOTICE 'Ejecuta el INSERT de nuevo si es necesario';
    RAISE NOTICE '========================================';
  END IF;
END $$;
