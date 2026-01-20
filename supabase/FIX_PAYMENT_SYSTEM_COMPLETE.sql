-- ============================================
-- FIX COMPLETO DEL SISTEMA DE PAGOS
-- ============================================
-- Aplicar en Supabase SQL Editor

-- =====================================================
-- 1. AGREGAR COLUMNAS PARA SISTEMA DE MARCADO DE PAGO
-- =====================================================

-- Agregar columnas para confirmación del deudor
ALTER TABLE debts 
ADD COLUMN IF NOT EXISTS debtor_confirmed_paid BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS debtor_confirmed_paid_at TIMESTAMPTZ DEFAULT NULL;

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_debts_debtor_confirmed_paid 
ON debts(debtor_confirmed_paid) 
WHERE debtor_confirmed_paid = true;

-- Comentarios
COMMENT ON COLUMN debts.debtor_confirmed_paid IS 'Indica si el deudor confirmó que pagó la deuda';
COMMENT ON COLUMN debts.debtor_confirmed_paid_at IS 'Fecha en que el deudor confirmó el pago';

-- =====================================================
-- 2. AGREGAR COLUMNAS PARA REVERSIÓN DE PAGOS DE CUOTAS
-- =====================================================

-- Agregar campos de auditoría para cuotas
ALTER TABLE debt_installments
ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS payment_reverted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reverted_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS reverted_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS revert_reason TEXT;

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_debt_installments_paid_by 
ON debt_installments(paid_by) 
WHERE paid_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_debt_installments_reverted 
ON debt_installments(payment_reverted) 
WHERE payment_reverted = true;

-- Comentarios
COMMENT ON COLUMN debt_installments.paid_by IS 'Usuario que marcó la cuota como pagada (creditor_id de la deuda)';
COMMENT ON COLUMN debt_installments.payment_reverted IS 'Indica si el pago fue revertido';
COMMENT ON COLUMN debt_installments.reverted_at IS 'Fecha en que se revirtió el pago';
COMMENT ON COLUMN debt_installments.reverted_by IS 'Usuario que revirtió el pago';
COMMENT ON COLUMN debt_installments.revert_reason IS 'Razón de la reversión';

-- =====================================================
-- 3. AGREGAR COLUMNA PARA PAID_INSTALLMENTS EN DEBTS
-- =====================================================

-- Agregar columna si no existe
ALTER TABLE debts
ADD COLUMN IF NOT EXISTS paid_installments INTEGER DEFAULT 0;

-- Actualizar valores existentes basándose en debt_installments
UPDATE debts d
SET paid_installments = (
  SELECT COUNT(*)
  FROM debt_installments di
  WHERE di.debt_id = d.id 
    AND di.paid = true 
    AND di.payment_reverted = false
)
WHERE installments > 1;

-- =====================================================
-- 4. CREAR VISTA PARA CONTADORES DE NOTIFICACIONES
-- =====================================================

CREATE OR REPLACE VIEW v_notification_counters AS
SELECT 
  d.debtor_id as user_id,
  'debtor' as user_role,
  COUNT(CASE WHEN n.read = false AND n.type IN ('payment_marked', 'debt_request') THEN 1 END) as unread_count
FROM debts d
LEFT JOIN notifications n ON n.user_id = d.debtor_id AND n.data->>'debt_id' = d.id::text
WHERE d.debtor_id IS NOT NULL
GROUP BY d.debtor_id

UNION ALL

SELECT 
  d.creditor_id as user_id,
  'creditor' as user_role,
  COUNT(CASE WHEN n.read = false AND n.type IN ('payment_confirmation', 'debt_accepted') THEN 1 END) as unread_count
FROM debts d
LEFT JOIN notifications n ON n.user_id = d.creditor_id AND n.data->>'debt_id' = d.id::text
GROUP BY d.creditor_id;

-- =====================================================
-- 5. FUNCIÓN PARA ACTUALIZAR PAID_INSTALLMENTS
-- =====================================================

CREATE OR REPLACE FUNCTION update_debt_paid_installments()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualizar el contador de cuotas pagadas
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

-- Crear trigger
DROP TRIGGER IF EXISTS trigger_update_paid_installments ON debt_installments;
CREATE TRIGGER trigger_update_paid_installments
  AFTER INSERT OR UPDATE OR DELETE ON debt_installments
  FOR EACH ROW
  EXECUTE FUNCTION update_debt_paid_installments();

-- =====================================================
-- 6. FUNCIÓN PARA AUTO-COMPLETAR DEUDA CUANDO TODAS LAS CUOTAS ESTÁN PAGADAS
-- =====================================================

CREATE OR REPLACE FUNCTION check_debt_completion()
RETURNS TRIGGER AS $$
DECLARE
  debt_record debts%ROWTYPE;
  total_installments INT;
  paid_installments_count INT;
BEGIN
  -- Obtener la deuda
  SELECT * INTO debt_record
  FROM debts
  WHERE id = COALESCE(NEW.debt_id, OLD.debt_id);
  
  -- Si no es una deuda con cuotas, salir
  IF debt_record.installments <= 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Contar cuotas pagadas (no revertidas)
  SELECT COUNT(*) INTO paid_installments_count
  FROM debt_installments
  WHERE debt_id = debt_record.id
    AND paid = true
    AND payment_reverted = false;
  
  -- Si todas las cuotas están pagadas, marcar deuda como pagada
  IF paid_installments_count >= debt_record.installments THEN
    UPDATE debts
    SET status = 'paid',
        paid_at = NOW()
    WHERE id = debt_record.id
      AND status != 'paid';
  -- Si hay cuotas no pagadas y la deuda está marcada como pagada, reactivarla
  ELSIF paid_installments_count < debt_record.installments AND debt_record.status = 'paid' THEN
    UPDATE debts
    SET status = 'accepted',
        paid_at = NULL
    WHERE id = debt_record.id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para completar deuda automáticamente
DROP TRIGGER IF EXISTS trigger_check_debt_completion ON debt_installments;
CREATE TRIGGER trigger_check_debt_completion
  AFTER INSERT OR UPDATE OR DELETE ON debt_installments
  FOR EACH ROW
  EXECUTE FUNCTION check_debt_completion();

-- =====================================================
-- 7. VERIFICAR ESTRUCTURA
-- =====================================================

-- Verificar columnas en debts
SELECT 
  'debts columns:' as info,
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'debts' 
  AND column_name IN (
    'paid_by_creditor', 
    'creditor_marked_paid_at', 
    'debtor_confirmed_paid', 
    'debtor_confirmed_paid_at',
    'paid_installments'
  )
ORDER BY column_name;

-- Verificar columnas en debt_installments
SELECT 
  'debt_installments columns:' as info,
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'debt_installments' 
  AND column_name IN (
    'paid_by', 
    'payment_reverted', 
    'reverted_at', 
    'reverted_by',
    'revert_reason'
  )
ORDER BY column_name;

-- Verificar vista
SELECT 
  'view created:' as info,
  schemaname, 
  viewname, 
  viewowner
FROM pg_views 
WHERE viewname = 'v_notification_counters';

-- Verificar funciones y triggers
SELECT 
  'triggers:' as info,
  trigger_name, 
  event_manipulation, 
  event_object_table
FROM information_schema.triggers 
WHERE trigger_name IN ('trigger_update_paid_installments', 'trigger_check_debt_completion')
ORDER BY trigger_name;
