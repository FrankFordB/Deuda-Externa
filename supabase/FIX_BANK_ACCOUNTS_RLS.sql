-- =====================================================
-- FIX: Política RLS para crear cuentas bancarias
-- =====================================================
-- El problema era que la política original verificaba el count
-- antes de insertar, lo que podía causar problemas en algunos casos.
-- Esta versión corregida es más permisiva.

-- 1. Eliminar política actual de INSERT
DROP POLICY IF EXISTS "Users can create own accounts" ON public.bank_accounts;

-- 2. Crear política corregida
-- Permite crear hasta 4 cuentas por usuario
CREATE POLICY "Users can create own accounts"
  ON public.bank_accounts FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    (SELECT COUNT(*) FROM public.bank_accounts WHERE user_id = auth.uid()) < 4
  );

-- Nota: Si el problema persiste, puedes usar esta versión simplificada:
-- DROP POLICY IF EXISTS "Users can create own accounts" ON public.bank_accounts;
-- 
-- CREATE POLICY "Users can create own accounts"
--   ON public.bank_accounts FOR INSERT
--   WITH CHECK (auth.uid() = user_id);
--
-- Esta versión permite crear cuentas sin límite, pero es más permisiva.
