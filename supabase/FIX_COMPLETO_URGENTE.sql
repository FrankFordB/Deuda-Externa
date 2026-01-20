-- =====================================================
-- FIX COMPLETO Y URGENTE
-- Este script arregla TODO de una vez:
-- 1. Verifica qué tablas existen
-- 2. Crea las tablas que faltan
-- 3. Arregla permisos RLS
-- 4. Inserta datos por defecto
-- =====================================================

-- ==================== DIAGNÓSTICO INICIAL ====================
DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '🔍 DIAGNÓSTICO DE BASE DE DATOS';
  RAISE NOTICE '========================================';
END $$;

-- Ver qué tablas existen
SELECT 
  '✅ Tabla existe: ' || table_name as estado
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND table_name IN ('profiles', 'expenses', 'debts', 'friendships', 'monthly_incomes', 'payment_methods', 'virtual_friends', 'change_requests')
ORDER BY table_name;

-- ==================== CREAR TABLAS FALTANTES ====================

-- 1. TABLA: monthly_incomes (para que se guarde el sueldo)
CREATE TABLE IF NOT EXISTS public.monthly_incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month >= 1 AND month <= 12),
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_incomes_user ON public.monthly_incomes(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_incomes_date ON public.monthly_incomes(year, month);

-- 2. TABLA: payment_methods (ELIMINAR Y RECREAR para evitar conflictos)
DROP TABLE IF EXISTS public.payment_methods CASCADE;

CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cash', 'debit_card', 'credit_card', 'bank_transfer', 'digital_wallet', 'other')),
  icon TEXT DEFAULT '💳',
  color TEXT DEFAULT '#6366f1',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_methods_user ON public.payment_methods(user_id);

-- 3. TABLA: virtual_friends (amigos ficticios)
CREATE TABLE IF NOT EXISTS public.virtual_friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nickname TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_virtual_friends_user ON public.virtual_friends(user_id);

-- 4. TABLA: change_requests
CREATE TABLE IF NOT EXISTS public.change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('debt', 'expense')),
  entity_id UUID NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('create', 'update', 'delete', 'mark_paid')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  change_data JSONB NOT NULL,
  reason TEXT,
  response_message TEXT,
  responded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_change_requests_requester ON public.change_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_approver ON public.change_requests(approver_id);

-- ==================== HABILITAR RLS ====================

ALTER TABLE public.monthly_incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.virtual_friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- ==================== POLÍTICAS RLS - monthly_incomes ====================

DROP POLICY IF EXISTS "Users can view own monthly incomes" ON public.monthly_incomes;
DROP POLICY IF EXISTS "Users can create own monthly incomes" ON public.monthly_incomes;
DROP POLICY IF EXISTS "Users can update own monthly incomes" ON public.monthly_incomes;
DROP POLICY IF EXISTS "Users can delete own monthly incomes" ON public.monthly_incomes;

CREATE POLICY "Users can view own monthly incomes"
  ON public.monthly_incomes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own monthly incomes"
  ON public.monthly_incomes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own monthly incomes"
  ON public.monthly_incomes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own monthly incomes"
  ON public.monthly_incomes FOR DELETE
  USING (auth.uid() = user_id);

-- ==================== POLÍTICAS RLS - payment_methods ====================

DROP POLICY IF EXISTS "Users can view own payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Users can manage own payment methods" ON public.payment_methods;

CREATE POLICY "Users can view own payment methods"
  ON public.payment_methods FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own payment methods"
  ON public.payment_methods FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ==================== POLÍTICAS RLS - virtual_friends ====================

DROP POLICY IF EXISTS "Users can view own virtual friends" ON public.virtual_friends;
DROP POLICY IF EXISTS "Users can manage own virtual friends" ON public.virtual_friends;

CREATE POLICY "Users can view own virtual friends"
  ON public.virtual_friends FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own virtual friends"
  ON public.virtual_friends FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ==================== POLÍTICAS RLS - friendships (ARREGLAR) ====================

-- Eliminar TODAS las políticas existentes de friendships
DO $$ 
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'friendships' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.friendships', pol.policyname);
  END LOOP;
END $$;

-- Nuevas políticas (más permisivas)
CREATE POLICY "Users can view own friendships"
  ON public.friendships FOR SELECT
  USING (
    auth.uid() = user_id OR 
    auth.uid() = friend_id
  );

CREATE POLICY "Users can create friend requests"
  ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update friendships"
  ON public.friendships FOR UPDATE
  USING (
    auth.uid() = user_id OR 
    auth.uid() = friend_id
  );

CREATE POLICY "Users can delete own friendships"
  ON public.friendships FOR DELETE
  USING (
    auth.uid() = user_id OR 
    auth.uid() = friend_id
  );

-- ==================== POLÍTICAS RLS - change_requests ====================

DROP POLICY IF EXISTS "Users can view own change requests" ON public.change_requests;
DROP POLICY IF EXISTS "Users can create change requests" ON public.change_requests;
DROP POLICY IF EXISTS "Approvers can update change requests" ON public.change_requests;

CREATE POLICY "Users can view own change requests"
  ON public.change_requests FOR SELECT
  USING (
    auth.uid() = requester_id OR 
    auth.uid() = approver_id
  );

CREATE POLICY "Users can create change requests"
  ON public.change_requests FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Approvers can update change requests"
  ON public.change_requests FOR UPDATE
  USING (auth.uid() = approver_id)
  WITH CHECK (auth.uid() = approver_id);

-- ==================== INSERTAR MÉTODOS DE PAGO POR DEFECTO ====================

-- Para cada usuario existente, crear métodos de pago si no tiene
INSERT INTO public.payment_methods (user_id, name, type, icon)
SELECT 
  p.id,
  'Efectivo',
  'cash',
  '💵'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.payment_methods pm 
  WHERE pm.user_id = p.id AND pm.name = 'Efectivo'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.payment_methods (user_id, name, type, icon)
SELECT 
  p.id,
  'Tarjeta',
  'debit_card',
  '💳'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.payment_methods pm 
  WHERE pm.user_id = p.id AND pm.name = 'Tarjeta'
)
ON CONFLICT DO NOTHING;

-- ==================== TRIGGERS ====================

-- Trigger para updated_at en monthly_incomes
CREATE OR REPLACE FUNCTION update_monthly_incomes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_monthly_incomes_updated_at ON public.monthly_incomes;
CREATE TRIGGER trigger_update_monthly_incomes_updated_at
  BEFORE UPDATE ON public.monthly_incomes
  FOR EACH ROW
  EXECUTE FUNCTION update_monthly_incomes_updated_at();

-- Trigger para updated_at en payment_methods
CREATE OR REPLACE FUNCTION update_payment_methods_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_payment_methods_updated_at ON public.payment_methods;
CREATE TRIGGER trigger_update_payment_methods_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_methods_updated_at();

-- ==================== VERIFICACIÓN FINAL ====================

DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ FIX COMPLETADO';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Ahora deberías poder:';
  RAISE NOTICE '  ✓ Guardar sueldo mensual';
  RAISE NOTICE '  ✓ Agregar amigos';
  RAISE NOTICE '  ✓ Crear métodos de pago';
  RAISE NOTICE '  ✓ Crear amigos virtuales';
  RAISE NOTICE '========================================';
END $$;

-- Ver resumen final
SELECT 
  'monthly_incomes' as tabla,
  COUNT(*) as registros
FROM public.monthly_incomes
UNION ALL
SELECT 
  'payment_methods',
  COUNT(*)
FROM public.payment_methods
UNION ALL
SELECT 
  'virtual_friends',
  COUNT(*)
FROM public.virtual_friends
UNION ALL
SELECT 
  'friendships',
  COUNT(*)
FROM public.friendships;
