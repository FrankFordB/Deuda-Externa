-- =====================================================
-- ARREGLAR PERMISOS DE PROFILES
-- Para que el usuario pueda ver y editar su perfil
-- =====================================================

-- 1. VER POLÍTICAS ACTUALES DE PROFILES
SELECT 
  policyname,
  permissive,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'profiles' AND schemaname = 'public'
ORDER BY policyname;

-- 2. ELIMINAR TODAS LAS POLÍTICAS DE PROFILES
DO $$ 
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

-- 3. HABILITAR RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. CREAR POLÍTICAS PERMISIVAS
-- Todos pueden ver todos los perfiles (para buscar amigos)
CREATE POLICY "Anyone can view profiles"
  ON public.profiles FOR SELECT
  USING (true);

-- Permitir INSERT para el sistema (trigger de registro)
CREATE POLICY "System can create profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

-- Solo el dueño puede actualizar su perfil
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Solo el dueño puede eliminar su perfil
CREATE POLICY "Users can delete own profile"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);

-- 5. VERIFICAR TU PERFIL
SELECT 
  id,
  email,
  nickname,
  first_name,
  last_name,
  country,
  birth_date,
  is_superadmin,
  avatar_url,
  created_at
FROM public.profiles
WHERE email = 'francolucianoburgoa@gmail.com';

-- 6. VERIFICAR STORAGE (para avatares)
SELECT 
  id,
  name,
  public
FROM storage.buckets
ORDER BY name;

-- 7. HACER BUCKET DE AVATARES PÚBLICO
UPDATE storage.buckets
SET public = true
WHERE id = 'avatars';

-- 8. POLÍTICAS DE STORAGE PARA AVATARES
-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload an avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;

-- Todos pueden ver avatares
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Usuarios autenticados pueden subir
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Usuarios pueden actualizar su propio avatar
CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Usuarios pueden eliminar su propio avatar
CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- 9. RESUMEN FINAL
DO $$ 
DECLARE
  profile_count INT;
  expense_count INT;
BEGIN
  SELECT COUNT(*) INTO profile_count FROM public.profiles;
  SELECT COUNT(*) INTO expense_count FROM public.expenses;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ PERMISOS ACTUALIZADOS';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total usuarios: %', profile_count;
  RAISE NOTICE 'Total gastos: %', expense_count;
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Ahora puedes:';
  RAISE NOTICE '  ✓ Ver tu perfil';
  RAISE NOTICE '  ✓ Editar tu perfil';
  RAISE NOTICE '  ✓ Subir avatar';
  RAISE NOTICE '  ✓ Ver tus gastos';
  RAISE NOTICE '========================================';
END $$;
