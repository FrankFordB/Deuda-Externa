-- ============================================
-- SCRIPT 2: Sistema de confirmación de pagos
-- ============================================

-- Crear tabla payment_confirmations
CREATE TABLE IF NOT EXISTS payment_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES profiles(id),
  confirmer_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE(debt_id, requester_id, confirmer_id)
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_payment_confirmations_confirmer ON payment_confirmations(confirmer_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_confirmations_debt ON payment_confirmations(debt_id);

-- Habilitar RLS
ALTER TABLE payment_confirmations ENABLE ROW LEVEL SECURITY;

-- Políticas RLS básicas
DROP POLICY IF EXISTS "Users can view their confirmations" ON payment_confirmations;
CREATE POLICY "Users can view their confirmations" ON payment_confirmations
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = confirmer_id);

DROP POLICY IF EXISTS "Users can create confirmations" ON payment_confirmations;
CREATE POLICY "Users can create confirmations" ON payment_confirmations
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "Confirmers can respond" ON payment_confirmations;
CREATE POLICY "Confirmers can respond" ON payment_confirmations
  FOR UPDATE USING (auth.uid() = confirmer_id);

-- Función para crear notificación automáticamente (BYPASS RLS)
CREATE OR REPLACE FUNCTION create_payment_confirmation_notification()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  debt_desc TEXT;
  debt_amt NUMERIC;
  requester_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    -- Obtener datos de la deuda
    SELECT COALESCE(description, 'sin descripción'), COALESCE(amount, 0)
    INTO debt_desc, debt_amt 
    FROM debts 
    WHERE id = NEW.debt_id 
    LIMIT 1;
    
    -- Obtener nombre del solicitante con fallbacks
    SELECT COALESCE(
      NULLIF(full_name, ''),
      NULLIF(TRIM(first_name || ' ' || COALESCE(last_name, '')), ''),
      NULLIF(email, ''),
      'Alguien'
    ) INTO requester_name 
    FROM profiles 
    WHERE id = NEW.requester_id 
    LIMIT 1;
    
    -- Crear notificación para el confirmador
    INSERT INTO notifications (
      user_id, 
      type, 
      title, 
      message, 
      data,
      action_required, 
      action_type, 
      read, 
      created_at
    ) VALUES (
      NEW.confirmer_id,
      'payment_confirmation',
      '¿Confirmás el pago?',
      requester_name || ' dice que pagó la deuda "' || debt_desc || '" por $' || debt_amt::TEXT || '. ¿Es correcto?',
      jsonb_build_object(
        'confirmation_id', NEW.id, 
        'debt_id', NEW.debt_id, 
        'requester_id', NEW.requester_id, 
        'amount', debt_amt, 
        'description', debt_desc
      ),
      true, 
      'confirm_payment', 
      false, 
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear trigger
DROP TRIGGER IF EXISTS trg_payment_confirmation_notification ON payment_confirmations;
CREATE TRIGGER trg_payment_confirmation_notification
  AFTER INSERT ON payment_confirmations
  FOR EACH ROW 
  EXECUTE FUNCTION create_payment_confirmation_notification();

-- Verificación
SELECT 
  'Sistema de confirmación instalado' as resultado,
  COUNT(*) as policies_count
FROM pg_policies
WHERE tablename = 'payment_confirmations';

DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ SISTEMA DE CONFIRMACIÓN INSTALADO';
  RAISE NOTICE '========================================';
END $$;
