-- ============================================
-- FIX RLS para Debts (APLICAR EN SUPABASE SQL EDITOR)
-- ============================================
-- Este script corrige el problema de 403 Forbidden al crear deudas

-- PASO 1: DESHABILITAR RLS temporalmente para limpiar
ALTER TABLE debts DISABLE ROW LEVEL SECURITY;

-- PASO 2: ELIMINAR TODAS las políticas existentes de debts
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'debts'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON debts', pol.policyname);
    END LOOP;
END $$;

-- PASO 3: HABILITAR RLS nuevamente
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;

-- PASO 4: CREAR POLÍTICAS CORRECTAS

-- Permitir crear deudas donde eres CREDITOR (te deben) O DEBTOR (debes)
CREATE POLICY "debts_insert_own"
  ON debts FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = creditor_id OR 
    auth.uid() = debtor_id
  );

-- Ver deudas donde eres parte (creditor o debtor)
CREATE POLICY "debts_select_own"
  ON debts FOR SELECT
  TO authenticated
  USING (
    auth.uid() = creditor_id OR 
    auth.uid() = debtor_id
  );

-- Actualizar deudas donde eres parte
CREATE POLICY "debts_update_own"
  ON debts FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = creditor_id OR 
    auth.uid() = debtor_id
  )
  WITH CHECK (
    auth.uid() = creditor_id OR 
    auth.uid() = debtor_id
  );

-- Eliminar deudas donde eres el creditor
CREATE POLICY "debts_delete_creditor"
  ON debts FOR DELETE
  TO authenticated
  USING (auth.uid() = creditor_id);

-- PASO 5: VERIFICAR RESULTADO
SELECT 
  tablename,
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'debts'
ORDER BY policyname;

-- PASO 6: Verificar que RLS está habilitado
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'debts';
