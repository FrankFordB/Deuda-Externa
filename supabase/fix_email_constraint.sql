-- =====================================================
-- FIX URGENTE: Columna email en profiles
-- Ejecutar AHORA en Supabase SQL Editor
-- =====================================================

-- La columna email tiene NOT NULL constraint pero el UPSERT no la incluye
-- Opción 1: Hacer email nullable
ALTER TABLE public.profiles 
ALTER COLUMN email DROP NOT NULL;

-- Opción 2: Dar un valor default
-- ALTER TABLE public.profiles 
-- ALTER COLUMN email SET DEFAULT '';

-- Verificar estructura actual
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles' AND table_schema = 'public'
ORDER BY ordinal_position;
