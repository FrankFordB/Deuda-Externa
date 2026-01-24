-- =====================================================
-- SISTEMA DE VALIDACIÓN PARA ACCIONES (ELIMINAR/MODIFICAR)
-- Las acciones sobre gastos compartidos requieren validación
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. TABLA: action_validations
-- Para solicitar validación de eliminar/modificar gastos
-- =====================================================
CREATE TABLE IF NOT EXISTS public.action_validations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID NOT NULL REFERENCES public.shared_expenses(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('delete', 'modify')),
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  
  -- Para modificaciones: datos propuestos
  proposed_changes JSONB, -- {description, total_amount, expense_date, splits: [...]}
  
  -- Razón de solicitud
  reason TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES public.profiles(id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_action_validations_expense 
  ON public.action_validations(expense_id);
CREATE INDEX IF NOT EXISTS idx_action_validations_requested_by 
  ON public.action_validations(requested_by);
CREATE INDEX IF NOT EXISTS idx_action_validations_status 
  ON public.action_validations(status);

-- =====================================================
-- 2. TABLA: action_validation_responses
-- Respuestas de cada participante
-- =====================================================
CREATE TABLE IF NOT EXISTS public.action_validation_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_validation_id UUID NOT NULL REFERENCES public.action_validations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  responded_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(action_validation_id, user_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_action_validation_responses_action 
  ON public.action_validation_responses(action_validation_id);
CREATE INDEX IF NOT EXISTS idx_action_validation_responses_user 
  ON public.action_validation_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_action_validation_responses_status 
  ON public.action_validation_responses(status);

-- =====================================================
-- 3. RLS POLICIES
-- =====================================================
ALTER TABLE public.action_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_validation_responses ENABLE ROW LEVEL SECURITY;

-- Políticas para action_validations
DROP POLICY IF EXISTS "Users can view action validations for their expenses" ON public.action_validations;
CREATE POLICY "Users can view action validations for their expenses"
  ON public.action_validations FOR SELECT
  USING (
    requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.shared_expenses se
      JOIN public.expense_group_members egm ON egm.group_id = se.group_id
      WHERE se.id = expense_id AND egm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create action validations" ON public.action_validations;
CREATE POLICY "Users can create action validations"
  ON public.action_validations FOR INSERT
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.expense_group_members egm
      JOIN public.shared_expenses se ON se.group_id = egm.group_id
      WHERE se.id = expense_id AND egm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Requester can cancel their requests" ON public.action_validations;
CREATE POLICY "Requester can cancel their requests"
  ON public.action_validations FOR UPDATE
  USING (requested_by = auth.uid());

-- Políticas para action_validation_responses
DROP POLICY IF EXISTS "Users can view their responses" ON public.action_validation_responses;
CREATE POLICY "Users can view their responses"
  ON public.action_validation_responses FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.action_validations av
      WHERE av.id = action_validation_id AND av.requested_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "System can create responses" ON public.action_validation_responses;
CREATE POLICY "System can create responses"
  ON public.action_validation_responses FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own responses" ON public.action_validation_responses;
CREATE POLICY "Users can update their own responses"
  ON public.action_validation_responses FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- 4. FUNCIÓN: Solicitar eliminación de gasto compartido
-- =====================================================
CREATE OR REPLACE FUNCTION request_expense_deletion(
  p_expense_id UUID,
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_action_id UUID;
  v_expense_creator UUID;
  v_group_id UUID;
  v_member RECORD;
  v_notified_count INT := 0;
BEGIN
  -- Verificar que el gasto existe y obtener info
  SELECT created_by, group_id INTO v_expense_creator, v_group_id
  FROM public.shared_expenses
  WHERE id = p_expense_id;
  
  IF v_expense_creator IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gasto no encontrado');
  END IF;
  
  -- Verificar que el usuario es parte del grupo
  IF NOT EXISTS (
    SELECT 1 FROM public.expense_group_members
    WHERE group_id = v_group_id AND user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'No eres parte de este grupo');
  END IF;
  
  -- Verificar que no hay otra solicitud pendiente
  IF EXISTS (
    SELECT 1 FROM public.action_validations
    WHERE expense_id = p_expense_id AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ya hay una solicitud pendiente para este gasto');
  END IF;
  
  -- Crear la solicitud de eliminación
  INSERT INTO public.action_validations (expense_id, action_type, requested_by, reason)
  VALUES (p_expense_id, 'delete', p_user_id, p_reason)
  RETURNING id INTO v_action_id;
  
  -- Crear respuestas pendientes para cada participante (excepto quien solicita)
  FOR v_member IN
    SELECT egm.user_id
    FROM public.expense_group_members egm
    WHERE egm.group_id = v_group_id 
      AND egm.user_id IS NOT NULL 
      AND egm.user_id != p_user_id
  LOOP
    INSERT INTO public.action_validation_responses (action_validation_id, user_id)
    VALUES (v_action_id, v_member.user_id);
    v_notified_count := v_notified_count + 1;
  END LOOP;
  
  -- Si no hay otros participantes reales, aprobar automáticamente
  IF v_notified_count = 0 THEN
    UPDATE public.action_validations
    SET status = 'approved', resolved_at = NOW()
    WHERE id = v_action_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'action_id', v_action_id,
      'auto_approved', true,
      'message', 'Solicitud aprobada automáticamente (no hay otros participantes)'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'action_id', v_action_id,
    'auto_approved', false,
    'pending_count', v_notified_count,
    'message', 'Solicitud enviada, esperando ' || v_notified_count || ' aprobación(es)'
  );
END;
$$;

-- =====================================================
-- 5. FUNCIÓN: Aprobar solicitud de acción
-- =====================================================
CREATE OR REPLACE FUNCTION approve_action_request(
  p_action_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_response_id UUID;
  v_pending_count INT;
  v_action_type TEXT;
  v_expense_id UUID;
BEGIN
  -- Actualizar la respuesta del usuario
  UPDATE public.action_validation_responses
  SET status = 'approved',
      responded_at = NOW()
  WHERE action_validation_id = p_action_id 
    AND user_id = p_user_id
    AND status = 'pending'
  RETURNING id INTO v_response_id;
  
  IF v_response_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Respuesta no encontrada o ya procesada');
  END IF;
  
  -- Contar respuestas pendientes
  SELECT COUNT(*) INTO v_pending_count
  FROM public.action_validation_responses
  WHERE action_validation_id = p_action_id AND status = 'pending';
  
  -- Obtener info de la acción
  SELECT action_type, expense_id INTO v_action_type, v_expense_id
  FROM public.action_validations
  WHERE id = p_action_id;
  
  -- Si no quedan pendientes, ejecutar la acción
  IF v_pending_count = 0 THEN
    UPDATE public.action_validations
    SET status = 'approved',
        resolved_at = NOW(),
        resolved_by = p_user_id
    WHERE id = p_action_id;
    
    -- Si es eliminación, eliminar el gasto
    IF v_action_type = 'delete' THEN
      DELETE FROM public.shared_expenses WHERE id = v_expense_id;
    END IF;
    
    RETURN jsonb_build_object(
      'success', true, 
      'action_approved', true,
      'action_executed', true,
      'message', 'Acción aprobada y ejecutada'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true, 
    'action_approved', false,
    'pending_count', v_pending_count,
    'message', 'Aprobación registrada, faltan ' || v_pending_count || ' aprobaciones'
  );
END;
$$;

-- =====================================================
-- 6. FUNCIÓN: Rechazar solicitud de acción
-- =====================================================
CREATE OR REPLACE FUNCTION reject_action_request(
  p_action_id UUID,
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_response_id UUID;
  v_requester_id UUID;
BEGIN
  -- Actualizar la respuesta del usuario
  UPDATE public.action_validation_responses
  SET status = 'rejected',
      responded_at = NOW(),
      rejection_reason = p_reason
  WHERE action_validation_id = p_action_id 
    AND user_id = p_user_id
    AND status = 'pending'
  RETURNING id INTO v_response_id;
  
  IF v_response_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Respuesta no encontrada o ya procesada');
  END IF;
  
  -- Marcar toda la solicitud como rechazada
  UPDATE public.action_validations
  SET status = 'rejected',
      resolved_at = NOW(),
      resolved_by = p_user_id
  WHERE id = p_action_id
  RETURNING requested_by INTO v_requester_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'action_rejected', true,
    'requester_id', v_requester_id,
    'message', 'Solicitud rechazada'
  );
END;
$$;

-- =====================================================
-- 7. FUNCIÓN: Cancelar solicitud propia
-- =====================================================
CREATE OR REPLACE FUNCTION cancel_action_request(
  p_action_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Solo el solicitante puede cancelar
  UPDATE public.action_validations
  SET status = 'cancelled',
      resolved_at = NOW()
  WHERE id = p_action_id 
    AND requested_by = p_user_id
    AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No puedes cancelar esta solicitud');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'message', 'Solicitud cancelada');
END;
$$;

-- =====================================================
-- 8. FUNCIÓN: Obtener solicitudes pendientes para un usuario
-- =====================================================
CREATE OR REPLACE FUNCTION get_pending_action_requests(p_user_id UUID)
RETURNS TABLE (
  response_id UUID,
  action_id UUID,
  action_type TEXT,
  expense_id UUID,
  expense_description TEXT,
  expense_amount DECIMAL,
  currency_symbol TEXT,
  group_name TEXT,
  requester_id UUID,
  requester_name TEXT,
  reason TEXT,
  proposed_changes JSONB,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    avr.id AS response_id,
    av.id AS action_id,
    av.action_type,
    se.id AS expense_id,
    se.description AS expense_description,
    se.total_amount AS expense_amount,
    COALESCE(se.currency_symbol, '$') AS currency_symbol,
    eg.name AS group_name,
    av.requested_by AS requester_id,
    COALESCE(p.first_name || ' ' || p.last_name, p.email, 'Usuario') AS requester_name,
    av.reason,
    av.proposed_changes,
    av.created_at
  FROM public.action_validation_responses avr
  JOIN public.action_validations av ON av.id = avr.action_validation_id
  JOIN public.shared_expenses se ON se.id = av.expense_id
  JOIN public.expense_groups eg ON eg.id = se.group_id
  JOIN public.profiles p ON p.id = av.requested_by
  WHERE avr.user_id = p_user_id
    AND avr.status = 'pending'
    AND av.status = 'pending'
  ORDER BY av.created_at DESC;
END;
$$;

-- =====================================================
-- 9. FUNCIÓN: Obtener mis solicitudes enviadas
-- =====================================================
CREATE OR REPLACE FUNCTION get_my_action_requests(p_user_id UUID)
RETURNS TABLE (
  action_id UUID,
  action_type TEXT,
  expense_id UUID,
  expense_description TEXT,
  expense_amount DECIMAL,
  currency_symbol TEXT,
  group_name TEXT,
  status TEXT,
  reason TEXT,
  approved_count INT,
  pending_count INT,
  total_count INT,
  created_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    av.id AS action_id,
    av.action_type,
    se.id AS expense_id,
    se.description AS expense_description,
    se.total_amount AS expense_amount,
    COALESCE(se.currency_symbol, '$') AS currency_symbol,
    eg.name AS group_name,
    av.status,
    av.reason,
    (SELECT COUNT(*)::INT FROM public.action_validation_responses WHERE action_validation_id = av.id AND status = 'approved') AS approved_count,
    (SELECT COUNT(*)::INT FROM public.action_validation_responses WHERE action_validation_id = av.id AND status = 'pending') AS pending_count,
    (SELECT COUNT(*)::INT FROM public.action_validation_responses WHERE action_validation_id = av.id) AS total_count,
    av.created_at,
    av.resolved_at
  FROM public.action_validations av
  JOIN public.shared_expenses se ON se.id = av.expense_id
  JOIN public.expense_groups eg ON eg.id = se.group_id
  WHERE av.requested_by = p_user_id
  ORDER BY av.created_at DESC;
END;
$$;

-- =====================================================
-- 10. GRANT permisos
-- =====================================================
GRANT EXECUTE ON FUNCTION request_expense_deletion TO authenticated;
GRANT EXECUTE ON FUNCTION approve_action_request TO authenticated;
GRANT EXECUTE ON FUNCTION reject_action_request TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_action_request TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_action_requests TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_action_requests TO authenticated;
GRANT ALL ON public.action_validations TO authenticated;
GRANT ALL ON public.action_validation_responses TO authenticated;

-- =====================================================
-- RESUMEN DEL FLUJO:
-- 1. Usuario A quiere eliminar un gasto compartido
-- 2. Se crea una solicitud (action_validations) con tipo 'delete'
-- 3. Se crean respuestas pendientes para cada otro participante
-- 4. Cada participante recibe notificación y puede aprobar/rechazar
-- 5. Si TODOS aprueban → se ejecuta la eliminación
-- 6. Si ALGUNO rechaza → se rechaza la solicitud
-- 7. El solicitante puede cancelar mientras está pendiente
-- =====================================================

-- =====================================================
-- 11. HABILITAR REALTIME PARA ACTUALIZACIONES EN VIVO
-- =====================================================
-- Esto permite que los cambios se reflejen instantáneamente en el frontend

DO $$
BEGIN
  -- Agregar shared_expenses a realtime
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_expenses';
    RAISE NOTICE 'Tabla shared_expenses agregada a realtime';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'shared_expenses ya está en realtime';
  WHEN OTHERS THEN
    RAISE NOTICE 'shared_expenses: %', SQLERRM;
  END;
  
  -- Agregar action_validations a realtime
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.action_validations';
    RAISE NOTICE 'Tabla action_validations agregada a realtime';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'action_validations ya está en realtime';
  WHEN OTHERS THEN
    RAISE NOTICE 'action_validations: %', SQLERRM;
  END;
  
  -- Agregar action_validation_responses a realtime
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.action_validation_responses';
    RAISE NOTICE 'Tabla action_validation_responses agregada a realtime';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'action_validation_responses ya está en realtime';
  WHEN OTHERS THEN
    RAISE NOTICE 'action_validation_responses: %', SQLERRM;
  END;
END $$;

-- Verificar tablas en realtime
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename;
