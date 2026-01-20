-- =====================================================
-- Establecer Super Administrador
-- =====================================================
-- Este script convierte al usuario con email francolucianoburgoa@gmail.com
-- en superadministrador del sistema
-- =====================================================

-- Actualizar el usuario para que sea superadmin
UPDATE public.profiles
SET 
  is_superadmin = TRUE,
  updated_at = NOW()
WHERE email = 'francolucianoburgoa@gmail.com';

-- Verificar que se haya actualizado correctamente
SELECT 
  id,
  email,
  nickname,
  first_name,
  last_name,
  is_superadmin,
  updated_at
FROM public.profiles
WHERE email = 'francolucianoburgoa@gmail.com';

-- Nota: Si el usuario no existe aún, primero debes registrarte en la aplicación
-- con ese email, y luego ejecutar este script.
