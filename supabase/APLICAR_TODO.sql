-- ============================================
-- APLICAR TODOS LOS CAMBIOS - SCRIPT RÁPIDO
-- ============================================
-- Ejecutar COMPLETO en Supabase SQL Editor
-- Este script combina FIX_PAYMENT_SYSTEM_COMPLETE.sql 
-- y ADD_NOTIFICATION_COUNTERS.sql
-- ============================================

BEGIN;

-- =====================================================
-- PARTE 1: SISTEMA DE PAGOS COMPLETO
-- =====================================================

-- 1.1 Columnas para confirmación del deudor
ALTER TABLE debts 
ADD COLUMN IF NOT EXISTS debtor_confirmed_paid BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS debtor_confirmed_paid_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_debts_debtor_confirmed_paid 
ON debts(debtor_confirmed_paid) WHERE debtor_confirmed_paid = true;

COMMENT ON COLUMN debts.debtor_confirmed_paid IS 'Indica si el deudor confirmó que pagó la deuda';
COMMENT ON COLUMN debts.debtor_confirmed_paid_at IS 'Fecha en que el deudor confirmó el pago';

-- 1.2 Columnas para reversión de pagos de cuotas
ALTER TABLE debt_installments
ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS payment_reverted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reverted_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS reverted_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS revert_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_debt_installments_paid_by 
ON debt_installments(paid_by) WHERE paid_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_debt_installments_reverted 
ON debt_installments(payment_reverted) WHERE payment_reverted = true;

COMMENT ON COLUMN debt_installments.paid_by IS 'Usuario que marcó la cuota como pagada';
COMMENT ON COLUMN debt_installments.payment_reverted IS 'Indica si el pago fue revertido';
COMMENT ON COLUMN debt_installments.reverted_at IS 'Fecha en que se revirtió el pago';
COMMENT ON COLUMN debt_installments.reverted_by IS 'Usuario que revirtió el pago';
COMMENT ON COLUMN debt_installments.revert_reason IS 'Razón de la reversión';

-- 1.3 Columna paid_installments
ALTER TABLE debts
ADD COLUMN IF NOT EXISTS paid_installments INTEGER DEFAULT 0;

UPDATE debts d
SET paid_installments = (
  SELECT COUNT(*)
  FROM debt_installments di
  WHERE di.debt_id = d.id 
    AND di.paid = true 
    AND di.payment_reverted = false
)
WHERE installments > 1;

-- 1.4 Función para actualizar paid_installments
CREATE OR REPLACE FUNCTION update_debt_paid_installments()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE debts
  SET paid_installments = (
    SELECT COUNT(*)
    FROM debt_installments
    WHERE debt_id = COALESCE(NEW.debt_id, OLD.debt_id)
      AND paid = true
      AND payment_reverted = false
  )
  WHERE id = COALESCE(NEW.debt_id, OLD.debt_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_paid_installments ON debt_installments;
CREATE TRIGGER trigger_update_paid_installments
  AFTER INSERT OR UPDATE OR DELETE ON debt_installments
  FOR EACH ROW
  EXECUTE FUNCTION update_debt_paid_installments();

-- 1.5 Función para completar deuda automáticamente
CREATE OR REPLACE FUNCTION check_debt_completion()
RETURNS TRIGGER AS $$
DECLARE
  debt_record debts%ROWTYPE;
  paid_installments_count INT;
BEGIN
  SELECT * INTO debt_record
  FROM debts
  WHERE id = COALESCE(NEW.debt_id, OLD.debt_id);
  
  IF debt_record.installments <= 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  SELECT COUNT(*) INTO paid_installments_count
  FROM debt_installments
  WHERE debt_id = debt_record.id
    AND paid = true
    AND payment_reverted = false;
  
  IF paid_installments_count >= debt_record.installments THEN
    UPDATE debts
    SET status = 'paid',
        paid_at = NOW()
    WHERE id = debt_record.id
      AND status != 'paid';
  ELSIF paid_installments_count < debt_record.installments AND debt_record.status = 'paid' THEN
    UPDATE debts
    SET status = 'accepted',
        paid_at = NULL
    WHERE id = debt_record.id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_debt_completion ON debt_installments;
CREATE TRIGGER trigger_check_debt_completion
  AFTER INSERT OR UPDATE OR DELETE ON debt_installments
  FOR EACH ROW
  EXECUTE FUNCTION check_debt_completion();

-- =====================================================
-- PARTE 2: FUNCIONES DE NOTIFICACIONES
-- =====================================================

-- 2.1 Función para notificaciones de "Yo Debo"
CREATE OR REPLACE FUNCTION get_debtor_notifications_count(p_user_id UUID)
RETURNS TABLE (
  unread_count BIGINT,
  pending_accept_count BIGINT,
  payment_marked_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE n.read = false) as unread_count,
    COUNT(*) FILTER (WHERE n.type = 'debt_request' AND n.read = false) as pending_accept_count,
    COUNT(*) FILTER (WHERE n.type = 'payment_marked' AND n.read = false) as payment_marked_count
  FROM notifications n
  WHERE n.user_id = p_user_id
    AND n.type IN ('debt_request', 'payment_marked', 'payment_reminder', 'payment_due');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2.2 Función para notificaciones de "Me Deben"
CREATE OR REPLACE FUNCTION get_creditor_notifications_count(p_user_id UUID)
RETURNS TABLE (
  unread_count BIGINT,
  payment_confirmation_count BIGINT,
  collection_due_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE n.read = false) as unread_count,
    COUNT(*) FILTER (WHERE n.type = 'payment_confirmation' AND n.read = false) as payment_confirmation_count,
    COUNT(*) FILTER (WHERE n.type = 'collection_due' AND n.read = false) as collection_due_count
  FROM notifications n
  WHERE n.user_id = p_user_id
    AND n.type IN ('payment_confirmation', 'collection_due', 'debt_accepted');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2.3 Función para contadores generales
CREATE OR REPLACE FUNCTION get_all_debt_notifications_count(p_user_id UUID)
RETURNS TABLE (
  total_unread BIGINT,
  debtor_unread BIGINT,
  creditor_unread BIGINT,
  pending_actions BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE n.read = false) as total_unread,
    COUNT(*) FILTER (
      WHERE n.read = false 
      AND n.type IN ('debt_request', 'payment_marked', 'payment_reminder', 'payment_due')
    ) as debtor_unread,
    COUNT(*) FILTER (
      WHERE n.read = false 
      AND n.type IN ('payment_confirmation', 'collection_due', 'debt_accepted')
    ) as creditor_unread,
    COUNT(*) FILTER (
      WHERE n.read = false 
      AND n.action_required = true
    ) as pending_actions
  FROM notifications n
  WHERE n.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2.4 Permisos
GRANT EXECUTE ON FUNCTION get_debtor_notifications_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_creditor_notifications_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_debt_notifications_count(UUID) TO authenticated;

COMMIT;

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================

-- Verificar columnas en debts
SELECT 
  'Columnas en debts:' as verificacion,
  column_name, 
  data_type
FROM information_schema.columns 
WHERE table_name = 'debts' 
  AND column_name IN (
    'paid_by_creditor', 
    'debtor_confirmed_paid', 
    'paid_installments'
  )
ORDER BY column_name;

-- Verificar columnas en debt_installments
SELECT 
  'Columnas en debt_installments:' as verificacion,
  column_name, 
  data_type
FROM information_schema.columns 
WHERE table_name = 'debt_installments' 
  AND column_name IN (
    'paid_by', 
    'payment_reverted', 
    'reverted_at'
  )
ORDER BY column_name;

-- Verificar funciones
SELECT 
  'Funciones creadas:' as verificacion,
  proname as function_name
FROM pg_proc
WHERE proname IN (
  'get_debtor_notifications_count',
  'get_creditor_notifications_count', 
  'get_all_debt_notifications_count',
  'update_debt_paid_installments',
  'check_debt_completion'
)
ORDER BY proname;

-- Verificar triggers
SELECT 
  'Triggers activos:' as verificacion,
  trigger_name, 
  event_object_table as tabla
FROM information_schema.triggers 
WHERE trigger_name IN (
  'trigger_update_paid_installments', 
  'trigger_check_debt_completion'
)
ORDER BY trigger_name;

-- Mensaje final
SELECT '✅ APLICACIÓN COMPLETADA - Todos los cambios aplicados correctamente' as resultado;
