-- ============================================
-- FIX: Notificaciones y Balance Bancario cuando se marca cuota pagada
-- 1. El deudor debe ver cuando el acreedor marca su cuota como pagada
-- 2. El balance de la cuenta bancaria se actualiza automáticamente
-- ============================================

-- 1. Función para notificar y actualizar balance cuando se paga una cuota
CREATE OR REPLACE FUNCTION notify_installment_paid()
RETURNS TRIGGER AS $$
DECLARE
  v_debt debts%ROWTYPE;
  v_creditor_name TEXT;
  v_debtor_name TEXT;
  v_installment_number INT;
  v_installment_amount DECIMAL(12,2);
BEGIN
  -- Solo actuar si se está marcando como pagada (changed from unpaid to paid)
  IF NEW.paid = true AND (OLD.paid = false OR OLD.paid IS NULL) AND NEW.payment_reverted = false THEN
    
    -- Obtener información de la deuda
    SELECT * INTO v_debt FROM debts WHERE id = NEW.debt_id;
    
    -- No continuar si no hay deuda o deudor
    IF v_debt.id IS NULL OR v_debt.debtor_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Obtener nombre del acreedor
    SELECT COALESCE(first_name || ' ' || last_name, nickname, 'Acreedor')
    INTO v_creditor_name
    FROM profiles
    WHERE id = v_debt.creditor_id;
    
    -- Calcular número de cuota
    SELECT COUNT(*) INTO v_installment_number
    FROM debt_installments
    WHERE debt_id = NEW.debt_id AND due_date <= NEW.due_date;
    
    -- Obtener monto de la cuota
    v_installment_amount := NEW.amount;
    
    -- =============================================
    -- ACTUALIZAR BALANCE BANCARIO DEL ACREEDOR
    -- Si la deuda tiene cuenta bancaria asociada, sumar el monto de la cuota
    -- =============================================
    IF v_debt.bank_account_id IS NOT NULL THEN
      UPDATE bank_accounts 
      SET 
        current_balance = current_balance + v_installment_amount,
        updated_at = NOW()
      WHERE id = v_debt.bank_account_id;
      
      RAISE NOTICE 'Balance actualizado: +% en cuenta %', v_installment_amount, v_debt.bank_account_id;
    END IF;
    
    -- Notificar al deudor
    INSERT INTO notifications (user_id, type, title, message, data, read)
    VALUES (
      v_debt.debtor_id,
      'installment_paid',
      'Cuota marcada como pagada',
      v_creditor_name || ' confirmó el pago de tu cuota ' || v_installment_number || '/' || v_debt.installments || ' de ' || COALESCE(v_debt.currency_symbol, '$') || v_installment_amount::TEXT,
      jsonb_build_object(
        'debt_id', v_debt.id,
        'installment_id', NEW.id,
        'installment_number', v_installment_number,
        'total_installments', v_debt.installments,
        'amount', v_installment_amount,
        'creditor_id', v_debt.creditor_id,
        'creditor_name', v_creditor_name,
        'bank_account_updated', v_debt.bank_account_id IS NOT NULL
      ),
      false
    );
    
  -- Si se revirtió el pago, también notificar y revertir balance
  ELSIF NEW.payment_reverted = true AND (OLD.payment_reverted = false OR OLD.payment_reverted IS NULL) THEN
    
    -- Obtener información de la deuda
    SELECT * INTO v_debt FROM debts WHERE id = NEW.debt_id;
    
    IF v_debt.id IS NULL OR v_debt.debtor_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Obtener nombre del acreedor
    SELECT COALESCE(first_name || ' ' || last_name, nickname, 'Acreedor')
    INTO v_creditor_name
    FROM profiles
    WHERE id = v_debt.creditor_id;
    
    -- Calcular número de cuota
    SELECT COUNT(*) INTO v_installment_number
    FROM debt_installments
    WHERE debt_id = NEW.debt_id AND due_date <= NEW.due_date;
    
    -- Obtener monto de la cuota
    v_installment_amount := NEW.amount;
    
    -- =============================================
    -- REVERTIR BALANCE BANCARIO DEL ACREEDOR
    -- Si la deuda tiene cuenta bancaria asociada, restar el monto de la cuota
    -- =============================================
    IF v_debt.bank_account_id IS NOT NULL THEN
      UPDATE bank_accounts 
      SET 
        current_balance = current_balance - v_installment_amount,
        updated_at = NOW()
      WHERE id = v_debt.bank_account_id;
      
      RAISE NOTICE 'Balance revertido: -% en cuenta %', v_installment_amount, v_debt.bank_account_id;
    END IF;
    
    -- Notificar al deudor que se revirtió
    INSERT INTO notifications (user_id, type, title, message, data, read)
    VALUES (
      v_debt.debtor_id,
      'installment_reverted',
      'Pago de cuota revertido',
      v_creditor_name || ' revirtió el pago de tu cuota ' || v_installment_number || '/' || v_debt.installments,
      jsonb_build_object(
        'debt_id', v_debt.id,
        'installment_id', NEW.id,
        'installment_number', v_installment_number,
        'total_installments', v_debt.installments,
        'reason', NEW.revert_reason,
        'bank_account_updated', v_debt.bank_account_id IS NOT NULL
      ),
      false
    );
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Crear trigger
DROP TRIGGER IF EXISTS trigger_notify_installment_paid ON debt_installments;
CREATE TRIGGER trigger_notify_installment_paid
  AFTER UPDATE ON debt_installments
  FOR EACH ROW
  EXECUTE FUNCTION notify_installment_paid();

-- 3. Verificar que funciona
DO $$
BEGIN
  RAISE NOTICE '✅ Trigger de notificación de cuotas pagadas creado correctamente';
END $$;
