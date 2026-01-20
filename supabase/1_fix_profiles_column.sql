-- ============================================
-- SCRIPT 1: Agregar columna full_name
-- ============================================

-- Agregar columna full_name si no existe
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Poblar con datos existentes
UPDATE profiles 
SET full_name = COALESCE(
  NULLIF(TRIM(first_name || ' ' || COALESCE(last_name, '')), ''),
  email,
  'Usuario'
)
WHERE full_name IS NULL OR full_name = '';

-- Verificación
SELECT 
  'Columna full_name agregada' as resultado,
  COUNT(*) as perfiles_actualizados
FROM profiles 
WHERE full_name IS NOT NULL;

DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ COLUMNA full_name AGREGADA';
  RAISE NOTICE '========================================';
END $$;
