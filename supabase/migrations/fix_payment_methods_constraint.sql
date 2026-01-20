-- =====================================================
-- FIX: REPARAR PAYMENT METHODS CONSTRAINT Y FUNCIÓN
-- =====================================================

-- 1. Actualizar el constraint para permitir 'bank' y 'card'
ALTER TABLE public.payment_methods DROP CONSTRAINT IF EXISTS payment_methods_type_check;

ALTER TABLE public.payment_methods 
ADD CONSTRAINT payment_methods_type_check 
CHECK (type IN ('cash', 'debit_card', 'credit_card', 'bank_transfer', 'digital_wallet', 'bank', 'card', 'other'));

-- 2. Re-crear la función con tipos correctos
CREATE OR REPLACE FUNCTION public.create_default_payment_methods()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.payment_methods (user_id, name, type, icon, color)
  VALUES 
    (NEW.id, 'Efectivo', 'cash', '💵', '#22c55e'),
    (NEW.id, 'Banco Santander', 'bank_transfer', '🏦', '#ec0000'),
    (NEW.id, 'Banco BBVA', 'bank_transfer', '🏦', '#004481'),
    (NEW.id, 'Mercado Pago', 'digital_wallet', '💳', '#00b1ea'),
    (NEW.id, 'Tarjeta de Crédito', 'credit_card', '💳', '#f59e0b'),
    (NEW.id, 'Tarjeta de Débito', 'debit_card', '💳', '#8b5cf6')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Verificación
DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ PAYMENT METHODS REPARADO';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Constraint actualizado para permitir:';
  RAISE NOTICE '  - cash, debit_card, credit_card';
  RAISE NOTICE '  - bank_transfer, digital_wallet';
  RAISE NOTICE '  - bank, card, other';
  RAISE NOTICE '';
  RAISE NOTICE 'Función actualizada con tipos correctos';
  RAISE NOTICE '========================================';
END $$;
