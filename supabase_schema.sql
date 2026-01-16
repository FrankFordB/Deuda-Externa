-- =====================================================
-- SUPABASE SCHEMA - PROGRAMA DE DEUDAS
-- =====================================================
-- Ejecutar este SQL en el SQL Editor de Supabase
-- Dashboard -> SQL Editor -> New Query
-- =====================================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLA: profiles (Perfiles de usuarios)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  nickname TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  country TEXT,
  birth_date DATE,
  is_superadmin BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_profiles_nickname ON public.profiles(nickname);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- =====================================================
-- TABLA: friendships (Amistades)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_friendships_user ON public.friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON public.friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON public.friendships(status);

-- =====================================================
-- TABLA: expenses (Gastos)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  category TEXT NOT NULL,
  payment_source TEXT NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  is_installment BOOLEAN DEFAULT FALSE,
  total_installments INTEGER,
  current_installment INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_expenses_user ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON public.expenses(status);

-- =====================================================
-- TABLA: installments (Cuotas)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.installments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  due_date DATE NOT NULL,
  paid BOOLEAN DEFAULT FALSE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_installments_expense ON public.installments(expense_id);
CREATE INDEX IF NOT EXISTS idx_installments_due_date ON public.installments(due_date);
CREATE INDEX IF NOT EXISTS idx_installments_paid ON public.installments(paid);

-- =====================================================
-- TABLA: debts (Deudas entre amigos)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.debts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creditor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  debtor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'paid')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_debts_creditor ON public.debts(creditor_id);
CREATE INDEX IF NOT EXISTS idx_debts_debtor ON public.debts(debtor_id);
CREATE INDEX IF NOT EXISTS idx_debts_status ON public.debts(status);

-- =====================================================
-- TABLA: site_config (Configuración del sitio)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.site_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar configuración por defecto
INSERT INTO public.site_config (key, value) VALUES
  ('general', '{"site_name": "DebtTracker", "currency": "$", "primary_color": "#6366f1", "allow_registration": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS: profiles
-- =====================================================

-- Los usuarios pueden ver su propio perfil
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Los usuarios pueden ver perfiles de sus amigos
CREATE POLICY "Users can view friends profiles"
  ON public.profiles FOR SELECT
  USING (
    id IN (
      SELECT friend_id FROM public.friendships 
      WHERE user_id = auth.uid() AND status = 'accepted'
      UNION
      SELECT user_id FROM public.friendships 
      WHERE friend_id = auth.uid() AND status = 'accepted'
    )
  );

-- Los usuarios pueden buscar otros usuarios por nickname
CREATE POLICY "Users can search profiles by nickname"
  ON public.profiles FOR SELECT
  USING (true);

-- Los usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Los usuarios pueden insertar su propio perfil
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Superadmins pueden ver todos los perfiles
CREATE POLICY "Superadmins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_superadmin = true
    )
  );

-- Superadmins pueden actualizar cualquier perfil
CREATE POLICY "Superadmins can update any profile"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_superadmin = true
    )
  );

-- =====================================================
-- POLÍTICAS: friendships
-- =====================================================

-- Los usuarios pueden ver sus propias amistades
CREATE POLICY "Users can view own friendships"
  ON public.friendships FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Los usuarios pueden crear solicitudes de amistad
CREATE POLICY "Users can create friendship requests"
  ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Los usuarios pueden actualizar amistades donde son el amigo (aceptar/rechazar)
CREATE POLICY "Users can update friendships as friend"
  ON public.friendships FOR UPDATE
  USING (auth.uid() = friend_id)
  WITH CHECK (auth.uid() = friend_id);

-- Los usuarios pueden eliminar sus propias amistades
CREATE POLICY "Users can delete own friendships"
  ON public.friendships FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- =====================================================
-- POLÍTICAS: expenses
-- =====================================================

-- Los usuarios pueden ver sus propios gastos
CREATE POLICY "Users can view own expenses"
  ON public.expenses FOR SELECT
  USING (auth.uid() = user_id);

-- Los usuarios pueden crear sus propios gastos
CREATE POLICY "Users can create own expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Los usuarios pueden actualizar sus propios gastos
CREATE POLICY "Users can update own expenses"
  ON public.expenses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Los usuarios pueden eliminar sus propios gastos
CREATE POLICY "Users can delete own expenses"
  ON public.expenses FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- POLÍTICAS: installments
-- =====================================================

-- Los usuarios pueden ver cuotas de sus gastos
CREATE POLICY "Users can view own installments"
  ON public.installments FOR SELECT
  USING (
    expense_id IN (
      SELECT id FROM public.expenses WHERE user_id = auth.uid()
    )
  );

-- Los usuarios pueden crear cuotas para sus gastos
CREATE POLICY "Users can create own installments"
  ON public.installments FOR INSERT
  WITH CHECK (
    expense_id IN (
      SELECT id FROM public.expenses WHERE user_id = auth.uid()
    )
  );

-- Los usuarios pueden actualizar cuotas de sus gastos
CREATE POLICY "Users can update own installments"
  ON public.installments FOR UPDATE
  USING (
    expense_id IN (
      SELECT id FROM public.expenses WHERE user_id = auth.uid()
    )
  );

-- Los usuarios pueden eliminar cuotas de sus gastos
CREATE POLICY "Users can delete own installments"
  ON public.installments FOR DELETE
  USING (
    expense_id IN (
      SELECT id FROM public.expenses WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- POLÍTICAS: debts
-- =====================================================

-- Los usuarios pueden ver deudas donde son parte
CREATE POLICY "Users can view own debts"
  ON public.debts FOR SELECT
  USING (auth.uid() = creditor_id OR auth.uid() = debtor_id);

-- Los usuarios pueden crear deudas como acreedor
CREATE POLICY "Users can create debts as creditor"
  ON public.debts FOR INSERT
  WITH CHECK (auth.uid() = creditor_id);

-- Los usuarios pueden actualizar deudas donde son parte
CREATE POLICY "Users can update own debts"
  ON public.debts FOR UPDATE
  USING (auth.uid() = creditor_id OR auth.uid() = debtor_id);

-- Los usuarios pueden eliminar deudas donde son acreedor
CREATE POLICY "Users can delete own debts"
  ON public.debts FOR DELETE
  USING (auth.uid() = creditor_id);

-- =====================================================
-- POLÍTICAS: site_config
-- =====================================================

-- Todos pueden leer la configuración
CREATE POLICY "Anyone can read site config"
  ON public.site_config FOR SELECT
  USING (true);

-- Solo superadmins pueden modificar la configuración
CREATE POLICY "Superadmins can update site config"
  ON public.site_config FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_superadmin = true
    )
  );

CREATE POLICY "Superadmins can insert site config"
  ON public.site_config FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_superadmin = true
    )
  );

-- =====================================================
-- FUNCIONES
-- =====================================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_debts_updated_at
  BEFORE UPDATE ON public.debts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_site_config_updated_at
  BEFORE UPDATE ON public.site_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FUNCIÓN: Crear perfil automáticamente al registrar usuario
-- =====================================================
-- Nota: Esta función debe ser llamada desde un trigger en auth.users
-- o manejada desde el frontend después del signup

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nickname, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'nickname',
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para crear perfil automáticamente
-- Descomentar si quieres que el perfil se cree automáticamente
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- FIN DEL SCHEMA
-- =====================================================
