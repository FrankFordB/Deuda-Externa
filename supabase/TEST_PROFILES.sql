-- =====================================================
-- TEST RÁPIDO: Verificar que profiles se puede leer
-- =====================================================

-- 1. Verificar cuántos perfiles hay
SELECT COUNT(*) as total_profiles FROM public.profiles;

-- 2. Ver TODAS las políticas de profiles
SELECT 
  policyname,
  cmd,
  qual as condition,
  with_check
FROM pg_policies 
WHERE tablename = 'profiles';

-- 3. DESACTIVAR RLS TEMPORALMENTE (para probar si ese es el problema)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 4. Verificar que ahora se puede leer
SELECT 
  id,
  email,
  nickname,
  first_name
FROM public.profiles
LIMIT 3;

-- 5. REACTIVAR RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 6. CREAR POLÍTICA SUPER PERMISIVA (permite todo sin restricciones)
DROP POLICY IF EXISTS "Allow all for profiles" ON public.profiles;
CREATE POLICY "Allow all for profiles"
  ON public.profiles
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 7. Probar de nuevo
SELECT 
  id,
  email,
  nickname,
  first_name
FROM public.profiles
LIMIT 3;

-- Si esto funciona, el problema es RLS
-- Si sigue sin funcionar, el problema es otro
