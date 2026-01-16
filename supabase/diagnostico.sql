-- =====================================================
-- DIAGNÓSTICO: Ejecutar en Supabase SQL Editor
-- =====================================================

-- 1. Ver todas las políticas RLS activas
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 2. Ver si RLS está habilitado en cada tabla
SELECT 
  relname as tabla, 
  relrowsecurity as rls_habilitado
FROM pg_class 
WHERE relname IN ('profiles', 'expenses', 'debts', 'friendships', 'notifications', 'virtual_friends');

-- 3. Ver estructura de profiles
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Contar registros en profiles
SELECT COUNT(*) as total_profiles FROM public.profiles;

-- 5. Verificar si hay usuarios sin perfil
SELECT 
  au.id, 
  au.email,
  p.id as profile_id
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id;
