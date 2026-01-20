-- =====================================================
-- Sistema de Solicitudes de Cambios para Deudas y Gastos
-- Este sistema permite que los cambios en deudas/gastos 
-- compartidos requieran aprobación del otro usuario
-- =====================================================

-- Tabla para solicitudes de cambios
CREATE TABLE IF NOT EXISTS public.change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Usuario que solicita el cambio
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Usuario que debe aprobar el cambio
  approver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Tipo de entidad afectada
  entity_type TEXT NOT NULL CHECK (entity_type IN ('debt', 'expense')),
  
  -- ID de la entidad afectada
  entity_id UUID NOT NULL,
  
  -- Tipo de acción
  action_type TEXT NOT NULL CHECK (action_type IN ('create', 'update', 'delete', 'mark_paid')),
  
  -- Estado de la solicitud
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  
  -- Datos del cambio (JSON con los cambios propuestos)
  change_data JSONB NOT NULL,
  
  -- Razón del cambio (opcional)
  reason TEXT,
  
  -- Respuesta del aprobador
  response_message TEXT,
  
  -- Fecha de respuesta
  responded_at TIMESTAMPTZ
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_change_requests_requester ON public.change_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_approver ON public.change_requests(approver_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_status ON public.change_requests(status);
CREATE INDEX IF NOT EXISTS idx_change_requests_entity ON public.change_requests(entity_type, entity_id);

-- RLS Policies
ALTER TABLE public.change_requests ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas si existen
DROP POLICY IF EXISTS "Users can view own change requests" ON public.change_requests;
DROP POLICY IF EXISTS "Users can create change requests" ON public.change_requests;
DROP POLICY IF EXISTS "Approvers can update change requests" ON public.change_requests;

-- Los usuarios pueden ver las solicitudes que hicieron o que deben aprobar
CREATE POLICY "Users can view own change requests"
  ON public.change_requests FOR SELECT
  USING (
    auth.uid() = requester_id OR 
    auth.uid() = approver_id
  );

-- Los usuarios pueden crear solicitudes de cambio
CREATE POLICY "Users can create change requests"
  ON public.change_requests FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

-- Solo el aprobador puede actualizar (aprobar/rechazar)
CREATE POLICY "Approvers can update change requests"
  ON public.change_requests FOR UPDATE
  USING (auth.uid() = approver_id)
  WITH CHECK (auth.uid() = approver_id);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_change_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_change_requests_updated_at ON public.change_requests;
CREATE TRIGGER trigger_update_change_requests_updated_at
  BEFORE UPDATE ON public.change_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_change_requests_updated_at();

-- =====================================================
-- Función para aplicar cambio aprobado en deudas
-- =====================================================
CREATE OR REPLACE FUNCTION apply_approved_debt_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo procesar cuando el estado cambia a 'approved'
  IF NEW.status = 'approved' AND OLD.status = 'pending' AND NEW.entity_type = 'debt' THEN
    
    CASE NEW.action_type
      -- CREAR nueva deuda
      WHEN 'create' THEN
        INSERT INTO public.debts (
          creditor_id,
          debtor_id,
          debtor_type,
          amount,
          description,
          category,
          installments,
          purchase_date,
          due_date,
          status
        )
        VALUES (
          (NEW.change_data->>'creditor_id')::UUID,
          (NEW.change_data->>'debtor_id')::UUID,
          NEW.change_data->>'debtor_type',
          (NEW.change_data->>'amount')::DECIMAL,
          NEW.change_data->>'description',
          COALESCE(NEW.change_data->>'category', 'other'),
          COALESCE((NEW.change_data->>'installments')::INT, 1),
          (NEW.change_data->>'purchase_date')::DATE,
          (NEW.change_data->>'due_date')::DATE,
          'accepted'
        );
      
      -- ACTUALIZAR deuda existente
      WHEN 'update' THEN
        UPDATE public.debts
        SET
          amount = COALESCE((NEW.change_data->>'amount')::DECIMAL, amount),
          description = COALESCE(NEW.change_data->>'description', description),
          category = COALESCE(NEW.change_data->>'category', category),
          installments = COALESCE((NEW.change_data->>'installments')::INT, installments),
          purchase_date = COALESCE((NEW.change_data->>'purchase_date')::DATE, purchase_date),
          due_date = COALESCE((NEW.change_data->>'due_date')::DATE, due_date),
          updated_at = NOW()
        WHERE id = NEW.entity_id;
      
      -- MARCAR COMO PAGADA
      WHEN 'mark_paid' THEN
        UPDATE public.debts
        SET 
          status = 'paid',
          updated_at = NOW()
        WHERE id = NEW.entity_id;
      
      -- ELIMINAR deuda
      WHEN 'delete' THEN
        DELETE FROM public.debts
        WHERE id = NEW.entity_id;
    END CASE;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_apply_approved_debt_change ON public.change_requests;
-- Trigger para aplicar cambios aprobados
CREATE TRIGGER trigger_apply_approved_debt_change
  AFTER UPDATE ON public.change_requests
  FOR EACH ROW
  EXECUTE FUNCTION apply_approved_debt_change();

-- =====================================================
-- Función para aplicar cambio aprobado en gastos
-- =====================================================
CREATE OR REPLACE FUNCTION apply_approved_expense_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo procesar cuando el estado cambia a 'approved'
  IF NEW.status = 'approved' AND OLD.status = 'pending' AND NEW.entity_type = 'expense' THEN
    
    CASE NEW.action_type
      -- ACTUALIZAR gasto existente
      WHEN 'update' THEN
        UPDATE public.expenses
        SET
          amount = COALESCE((NEW.change_data->>'amount')::DECIMAL, amount),
          description = COALESCE(NEW.change_data->>'description', description),
          category = COALESCE(NEW.change_data->>'category', category),
          date = COALESCE((NEW.change_data->>'date')::DATE, date),
          updated_at = NOW()
        WHERE id = NEW.entity_id;
      
      -- ELIMINAR gasto
      WHEN 'delete' THEN
        DELETE FROM public.expenses
        WHERE id = NEW.entity_id;
    END CASE;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_apply_approved_expense_change ON public.change_requests;
-- Trigger para aplicar cambios aprobados en gastos
CREATE TRIGGER trigger_apply_approved_expense_change
  AFTER UPDATE ON public.change_requests
  FOR EACH ROW
  EXECUTE FUNCTION apply_approved_expense_change();

-- =====================================================
-- Función helper para crear solicitud de cambio
-- =====================================================
CREATE OR REPLACE FUNCTION create_change_request(
  p_requester_id UUID,
  p_approver_id UUID,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_action_type TEXT,
  p_change_data JSONB,
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_request_id UUID;
BEGIN
  INSERT INTO public.change_requests (
    requester_id,
    approver_id,
    entity_type,
    entity_id,
    action_type,
    change_data,
    reason
  )
  VALUES (
    p_requester_id,
    p_approver_id,
    p_entity_type,
    p_entity_id,
    p_action_type,
    p_change_data,
    p_reason
  )
  RETURNING id INTO v_request_id;
  
  RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Vistas útiles
-- =====================================================

-- Eliminar vista si existe
DROP VIEW IF EXISTS public.pending_change_requests_detailed;

-- Vista de solicitudes pendientes con información completa
CREATE VIEW public.pending_change_requests_detailed AS
SELECT 
  cr.id,
  cr.created_at,
  cr.entity_type,
  cr.entity_id,
  cr.action_type,
  cr.change_data,
  cr.reason,
  cr.status,
  
  -- Datos del solicitante
  requester.id as requester_id,
  requester.first_name as requester_first_name,
  requester.last_name as requester_last_name,
  requester.nickname as requester_nickname,
  
  -- Datos del aprobador
  approver.id as approver_id,
  approver.first_name as approver_first_name,
  approver.last_name as approver_last_name,
  approver.nickname as approver_nickname
  
FROM public.change_requests cr
JOIN public.profiles requester ON requester.id = cr.requester_id
JOIN public.profiles approver ON approver.id = cr.approver_id
WHERE cr.status = 'pending'
ORDER BY cr.created_at DESC;

-- Comentarios
COMMENT ON TABLE public.change_requests IS 'Solicitudes de cambios que requieren aprobación de otro usuario';
COMMENT ON FUNCTION create_change_request IS 'Helper para crear solicitudes de cambio de manera segura';
COMMENT ON VIEW public.pending_change_requests_detailed IS 'Vista con información completa de solicitudes pendientes';
