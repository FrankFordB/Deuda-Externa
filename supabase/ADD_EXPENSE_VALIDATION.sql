-- =====================================================
-- SISTEMA DE VALIDACIÓN DE GASTOS COMPARTIDOS
-- Los gastos creados requieren validación de otros participantes
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. AGREGAR COLUMNA DE ESTADO A SHARED_EXPENSES
-- =====================================================
ALTER TABLE public.shared_expenses 
ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'approved' 
  CHECK (validation_status IN ('pending', 'approved', 'rejected'));

-- Índice para filtrar por estado
CREATE INDEX IF NOT EXISTS idx_shared_expenses_validation 
  ON public.shared_expenses(validation_status);

-- =====================================================
-- 2. TABLA: shared_expense_validations
-- Rastrea quién debe validar y quién ya validó
-- =====================================================
CREATE TABLE IF NOT EXISTS public.shared_expense_validations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID NOT NULL REFERENCES public.shared_expenses(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.expense_group_members(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- Usuario real que debe validar
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  responded_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(expense_id, member_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_expense_validations_expense 
  ON public.shared_expense_validations(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_validations_user 
  ON public.shared_expense_validations(user_id);
CREATE INDEX IF NOT EXISTS idx_expense_validations_status 
  ON public.shared_expense_validations(status);

-- =====================================================
-- 3. RLS POLICIES para shared_expense_validations
-- =====================================================
ALTER TABLE public.shared_expense_validations ENABLE ROW LEVEL SECURITY;

-- Ver validaciones de gastos donde participo
DROP POLICY IF EXISTS "Users can view validations for their expenses" ON public.shared_expense_validations;
CREATE POLICY "Users can view validations for their expenses"
  ON public.shared_expense_validations FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.shared_expenses se
      WHERE se.id = expense_id AND se.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.expense_group_members egm
      JOIN public.shared_expenses se ON se.group_id = egm.group_id
      WHERE se.id = expense_id AND egm.user_id = auth.uid()
    )
  );

-- Crear validaciones (solo el creador del gasto)
DROP POLICY IF EXISTS "Expense creators can insert validations" ON public.shared_expense_validations;
CREATE POLICY "Expense creators can insert validations"
  ON public.shared_expense_validations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shared_expenses se
      WHERE se.id = expense_id AND se.created_by = auth.uid()
    )
  );

-- Actualizar mi propia validación
DROP POLICY IF EXISTS "Users can update their own validations" ON public.shared_expense_validations;
CREATE POLICY "Users can update their own validations"
  ON public.shared_expense_validations FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- 4. FUNCIÓN: Aprobar gasto compartido
-- =====================================================
CREATE OR REPLACE FUNCTION approve_shared_expense(
  p_expense_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_validation_id UUID;
  v_pending_count INT;
  v_total_validations INT;
  v_expense_creator UUID;
BEGIN
  -- Actualizar la validación del usuario
  UPDATE public.shared_expense_validations
  SET status = 'approved',
      responded_at = NOW()
  WHERE expense_id = p_expense_id 
    AND user_id = p_user_id
    AND status = 'pending'
  RETURNING id INTO v_validation_id;
  
  IF v_validation_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Validación no encontrada o ya procesada');
  END IF;
  
  -- Contar validaciones pendientes
  SELECT 
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*)
  INTO v_pending_count, v_total_validations
  FROM public.shared_expense_validations
  WHERE expense_id = p_expense_id;
  
  -- Si no quedan pendientes, aprobar el gasto
  IF v_pending_count = 0 THEN
    UPDATE public.shared_expenses
    SET validation_status = 'approved',
        updated_at = NOW()
    WHERE id = p_expense_id
    RETURNING created_by INTO v_expense_creator;
    
    RETURN jsonb_build_object(
      'success', true, 
      'expense_approved', true,
      'creator_id', v_expense_creator,
      'message', 'Gasto aprobado por todos los participantes'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true, 
    'expense_approved', false,
    'pending_count', v_pending_count,
    'message', 'Validación registrada, faltan ' || v_pending_count || ' aprobaciones'
  );
END;
$$;

-- =====================================================
-- 5. FUNCIÓN: Rechazar gasto compartido
-- =====================================================
CREATE OR REPLACE FUNCTION reject_shared_expense(
  p_expense_id UUID,
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_validation_id UUID;
  v_expense_creator UUID;
  v_expense_desc TEXT;
BEGIN
  -- Actualizar la validación del usuario
  UPDATE public.shared_expense_validations
  SET status = 'rejected',
      responded_at = NOW(),
      rejection_reason = p_reason
  WHERE expense_id = p_expense_id 
    AND user_id = p_user_id
    AND status = 'pending'
  RETURNING id INTO v_validation_id;
  
  IF v_validation_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Validación no encontrada o ya procesada');
  END IF;
  
  -- Marcar el gasto como rechazado
  UPDATE public.shared_expenses
  SET validation_status = 'rejected',
      updated_at = NOW()
  WHERE id = p_expense_id
  RETURNING created_by, description INTO v_expense_creator, v_expense_desc;
  
  RETURN jsonb_build_object(
    'success', true, 
    'expense_rejected', true,
    'creator_id', v_expense_creator,
    'expense_description', v_expense_desc,
    'message', 'Gasto rechazado'
  );
END;
$$;

-- =====================================================
-- 6. FUNCIÓN: Obtener gastos pendientes de validación
-- =====================================================
CREATE OR REPLACE FUNCTION get_pending_expense_validations(p_user_id UUID)
RETURNS TABLE (
  validation_id UUID,
  expense_id UUID,
  expense_description TEXT,
  expense_amount DECIMAL,
  expense_date DATE,
  expense_category TEXT,
  currency_symbol TEXT,
  group_id UUID,
  group_name TEXT,
  creator_id UUID,
  creator_name TEXT,
  your_share DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sev.id AS validation_id,
    se.id AS expense_id,
    se.description AS expense_description,
    se.total_amount AS expense_amount,
    se.expense_date,
    se.category AS expense_category,
    COALESCE(se.currency_symbol, '$') AS currency_symbol,
    eg.id AS group_id,
    eg.name AS group_name,
    se.created_by AS creator_id,
    COALESCE(p.first_name || ' ' || p.last_name, p.email, 'Usuario') AS creator_name,
    COALESCE(ses.amount_owed, 0) AS your_share,
    se.created_at
  FROM public.shared_expense_validations sev
  JOIN public.shared_expenses se ON se.id = sev.expense_id
  JOIN public.expense_groups eg ON eg.id = se.group_id
  JOIN public.profiles p ON p.id = se.created_by
  LEFT JOIN public.expense_group_members egm ON egm.group_id = se.group_id AND egm.user_id = p_user_id
  LEFT JOIN public.shared_expense_splits ses ON ses.expense_id = se.id AND ses.member_id = egm.id
  WHERE sev.user_id = p_user_id
    AND sev.status = 'pending'
    AND se.validation_status = 'pending'
  ORDER BY se.created_at DESC;
END;
$$;

-- =====================================================
-- 7. Actualizar gastos existentes a 'approved'
-- (para que los gastos anteriores no queden en estado inválido)
-- =====================================================
UPDATE public.shared_expenses 
SET validation_status = 'approved' 
WHERE validation_status IS NULL;

-- =====================================================
-- 8. GRANT permisos
-- =====================================================
GRANT EXECUTE ON FUNCTION approve_shared_expense TO authenticated;
GRANT EXECUTE ON FUNCTION reject_shared_expense TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_expense_validations TO authenticated;
GRANT ALL ON public.shared_expense_validations TO authenticated;

-- =====================================================
-- RESUMEN:
-- 1. Los gastos nuevos se crean con validation_status = 'pending'
-- 2. Se crean registros en shared_expense_validations para cada participante
--    (excepto el creador del gasto)
-- 3. Cada participante debe aprobar o rechazar
-- 4. Si TODOS aprueban → el gasto pasa a 'approved' y se incluye en cálculos
-- 5. Si ALGUNO rechaza → el gasto pasa a 'rejected' y se notifica al creador
-- =====================================================
