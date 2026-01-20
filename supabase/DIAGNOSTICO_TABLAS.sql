-- =====================================================
-- DIAGNÓSTICO COMPLETO DE BASE DE DATOS
-- =====================================================
-- Ejecuta este script en Supabase SQL Editor para ver
-- qué tablas existen y cuáles faltan
-- =====================================================

-- 1. VERIFICAR QUÉ TABLAS EXISTEN
SELECT 
  table_name,
  CASE 
    WHEN table_name = 'profiles' THEN '✅ CRÍTICA - Usuarios'
    WHEN table_name = 'expenses' THEN '✅ CRÍTICA - Gastos'
    WHEN table_name = 'debts' THEN '✅ CRÍTICA - Deudas'
    WHEN table_name = 'friendships' THEN '✅ CRÍTICA - Amigos'
    WHEN table_name = 'monthly_incomes' THEN '⚠️ FALTA - Sueldos no se guardan'
    WHEN table_name = 'payment_methods' THEN '⚠️ FALTA - Métodos de pago'
    WHEN table_name = 'virtual_friends' THEN '⚠️ FALTA - Amigos virtuales'
    WHEN table_name = 'change_requests' THEN '⚠️ FALTA - Sistema de cambios'
    ELSE 'Otra tabla'
  END as estado
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. VERIFICAR TABLAS CRÍTICAS FALTANTES
SELECT 
  'monthly_incomes' as tabla_faltante,
  '❌ Sin esta tabla NO se puede guardar el sueldo mensual' as impacto
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'monthly_incomes'
)
UNION ALL
SELECT 
  'payment_methods',
  '❌ Sin esta tabla NO funcionan los métodos de pago'
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'payment_methods'
)
UNION ALL
SELECT 
  'virtual_friends',
  '❌ Sin esta tabla NO se pueden crear amigos virtuales'
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'virtual_friends'
)
UNION ALL
SELECT 
  'change_requests',
  '❌ Sin esta tabla NO funciona el sistema de aprobaciones'
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'change_requests'
);

-- 3. CONTAR DATOS EN TABLAS EXISTENTES
SELECT 
  'profiles' as tabla,
  COUNT(*) as registros,
  '👤 Usuarios registrados' as descripcion
FROM public.profiles
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'profiles'
)

UNION ALL

SELECT 
  'expenses',
  COUNT(*),
  '💰 Gastos guardados'
FROM public.expenses
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'expenses'
)

UNION ALL

SELECT 
  'debts',
  COUNT(*),
  '💳 Deudas registradas'
FROM public.debts
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'debts'
)

UNION ALL

SELECT 
  'friendships',
  COUNT(*),
  '👥 Amistades'
FROM public.friendships
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'friendships'
);

-- 4. VERIFICAR SI TU USUARIO EXISTE
SELECT 
  id,
  email,
  nickname,
  first_name || ' ' || last_name as nombre_completo,
  is_superadmin as es_superadmin,
  created_at as fecha_registro
FROM public.profiles
WHERE email = 'francolucianoburgoa@gmail.com';

-- =====================================================
-- INTERPRETACIÓN DE RESULTADOS:
-- =====================================================
-- Si ves tablas faltantes (monthly_incomes, payment_methods, etc.):
-- → DEBES ejecutar las migraciones SQL en este orden:
--   1. add_monthly_income_and_virtual_friends.sql
--   2. fix_storage_and_payment_methods.sql
--   3. insert_payment_methods_existing_users.sql
--   4. add_change_requests_system.sql
--
-- Si ves 0 registros en expenses/debts pero TENÍAS datos:
-- → Posible problema de RLS (Row Level Security)
-- → O los datos están en otra base de datos/proyecto
--
-- Si tu usuario NO aparece:
-- → Debes registrarte en la aplicación primero
-- =====================================================
