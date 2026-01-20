-- ============================================
-- AGREGAR COLUMNAS PARA SISTEMA DE MARCADO DE PAGO
-- ============================================
-- Aplicar en Supabase SQL Editor

-- Agregar columnas para que el acreedor pueda marcar como pagada
ALTER TABLE debts 
ADD COLUMN IF NOT EXISTS paid_by_creditor BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS creditor_marked_paid_at TIMESTAMPTZ DEFAULT NULL;

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_debts_paid_by_creditor 
ON debts(paid_by_creditor) 
WHERE paid_by_creditor = true;

-- Comentarios
COMMENT ON COLUMN debts.paid_by_creditor IS 'Indica si el acreedor marcó la deuda como pagada, pendiente de confirmación del deudor';
COMMENT ON COLUMN debts.creditor_marked_paid_at IS 'Fecha en que el acreedor marcó la deuda como pagada';

-- Verificar
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'debts' 
  AND column_name IN ('paid_by_creditor', 'creditor_marked_paid_at');
