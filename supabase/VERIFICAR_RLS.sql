-- =====================================================
-- VERIFICAR Y ARREGLAR RLS DE EXPENSES Y DEBTS
-- =====================================================
-- Las tablas existen pero no se guardan datos = problema de RLS
-- =====================================================

-- 1. VERIFICAR POLÍTICAS ACTUALES DE EXPENSES
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('expenses', 'debts', 'profiles', 'friendships')
ORDER BY tablename, policyname;

-- 2. ARREGLAR RLS DE EXPENSES (RECREAR TODAS LAS POLÍTICAS)
DO $$ 
DECLARE
  pol record;
BEGIN
  -- Eliminar todas las políticas de expenses
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'expenses' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.expenses', pol.policyname);
  END LOOP;
END $$;

-- Asegurar que RLS está habilitado
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- NUEVAS POLÍTICAS PARA EXPENSES (MÁS PERMISIVAS)
CREATE POLICY "Users can view own expenses"
  ON public.expenses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expenses"
  ON public.expenses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses"
  ON public.expenses FOR DELETE
  USING (auth.uid() = user_id);

-- 3. ARREGLAR RLS DE DEBTS
DO $$ 
DECLARE
  pol record;
BEGIN
  -- Eliminar todas las políticas de debts
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'debts' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.debts', pol.policyname);
  END LOOP;
END $$;

-- Asegurar que RLS está habilitado
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

-- NUEVAS POLÍTICAS PARA DEBTS
CREATE POLICY "Users can view debts as creditor or debtor"
  ON public.debts FOR SELECT
  USING (
    auth.uid() = creditor_id OR 
    auth.uid() = debtor_id
  );

CREATE POLICY "Users can create debts as creditor"
  ON public.debts FOR INSERT
  WITH CHECK (auth.uid() = creditor_id);

CREATE POLICY "Users can update debts they're involved in"
  ON public.debts FOR UPDATE
  USING (
    auth.uid() = creditor_id OR 
    auth.uid() = debtor_id
  );

CREATE POLICY "Users can delete debts as creditor"
  ON public.debts FOR DELETE
  USING (auth.uid() = creditor_id);

-- 4. VERIFICAR ESTRUCTURA DE EXPENSES
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'expenses'
ORDER BY ordinal_position;

-- 5. VERIFICAR TODOS LOS USUARIOS
SELECT 
  id,
  email,
  nickname,
  first_name,
  last_name,
  created_at
FROM public.profiles
ORDER BY created_at DESC;

-- 6. VERIFICAR GASTOS EXISTENTES (TODOS LOS USUARIOS)
SELECT 
  COUNT(*) as total_gastos,
  COUNT(DISTINCT user_id) as usuarios_con_gastos
FROM public.expenses;

-- 7. VER ÚLTIMOS GASTOS
SELECT 
  e.id,
  e.user_id,
  p.email,
  p.nickname,
  e.amount,
  e.description,
  e.category,
  e.date,
  e.created_at
FROM public.expenses e
LEFT JOIN public.profiles p ON p.id = e.user_id
ORDER BY e.created_at DESC
LIMIT 10;

-- 8. RESUMEN POR USUARIO
SELECT 
  p.email,
  p.nickname,
  COUNT(e.id) as total_gastos,
  COALESCE(SUM(e.amount), 0) as total_gastado
FROM public.profiles p
LEFT JOIN public.expenses e ON e.user_id = p.id
GROUP BY p.id, p.email, p.nickname
ORDER BY p.created_at DESC;

-- 9. VERIFICAR PERMISOS FINALES
DO $$ 
DECLARE
  total_expenses INT;
  total_users INT;
BEGIN
  SELECT COUNT(*) INTO total_expenses FROM public.expenses;
  SELECT COUNT(*) INTO total_users FROM public.profiles;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ POLÍTICAS RLS ACTUALIZADAS';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total usuarios registrados: %', total_users;
  RAISE NOTICE 'Total gastos en BD: %', total_expenses;
  RAISE NOTICE '';
  RAISE NOTICE '🎯 AHORA:';
  RAISE NOTICE '1. Recarga la app (Ctrl+F5)';
  RAISE NOTICE '2. Intenta crear un gasto';
  RAISE NOTICE '3. Si sigue sin funcionar, abre F12 y busca errores';
  RAISE NOTICE '========================================';
END $$;
