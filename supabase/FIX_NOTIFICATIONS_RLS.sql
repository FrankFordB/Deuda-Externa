-- =====================================================
-- FIX NUCLEAR: Deshabilitar RLS en notifications
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- COPIA Y PEGA EXACTAMENTE ESTO:
-- =====================================================

ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- Verificar que se deshabilitó
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'notifications';

-- Si relrowsecurity = false, está deshabilitado ✅
