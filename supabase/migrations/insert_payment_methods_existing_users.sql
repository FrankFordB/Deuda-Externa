-- =====================================================
-- Script para agregar métodos de pago a usuarios existentes
-- Ejecutar DESPUÉS de fix_storage_and_payment_methods.sql
-- =====================================================

-- Insertar métodos de pago para todos los usuarios existentes que no los tengan
INSERT INTO public.payment_methods (user_id, name, type, icon, color)
SELECT 
  p.id,
  method.name,
  method.type,
  method.icon,
  method.color
FROM 
  public.profiles p
CROSS JOIN (
  VALUES 
    ('Efectivo', 'cash', '💵', '#22c55e'),
    ('Banco Santander', 'bank', '🏦', '#ec0000'),
    ('Banco BBVA', 'bank', '🏦', '#004481'),
    ('Mercado Pago', 'digital_wallet', '💳', '#00b1ea'),
    ('Tarjeta de Crédito', 'card', '💳', '#f59e0b'),
    ('Tarjeta de Débito', 'card', '💳', '#8b5cf6')
) AS method(name, type, icon, color)
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.payment_methods pm 
  WHERE pm.user_id = p.id 
    AND pm.name = method.name
)
ON CONFLICT DO NOTHING;

-- Verificar cuántos métodos se insertaron
SELECT 
  COUNT(*) as total_metodos,
  COUNT(DISTINCT user_id) as usuarios_con_metodos
FROM public.payment_methods;
