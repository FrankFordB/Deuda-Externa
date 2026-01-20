-- ============================================
-- FIX: debt_installments RLS y errores 400
-- ============================================

-- Verificar que la tabla existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'debt_installments') THEN
    RAISE EXCEPTION 'La tabla debt_installments no existe';
  END IF;
END $$;

-- Habilitar RLS si no está habilitado
ALTER TABLE public.debt_installments ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Users can view own debt installments" ON public.debt_installments;
DROP POLICY IF EXISTS "Users can create debt installments as creditor" ON public.debt_installments;
DROP POLICY IF EXISTS "Users can update debt installments" ON public.debt_installments;
DROP POLICY IF EXISTS "Users can view their debt installments" ON public.debt_installments;
DROP POLICY IF EXISTS "Users can create debt installments" ON public.debt_installments;
DROP POLICY IF EXISTS "Users can update their debt installments" ON public.debt_installments;

-- Crear políticas mejoradas con mejor manejo de errores
CREATE POLICY "Users can view own debt installments"
  ON public.debt_installments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.debts
      WHERE debts.id = debt_installments.debt_id
        AND (debts.creditor_id = auth.uid() OR debts.debtor_id = auth.uid())
    )
  );

CREATE POLICY "Users can create debt installments as creditor"
  ON public.debt_installments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.debts
      WHERE debts.id = debt_installments.debt_id
        AND debts.creditor_id = auth.uid()
    )
  );

CREATE POLICY "Users can update debt installments"
  ON public.debt_installments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.debts
      WHERE debts.id = debt_installments.debt_id
        AND (debts.creditor_id = auth.uid() OR debts.debtor_id = auth.uid())
    )
  );

-- Agregar columna updated_at si no existe
ALTER TABLE public.debt_installments 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Crear o reemplazar función para updated_at
CREATE OR REPLACE FUNCTION update_debt_installments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para updated_at
DROP TRIGGER IF EXISTS update_debt_installments_updated_at ON public.debt_installments;
CREATE TRIGGER update_debt_installments_updated_at
  BEFORE UPDATE ON public.debt_installments
  FOR EACH ROW
  EXECUTE FUNCTION update_debt_installments_updated_at();

-- Verificación
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ debt_installments RLS ACTUALIZADO';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Políticas creadas:';
  RAISE NOTICE '  ✓ SELECT: Users can view own debt installments';
  RAISE NOTICE '  ✓ INSERT: Users can create debt installments as creditor';
  RAISE NOTICE '  ✓ UPDATE: Users can update debt installments';
  RAISE NOTICE '';
  RAISE NOTICE 'Esto debería resolver:';
  RAISE NOTICE '  • Error 400 en consultas a debt_installments';
  RAISE NOTICE '  • Permisos incorrectos de RLS';
  RAISE NOTICE '========================================';
END $$;

-- Mostrar políticas actuales
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'debt_installments'
ORDER BY policyname;
