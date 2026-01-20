-- ============================================
-- FIX: Agregar columna full_name y actualizar trigger
-- ============================================

-- PASO 1: Agregar columna full_name si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'full_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN full_name TEXT;
    RAISE NOTICE 'Columna full_name agregada a profiles';
  ELSE
    RAISE NOTICE 'Columna full_name ya existe';
  END IF;
END $$;

-- PASO 2: Actualizar full_name con datos existentes
UPDATE profiles 
SET full_name = COALESCE(
  NULLIF(TRIM(first_name || ' ' || COALESCE(last_name, '')), ''),
  email,
  'Usuario'
)
WHERE full_name IS NULL OR full_name = '';

-- PASO 3: Recrear función del trigger con manejo robusto
CREATE OR REPLACE FUNCTION create_payment_confirmation_notification()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  debt_desc TEXT;
  debt_amt NUMERIC;
  requester_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    
    -- Obtener descripción y monto de la deuda
    SELECT 
      COALESCE(description, 'sin descripción'),
      COALESCE(amount, 0)
    INTO debt_desc, debt_amt
    FROM debts
    WHERE id = NEW.debt_id
    LIMIT 1;
    
    -- Obtener nombre del solicitante (con fallbacks robustos)
    SELECT 
      COALESCE(
        NULLIF(full_name, ''),
        NULLIF(TRIM(first_name || ' ' || COALESCE(last_name, '')), ''),
        NULLIF(email, ''),
        'Alguien'
      )
    INTO requester_name
    FROM profiles
    WHERE id = NEW.requester_id
    LIMIT 1;
    
    -- Si no se encontró nombre, usar fallback
    requester_name := COALESCE(requester_name, 'Alguien');
    
    -- Insertar notificación
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
      now()
    );
    
    RAISE NOTICE '✅ Notificación creada para usuario %', NEW.confirmer_id;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log del error pero no fallar el insert
    RAISE WARNING 'Error creando notificación: % - %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

-- PASO 4: Recrear trigger
DROP TRIGGER IF EXISTS trg_payment_confirmation_notification ON payment_confirmations;
CREATE TRIGGER trg_payment_confirmation_notification
  AFTER INSERT ON payment_confirmations
  FOR EACH ROW
  EXECUTE FUNCTION create_payment_confirmation_notification();

-- PASO 5: Verificar estructura de profiles
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- PASO 6: Verificar que el trigger existe
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'payment_confirmations';
