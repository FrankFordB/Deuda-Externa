-- =====================================================
-- SISTEMA DE CONFIRMACIÓN DE PAGOS
-- Tabla para solicitudes de pago y notificaciones
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- Tabla para solicitudes de pago (cuando alguien dice "ya pagué" o "cobrar")
CREATE TABLE IF NOT EXISTS public.shared_payment_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID REFERENCES public.shared_expenses(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.expense_groups(id) ON DELETE CASCADE,
  
  -- Quién dice que pagó (deudor)
  debtor_member_id UUID NOT NULL REFERENCES public.expense_group_members(id) ON DELETE CASCADE,
  debtor_user_id UUID REFERENCES auth.users(id),
  
  -- A quién le pagó (acreedor)
  creditor_member_id UUID NOT NULL REFERENCES public.expense_group_members(id) ON DELETE CASCADE,
  creditor_user_id UUID REFERENCES auth.users(id),
  
  -- Monto del pago
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'ARS',
  currency_symbol VARCHAR(5) DEFAULT '$',
  
  -- Tipo de solicitud: 'payment_claim' (ya pagué) o 'collection_request' (cobrar)
  request_type VARCHAR(30) DEFAULT 'payment_claim',
  
  -- Estado: pending, confirmed, rejected
  status VARCHAR(20) DEFAULT 'pending',
  
  -- Notas
  debtor_notes TEXT,
  creditor_notes TEXT,
  
  -- Para registrar en cuenta bancaria al confirmar
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'confirmed', 'rejected')),
  CONSTRAINT valid_request_type CHECK (request_type IN ('payment_claim', 'collection_request'))
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_payment_requests_expense ON public.shared_payment_requests(expense_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_debtor ON public.shared_payment_requests(debtor_user_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_creditor ON public.shared_payment_requests(creditor_user_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON public.shared_payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_group ON public.shared_payment_requests(group_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_type ON public.shared_payment_requests(request_type);

-- Habilitar RLS
ALTER TABLE public.shared_payment_requests ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si las hay
DROP POLICY IF EXISTS "payment_requests_select" ON public.shared_payment_requests;
DROP POLICY IF EXISTS "payment_requests_insert" ON public.shared_payment_requests;
DROP POLICY IF EXISTS "payment_requests_update" ON public.shared_payment_requests;

-- Políticas RLS
CREATE POLICY "payment_requests_select" ON public.shared_payment_requests
  FOR SELECT USING (
    debtor_user_id = auth.uid() OR
    creditor_user_id = auth.uid() OR
    public.is_group_member(auth.uid(), group_id)
  );

-- El deudor puede insertar 'payment_claim', el acreedor puede insertar 'collection_request'
CREATE POLICY "payment_requests_insert" ON public.shared_payment_requests
  FOR INSERT WITH CHECK (
    (request_type = 'payment_claim' AND debtor_user_id = auth.uid()) OR
    (request_type = 'collection_request' AND creditor_user_id = auth.uid())
  );

-- Solo el acreedor puede actualizar (confirmar/rechazar payment_claim)
-- Solo el deudor puede actualizar (confirmar collection_request)
CREATE POLICY "payment_requests_update" ON public.shared_payment_requests
  FOR UPDATE USING (
    (request_type = 'payment_claim' AND creditor_user_id = auth.uid()) OR
    (request_type = 'collection_request' AND debtor_user_id = auth.uid())
  );

-- =====================================================
-- Trigger para crear notificación cuando se crea una solicitud de pago
-- =====================================================

CREATE OR REPLACE FUNCTION public.notify_payment_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_debtor_name TEXT;
  v_creditor_name TEXT;
  v_group_name TEXT;
  v_notification_id UUID;
  v_target_user_id UUID;
  v_notification_type TEXT;
  v_notification_title TEXT;
  v_notification_message TEXT;
BEGIN
  -- Obtener nombre del deudor
  SELECT COALESCE(p.first_name || ' ' || p.last_name, em.display_name)
  INTO v_debtor_name
  FROM expense_group_members em
  LEFT JOIN profiles p ON em.user_id = p.id
  WHERE em.id = NEW.debtor_member_id;

  -- Obtener nombre del acreedor
  SELECT COALESCE(p.first_name || ' ' || p.last_name, em.display_name)
  INTO v_creditor_name
  FROM expense_group_members em
  LEFT JOIN profiles p ON em.user_id = p.id
  WHERE em.id = NEW.creditor_member_id;

  -- Obtener nombre del grupo
  SELECT name INTO v_group_name
  FROM expense_groups
  WHERE id = NEW.group_id;

  -- Determinar el tipo de notificación según el tipo de solicitud
  IF NEW.request_type = 'payment_claim' THEN
    -- El deudor dice que pagó → notificar al acreedor
    v_target_user_id := NEW.creditor_user_id;
    v_notification_type := 'payment_request';
    v_notification_title := 'Solicitud de pago';
    v_notification_message := v_debtor_name || ' dice que te pagó ' || NEW.currency_symbol || NEW.amount::TEXT || ' del grupo "' || v_group_name || '"';
  ELSE
    -- El acreedor quiere cobrar → notificar al deudor
    v_target_user_id := NEW.debtor_user_id;
    v_notification_type := 'collection_request';
    v_notification_title := 'Recordatorio de pago';
    v_notification_message := v_creditor_name || ' te recuerda que le debes ' || NEW.currency_symbol || NEW.amount::TEXT || ' del grupo "' || v_group_name || '"';
  END IF;

  -- Crear notificación
  IF v_target_user_id IS NOT NULL THEN
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      data,
      read
    ) VALUES (
      v_target_user_id,
      v_notification_type,
      v_notification_title,
      v_notification_message,
      jsonb_build_object(
        'request_id', NEW.id,
        'expense_id', NEW.expense_id,
        'group_id', NEW.group_id,
        'amount', NEW.amount,
        'request_type', NEW.request_type,
        'debtor_name', v_debtor_name,
        'creditor_name', v_creditor_name
      ),
      false
    )
    RETURNING id INTO v_notification_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Crear trigger
DROP TRIGGER IF EXISTS on_payment_request_created ON public.shared_payment_requests;
CREATE TRIGGER on_payment_request_created
  AFTER INSERT ON public.shared_payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_payment_request();

-- =====================================================
-- Función para confirmar un pago (el acreedor confirma que recibió el dinero)
-- Si se proporciona bank_account_id, registra el gasto REAL del acreedor
-- Ejemplo: Pagué 20, me devolvieron 10 → mi gasto real es 10
-- =====================================================

CREATE OR REPLACE FUNCTION public.confirm_payment_request(
  p_request_id UUID,
  p_notes TEXT DEFAULT NULL,
  p_bank_account_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
  v_creditor_name TEXT;
  v_debtor_name TEXT;
  v_group_name TEXT;
  v_expense_description TEXT;
  v_creditor_paid DECIMAL(12,2);
  v_creditor_share DECIMAL(12,2);
  v_real_expense DECIMAL(12,2);
  v_notification_id UUID;
BEGIN
  -- Obtener la solicitud
  SELECT * INTO v_request
  FROM shared_payment_requests
  WHERE id = p_request_id 
    AND ((request_type = 'payment_claim' AND creditor_user_id = auth.uid())
      OR (request_type = 'collection_request' AND debtor_user_id = auth.uid()));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitud no encontrada o sin permisos');
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'La solicitud ya fue procesada');
  END IF;

  -- Actualizar el estado de la solicitud
  UPDATE shared_payment_requests
  SET status = 'confirmed',
      responded_at = NOW(),
      creditor_notes = p_notes,
      bank_account_id = p_bank_account_id
  WHERE id = p_request_id;

  -- Actualizar el split correspondiente (marcar como pagado)
  IF v_request.expense_id IS NOT NULL THEN
    UPDATE shared_expense_splits
    SET amount_paid = COALESCE(amount_paid, 0) + v_request.amount,
        is_settled = (COALESCE(amount_paid, 0) + v_request.amount >= amount_owed)
    WHERE expense_id = v_request.expense_id
      AND member_id = v_request.debtor_member_id;
  END IF;

  -- Obtener nombre del acreedor y deudor
  SELECT COALESCE(p.first_name || ' ' || p.last_name, em.display_name)
  INTO v_creditor_name
  FROM expense_group_members em
  LEFT JOIN profiles p ON em.user_id = p.id
  WHERE em.id = v_request.creditor_member_id;

  SELECT COALESCE(p.first_name || ' ' || p.last_name, em.display_name)
  INTO v_debtor_name
  FROM expense_group_members em
  LEFT JOIN profiles p ON em.user_id = p.id
  WHERE em.id = v_request.debtor_member_id;

  -- Obtener nombre del grupo
  SELECT name INTO v_group_name
  FROM expense_groups
  WHERE id = v_request.group_id;

  -- Notificar según el tipo de solicitud
  IF v_request.request_type = 'payment_claim' THEN
    -- El deudor dijo "ya pagué", el acreedor confirma → notificar al deudor
    IF v_request.debtor_user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message, data, read)
      VALUES (
        v_request.debtor_user_id,
        'payment_confirmed',
        'Pago confirmado',
        v_creditor_name || ' confirmó tu pago de ' || v_request.currency_symbol || v_request.amount::TEXT,
        jsonb_build_object('request_id', p_request_id, 'group_id', v_request.group_id, 'amount', v_request.amount),
        false
      );
    END IF;
  ELSE
    -- El acreedor pidió cobrar, el deudor confirma → notificar al acreedor
    IF v_request.creditor_user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message, data, read)
      VALUES (
        v_request.creditor_user_id,
        'payment_received',
        'Pago recibido',
        v_debtor_name || ' te pagó ' || v_request.currency_symbol || v_request.amount::TEXT || ' del grupo "' || v_group_name || '"',
        jsonb_build_object('request_id', p_request_id, 'group_id', v_request.group_id, 'amount', v_request.amount),
        false
      );
    END IF;
  END IF;

  -- Verificar si el gasto completo está saldado
  IF v_request.expense_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM shared_expense_splits
    WHERE expense_id = v_request.expense_id AND is_settled = false
  ) THEN
    UPDATE shared_expenses
    SET is_settled = true, settled_at = NOW()
    WHERE id = v_request.expense_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Pago confirmado exitosamente',
    'amount_received', v_request.amount,
    'bank_account_id', p_bank_account_id
  );
END;
$$;

-- =====================================================
-- Función para rechazar un pago / "No pagó" 
-- El acreedor asume el gasto total que pagó originalmente
-- Ejemplo: Pagué 12 de 20, el otro debía 8 y no pagó → mi gasto real es 12
-- =====================================================

CREATE OR REPLACE FUNCTION public.reject_payment_request(
  p_request_id UUID,
  p_notes TEXT DEFAULT NULL,
  p_bank_account_id UUID DEFAULT NULL,
  p_assume_expense BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
  v_creditor_name TEXT;
  v_debtor_name TEXT;
  v_group_name TEXT;
BEGIN
  -- Obtener la solicitud
  SELECT * INTO v_request
  FROM shared_payment_requests
  WHERE id = p_request_id 
    AND ((request_type = 'payment_claim' AND creditor_user_id = auth.uid())
      OR (request_type = 'collection_request' AND debtor_user_id = auth.uid()));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitud no encontrada o sin permisos');
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'La solicitud ya fue procesada');
  END IF;

  -- Actualizar el estado
  UPDATE shared_payment_requests
  SET status = 'rejected',
      responded_at = NOW(),
      creditor_notes = p_notes,
      bank_account_id = p_bank_account_id
  WHERE id = p_request_id;

  -- Obtener nombres
  SELECT COALESCE(p.first_name || ' ' || p.last_name, em.display_name)
  INTO v_creditor_name
  FROM expense_group_members em
  LEFT JOIN profiles p ON em.user_id = p.id
  WHERE em.id = v_request.creditor_member_id;

  SELECT COALESCE(p.first_name || ' ' || p.last_name, em.display_name)
  INTO v_debtor_name
  FROM expense_group_members em
  LEFT JOIN profiles p ON em.user_id = p.id
  WHERE em.id = v_request.debtor_member_id;

  SELECT name INTO v_group_name
  FROM expense_groups WHERE id = v_request.group_id;

  -- Si el acreedor asume el gasto (p_assume_expense = true), marcar el split como saldado
  IF p_assume_expense AND v_request.expense_id IS NOT NULL THEN
    UPDATE shared_expense_splits
    SET is_settled = true,
        amount_paid = amount_owed  -- Se considera "pagado" porque el acreedor lo asume
    WHERE expense_id = v_request.expense_id
      AND member_id = v_request.debtor_member_id;

    -- Verificar si el gasto completo está saldado
    IF NOT EXISTS (
      SELECT 1 FROM shared_expense_splits
      WHERE expense_id = v_request.expense_id AND is_settled = false
    ) THEN
      UPDATE shared_expenses
      SET is_settled = true, settled_at = NOW()
      WHERE id = v_request.expense_id;
    END IF;
  END IF;

  -- Notificar según el tipo
  IF v_request.request_type = 'payment_claim' AND v_request.debtor_user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, data, read)
    VALUES (
      v_request.debtor_user_id,
      'payment_rejected',
      'Pago no confirmado',
      v_creditor_name || ' no confirmó tu pago de ' || v_request.currency_symbol || v_request.amount::TEXT,
      jsonb_build_object('request_id', p_request_id, 'group_id', v_request.group_id, 'reason', p_notes),
      false
    );
  ELSIF v_request.request_type = 'collection_request' AND v_request.creditor_user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, data, read)
    VALUES (
      v_request.creditor_user_id,
      'collection_declined',
      'Cobro declinado',
      v_debtor_name || ' no puede pagarte ' || v_request.currency_symbol || v_request.amount::TEXT,
      jsonb_build_object('request_id', p_request_id, 'group_id', v_request.group_id, 'reason', p_notes),
      false
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'message', CASE WHEN p_assume_expense THEN 'Gasto asumido correctamente' ELSE 'Solicitud rechazada' END,
    'assumed_expense', p_assume_expense,
    'bank_account_id', p_bank_account_id
  );
END;
$$;

-- =====================================================
-- Mensaje de éxito
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Sistema de confirmación de pagos creado exitosamente';
END $$;

-- =====================================================
-- Función para RESIGNAR DEUDA
-- El acreedor asume todo el gasto sin esperar que el deudor pague
-- Marca todos los splits pendientes como saldados
-- =====================================================

CREATE OR REPLACE FUNCTION public.resign_expense_debt(
  p_expense_id UUID,
  p_creditor_user_id UUID,
  p_bank_account_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense RECORD;
  v_creditor_member_id UUID;
  v_creditor_paid DECIMAL(12,2);
  v_total_resigned DECIMAL(12,2) := 0;
  v_group_name TEXT;
  v_debtor RECORD;
  v_creditor_name TEXT;
BEGIN
  -- Verificar que el usuario es el acreedor del gasto
  SELECT e.*, eg.name as group_name, eg.currency, eg.currency_symbol
  INTO v_expense
  FROM shared_expenses e
  JOIN expense_groups eg ON e.group_id = eg.id
  WHERE e.id = p_expense_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gasto no encontrado');
  END IF;

  IF v_expense.is_settled THEN
    RETURN jsonb_build_object('success', false, 'error', 'El gasto ya está saldado');
  END IF;

  -- Obtener el member_id del acreedor
  SELECT id INTO v_creditor_member_id
  FROM expense_group_members
  WHERE group_id = v_expense.group_id AND user_id = p_creditor_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No eres miembro de este grupo');
  END IF;

  -- Verificar que el usuario es pagador del gasto
  SELECT amount_paid INTO v_creditor_paid
  FROM shared_expense_payers
  WHERE expense_id = p_expense_id AND member_id = v_creditor_member_id;

  IF NOT FOUND OR v_creditor_paid IS NULL OR v_creditor_paid = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No eres pagador de este gasto');
  END IF;

  -- Calcular total a resignar (lo que deben los demás)
  SELECT COALESCE(SUM(amount_owed - COALESCE(amount_paid, 0)), 0)
  INTO v_total_resigned
  FROM shared_expense_splits
  WHERE expense_id = p_expense_id 
    AND member_id != v_creditor_member_id
    AND is_settled = false;

  IF v_total_resigned = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No hay deudas pendientes para resignar');
  END IF;

  -- Obtener el nombre del acreedor para la notificación
  SELECT COALESCE(p.first_name || ' ' || p.last_name, egm.display_name)
  INTO v_creditor_name
  FROM expense_group_members egm
  LEFT JOIN profiles p ON egm.user_id = p.id
  WHERE egm.id = v_creditor_member_id;

  -- Notificar a cada deudor que la deuda fue resignada
  FOR v_debtor IN 
    SELECT ses.member_id, ses.amount_owed, egm.user_id, 
           COALESCE(p.first_name || ' ' || p.last_name, egm.display_name) as debtor_name
    FROM shared_expense_splits ses
    JOIN expense_group_members egm ON ses.member_id = egm.id
    LEFT JOIN profiles p ON egm.user_id = p.id
    WHERE ses.expense_id = p_expense_id 
      AND ses.member_id != v_creditor_member_id
      AND ses.is_settled = false
  LOOP
    IF v_debtor.user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message, data, read)
      VALUES (
        v_debtor.user_id,
        'debt_resigned',
        'Tu amigo asumió el gasto',
        'Tu amigo se cansó de esperar tu pago y asumió el gasto, deberías pensar qué tipo de amigo quieres ser. ' || v_creditor_name || ' está triste por lo que pasó.',
        jsonb_build_object(
          'expense_id', p_expense_id, 
          'group_id', v_expense.group_id,
          'group_name', v_expense.group_name,
          'creditor_name', v_creditor_name
        ),
        false
      );
    END IF;
  END LOOP;

  -- Marcar todos los splits pendientes como saldados
  UPDATE shared_expense_splits
  SET is_settled = true,
      amount_paid = amount_owed
  WHERE expense_id = p_expense_id
    AND member_id != v_creditor_member_id
    AND is_settled = false;

  -- Marcar el split del acreedor como saldado también
  UPDATE shared_expense_splits
  SET is_settled = true,
      amount_paid = amount_owed
  WHERE expense_id = p_expense_id
    AND member_id = v_creditor_member_id;

  -- Marcar el gasto completo como saldado
  UPDATE shared_expenses
  SET is_settled = true
  WHERE id = p_expense_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Deuda resignada exitosamente',
    'total_resigned', v_total_resigned,
    'creditor_paid', v_creditor_paid,
    'bank_account_id', p_bank_account_id,
    'currency', v_expense.currency,
    'currency_symbol', v_expense.currency_symbol,
    'expense_description', v_expense.description
  );
END;
$$;
