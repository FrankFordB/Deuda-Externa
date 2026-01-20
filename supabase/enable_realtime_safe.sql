-- ============================================
-- Script Seguro para Habilitar Realtime
-- ============================================
-- Este script agrega tablas a supabase_realtime de forma segura
-- evitando errores si ya existen

-- Función helper para agregar tablas de forma segura
DO $$
DECLARE
  tbl_name TEXT;
  tbl_array TEXT[] := ARRAY['notifications', 'debts', 'friends', 'expenses', 'debt_installments'];
BEGIN
  FOREACH tbl_name IN ARRAY tbl_array
  LOOP
    BEGIN
      -- Intentar remover primero (no genera error si no existe)
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.%I', tbl_name);
      
      -- Agregar la tabla a la publicación
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl_name);
      
      RAISE NOTICE 'Tabla % agregada a supabase_realtime', tbl_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error con tabla %: %', tbl_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- Verificar qué tablas están en la publicación
SELECT 
  schemaname,
  tablename,
  pubname
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
