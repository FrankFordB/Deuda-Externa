-- ============================================
-- FUNCIONES PARA CONTADORES DE NOTIFICACIONES
-- ============================================
-- Aplicar en Supabase SQL Editor

-- =====================================================
-- 1. FUNCIÓN PARA OBTENER NOTIFICACIONES DE "YO DEBO"
-- =====================================================

CREATE OR REPLACE FUNCTION get_debtor_notifications_count(p_user_id UUID)
RETURNS TABLE (
  unread_count BIGINT,
  pending_accept_count BIGINT,
  payment_marked_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- Total de notificaciones no leídas relacionadas con deudas donde soy deudor
    COUNT(*) FILTER (WHERE n.read = false) as unread_count,
    -- Deudas pendientes de aceptar
    COUNT(*) FILTER (WHERE n.type = 'debt_request' AND n.read = false) as pending_accept_count,
    -- Pagos marcados pendientes de confirmar
    COUNT(*) FILTER (WHERE n.type = 'payment_marked' AND n.read = false) as payment_marked_count
  FROM notifications n
  WHERE n.user_id = p_user_id
    AND n.type IN ('debt_request', 'payment_marked', 'payment_reminder', 'payment_due');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. FUNCIÓN PARA OBTENER NOTIFICACIONES DE "ME DEBEN"
-- =====================================================

CREATE OR REPLACE FUNCTION get_creditor_notifications_count(p_user_id UUID)
RETURNS TABLE (
  unread_count BIGINT,
  payment_confirmation_count BIGINT,
  collection_due_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- Total de notificaciones no leídas relacionadas con deudas donde soy acreedor
    COUNT(*) FILTER (WHERE n.read = false) as unread_count,
    -- Confirmaciones de pago pendientes
    COUNT(*) FILTER (WHERE n.type = 'payment_confirmation' AND n.read = false) as payment_confirmation_count,
    -- Cobros próximos a vencer
    COUNT(*) FILTER (WHERE n.type = 'collection_due' AND n.read = false) as collection_due_count
  FROM notifications n
  WHERE n.user_id = p_user_id
    AND n.type IN ('payment_confirmation', 'collection_due', 'debt_accepted');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. FUNCIÓN PARA OBTENER CONTADORES GENERALES
-- =====================================================

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
    -- Total de notificaciones no leídas
    COUNT(*) FILTER (WHERE n.read = false) as total_unread,
    
    -- Notificaciones como deudor (yo debo)
    COUNT(*) FILTER (
      WHERE n.read = false 
      AND n.type IN ('debt_request', 'payment_marked', 'payment_reminder', 'payment_due')
    ) as debtor_unread,
    
    -- Notificaciones como acreedor (me deben)
    COUNT(*) FILTER (
      WHERE n.read = false 
      AND n.type IN ('payment_confirmation', 'collection_due', 'debt_accepted')
    ) as creditor_unread,
    
    -- Acciones pendientes
    COUNT(*) FILTER (
      WHERE n.read = false 
      AND n.action_required = true
    ) as pending_actions
    
  FROM notifications n
  WHERE n.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. VISTA MATERIALIZADA PARA CONTADORES (OPCIONAL)
-- =====================================================

-- Esta vista puede ser útil para optimizar queries si hay muchas notificaciones
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_notification_counters AS
SELECT 
  user_id,
  COUNT(*) FILTER (WHERE read = false) as total_unread,
  COUNT(*) FILTER (WHERE read = false AND type IN ('debt_request', 'payment_marked', 'payment_reminder', 'payment_due')) as debtor_unread,
  COUNT(*) FILTER (WHERE read = false AND type IN ('payment_confirmation', 'collection_due', 'debt_accepted')) as creditor_unread,
  COUNT(*) FILTER (WHERE read = false AND action_required = true) as pending_actions,
  MAX(created_at) as last_notification_at
FROM notifications
GROUP BY user_id;

-- Índice para la vista materializada
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_notification_counters_user 
ON mv_notification_counters(user_id);

-- Función para refrescar la vista
CREATE OR REPLACE FUNCTION refresh_notification_counters()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_notification_counters;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. TRIGGER PARA ACTUALIZAR VISTA AUTOMÁTICAMENTE
-- =====================================================

-- Función que se ejecutará en cada cambio
CREATE OR REPLACE FUNCTION trigger_refresh_notification_counters()
RETURNS TRIGGER AS $$
BEGIN
  -- Refrescar en segundo plano (no bloqueante)
  PERFORM refresh_notification_counters();
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger para INSERT, UPDATE, DELETE en notifications
DROP TRIGGER IF EXISTS trigger_notifications_counter_refresh ON notifications;
CREATE TRIGGER trigger_notifications_counter_refresh
  AFTER INSERT OR UPDATE OR DELETE ON notifications
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_notification_counters();

-- =====================================================
-- 6. PERMISOS RLS PARA LAS FUNCIONES
-- =====================================================

-- Otorgar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION get_debtor_notifications_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_creditor_notifications_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_debt_notifications_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_notification_counters() TO authenticated;

-- Permitir SELECT en la vista materializada
GRANT SELECT ON mv_notification_counters TO authenticated;

-- =====================================================
-- 7. VERIFICAR FUNCIONES CREADAS
-- =====================================================

SELECT 
  'Functions created:' as info,
  proname as function_name,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname IN (
  'get_debtor_notifications_count',
  'get_creditor_notifications_count', 
  'get_all_debt_notifications_count',
  'refresh_notification_counters'
)
ORDER BY proname;

-- Probar las funciones (reemplazar con tu user_id real)
-- SELECT * FROM get_debtor_notifications_count('tu-user-id-aqui');
-- SELECT * FROM get_creditor_notifications_count('tu-user-id-aqui');
-- SELECT * FROM get_all_debt_notifications_count('tu-user-id-aqui');
