-- =====================================================
-- MIGRACIÓN: Arreglar Storage RLS y Métodos de Pago
-- =====================================================

-- =====================================================
-- 1. STORAGE BUCKET: avatars
-- =====================================================

-- Crear bucket si no existe (solo administradores)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

-- Políticas para avatars
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- =====================================================
-- 2. TABLA: payment_methods (Métodos de Pago)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bank', 'cash', 'card', 'digital_wallet', 'other')),
  icon TEXT DEFAULT '💳',
  color TEXT DEFAULT '#6366f1',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON public.payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON public.payment_methods(is_active);

-- Los métodos de pago se crearán automáticamente mediante trigger
-- cuando se cree un nuevo perfil

-- =====================================================
-- 3. TABLA: debt_payments (Pagos parciales de deudas)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.debt_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON public.debt_payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_date ON public.debt_payments(payment_date);

-- =====================================================
-- 4. ACTUALIZAR TABLA: expenses
-- =====================================================

-- Agregar payment_method_id a expenses
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_payment_method ON public.expenses(payment_method_id);

-- =====================================================
-- 5. ACTUALIZAR TABLA: debts
-- =====================================================

-- Agregar campos para pagos parciales
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS amount_remaining DECIMAL(12, 2);

-- Función para calcular amount_remaining automáticamente
CREATE OR REPLACE FUNCTION calculate_debt_remaining()
RETURNS TRIGGER AS $$
BEGIN
  NEW.amount_remaining = NEW.amount - COALESCE(NEW.amount_paid, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para calcular amount_remaining
DROP TRIGGER IF EXISTS update_debt_remaining ON public.debts;
CREATE TRIGGER update_debt_remaining
  BEFORE INSERT OR UPDATE ON public.debts
  FOR EACH ROW
  EXECUTE FUNCTION calculate_debt_remaining();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS en nuevas tablas
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS: payment_methods
-- =====================================================

DROP POLICY IF EXISTS "Users can view own payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Users can create own payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Users can update own payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Users can delete own payment methods" ON public.payment_methods;

CREATE POLICY "Users can view own payment methods"
  ON public.payment_methods FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own payment methods"
  ON public.payment_methods FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payment methods"
  ON public.payment_methods FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own payment methods"
  ON public.payment_methods FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- POLÍTICAS: debt_payments
-- =====================================================

DROP POLICY IF EXISTS "Users can view own debt payments" ON public.debt_payments;
DROP POLICY IF EXISTS "Users can create own debt payments" ON public.debt_payments;

CREATE POLICY "Users can view own debt payments"
  ON public.debt_payments FOR SELECT
  USING (
    debt_id IN (
      SELECT id FROM public.debts 
      WHERE creditor_id = auth.uid() OR debtor_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own debt payments"
  ON public.debt_payments FOR INSERT
  WITH CHECK (
    debt_id IN (
      SELECT id FROM public.debts 
      WHERE creditor_id = auth.uid() OR debtor_id = auth.uid()
    )
  );

-- =====================================================
-- TRIGGERS
-- =====================================================

DROP TRIGGER IF EXISTS update_payment_methods_updated_at ON public.payment_methods;
CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FUNCIÓN: Actualizar amount_paid cuando se registra un pago
-- =====================================================

CREATE OR REPLACE FUNCTION update_debt_amount_paid()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.debts
  SET amount_paid = (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.debt_payments
    WHERE debt_id = NEW.debt_id
  )
  WHERE id = NEW.debt_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS after_debt_payment_insert ON public.debt_payments;
CREATE TRIGGER after_debt_payment_insert
  AFTER INSERT ON public.debt_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_debt_amount_paid();

-- =====================================================
-- FUNCIÓN: Crear perfil automáticamente al registrar usuario
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nickname, first_name, last_name, birth_date, country)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nickname', 'user' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'birth_date')::date, NULL),
    COALESCE(NEW.raw_user_meta_data->>'country', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para crear perfil automáticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- INSERTAR MÉTODOS DE PAGO PARA NUEVOS USUARIOS
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_default_payment_methods()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.payment_methods (user_id, name, type, icon, color)
  VALUES 
    (NEW.id, 'Efectivo', 'cash', '💵', '#22c55e'),
    (NEW.id, 'Banco Santander', 'bank', '🏦', '#ec0000'),
    (NEW.id, 'Banco BBVA', 'bank', '🏦', '#004481'),
    (NEW.id, 'Mercado Pago', 'digital_wallet', '💳', '#00b1ea'),
    (NEW.id, 'Tarjeta de Crédito', 'card', '💳', '#f59e0b'),
    (NEW.id, 'Tarjeta de Débito', 'card', '💳', '#8b5cf6')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para crear métodos de pago predeterminados
DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_default_payment_methods();

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================
