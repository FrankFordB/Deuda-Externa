-- ============================================
-- SOLUCIÓN DEFINITIVA - Trigger para Notificaciones
-- ============================================
-- Crear notificaciones automáticamente via trigger (bypasa RLS)

-- PASO 1: Verificar estructura de tabla payment_confirmations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_confirmations') THEN
    CREATE TABLE payment_confirmations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
      requester_id UUID NOT NULL REFERENCES profiles(id),
      confirmer_id UUID NOT NULL REFERENCES profiles(id),
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT now(),
      responded_at TIMESTAMPTZ,
      CONSTRAINT valid_status CHECK (status IN ('pending', 'confirmed', 'rejected'))
    );
    
    -- Índices
    CREATE INDEX idx_payment_confirmations_debt ON payment_confirmations(debt_id);
    CREATE INDEX idx_payment_confirmations_requester ON payment_confirmations(requester_id);
    CREATE INDEX idx_payment_confirmations_confirmer ON payment_confirmations(confirmer_id);
    CREATE INDEX idx_payment_confirmations_status ON payment_confirmations(status);
  END IF;
END $$;

-- PASO 2: Función para crear notificación (SE EJECUTA COMO DEFINER, BYPASA RLS)
CREATE OR REPLACE FUNCTION create_payment_confirmation_notification()
RETURNS TRIGGER
SECURITY DEFINER -- IMPORTANTE: Bypasa RLS
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  debt_info RECORD;
  requester_info RECORD;
BEGIN
  -- Solo crear notificación cuando se inserta una confirmación nueva
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    
    -- Obtener info de la deuda
    SELECT description, amount INTO debt_info
    FROM debts
    WHERE id = NEW.debt_id
    LIMIT 1;
    
    -- Obtener info del solicitante
    SELECT 
      COALESCE(full_name, first_name || ' ' || last_name, email) as name
    INTO requester_info
    FROM profiles
    WHERE id = NEW.requester_id
    LIMIT 1;
    
    -- Insertar notificación directamente (sin RLS porque es SECURITY DEFINER)
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
      COALESCE(requester_info.name, 'Alguien') || ' dice que pagó la deuda "' || 
        COALESCE(debt_info.description, 'sin descripción') || '" por $' || 
        COALESCE(debt_info.amount::TEXT, '0') || '. ¿Es correcto?',
      jsonb_build_object(
        'confirmation_id', NEW.id,
        'debt_id', NEW.debt_id,
        'requester_id', NEW.requester_id,
        'amount', COALESCE(debt_info.amount, 0),
        'description', COALESCE(debt_info.description, 'sin descripción')
      ),
      true,
      'confirm_payment',
      false,
      now()
    );
    
    RAISE NOTICE 'Notificación de confirmación de pago creada para usuario %', NEW.confirmer_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- PASO 3: Crear trigger
DROP TRIGGER IF EXISTS trg_payment_confirmation_notification ON payment_confirmations;
CREATE TRIGGER trg_payment_confirmation_notification
  AFTER INSERT ON payment_confirmations
  FOR EACH ROW
  EXECUTE FUNCTION create_payment_confirmation_notification();

-- PASO 4: Políticas RLS simples (solo para payment_confirmations)
ALTER TABLE payment_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_confirmations_insert" ON payment_confirmations;
CREATE POLICY "payment_confirmations_insert"
  ON payment_confirmations FOR INSERT
  TO authenticated
  WITH CHECK (true); -- Permitir insertar cualquier confirmación

DROP POLICY IF EXISTS "payment_confirmations_select" ON payment_confirmations;
CREATE POLICY "payment_confirmations_select"
  ON payment_confirmations FOR SELECT
  TO authenticated
  USING (requester_id = auth.uid() OR confirmer_id = auth.uid());

DROP POLICY IF EXISTS "payment_confirmations_update" ON payment_confirmations;
CREATE POLICY "payment_confirmations_update"
  ON payment_confirmations FOR UPDATE
  TO authenticated
  USING (confirmer_id = auth.uid());

-- PASO 5: Asegurar que profiles y notifications tengan políticas básicas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select"
  ON profiles FOR SELECT
  TO authenticated, anon
  USING (true);

-- Notifications  
DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_delete" ON notifications;
CREATE POLICY "notifications_delete"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- PASO 6: Verificar
SELECT 'Trigger creado correctamente' as status;

-- Ver políticas
SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('payment_confirmations', 'profiles', 'notifications')
ORDER BY tablename, policyname;
