-- =====================================================
-- FIX: Corregir foreign key de friend_id en expenses
-- =====================================================

-- El problema es que friend_id referencia a la tabla incorrecta
-- Primero eliminar la constraint existente y recrearla correctamente

-- Eliminar FK incorrecta si existe
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_friend_id_fkey;

-- Crear FK correcta apuntando a profiles
ALTER TABLE public.expenses 
ADD CONSTRAINT expenses_friend_id_fkey 
FOREIGN KEY (friend_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- =====================================================
-- FIN
-- =====================================================
