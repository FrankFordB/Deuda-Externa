-- ============================================
-- SCHEMA COMPLETO PARA GESTOR DE DEUDAS
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PASO 1: CREAR TABLAS (sin políticas)
-- ============================================

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- EXPENSES
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FRIENDSHIPS
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DEBTS
CREATE TABLE IF NOT EXISTS debts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DEBT_PAYMENTS
CREATE TABLE IF NOT EXISTS debt_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INSTALLMENTS
CREATE TABLE IF NOT EXISTS installments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  description TEXT NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  installment_amount DECIMAL(12,2) NOT NULL,
  total_installments INTEGER NOT NULL,
  paid_installments INTEGER DEFAULT 0,
  start_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- INSTALLMENT_PAYMENTS
CREATE TABLE IF NOT EXISTS installment_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  installment_number INTEGER NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SITE_CONFIG
CREATE TABLE IF NOT EXISTS site_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- VIRTUAL_FRIENDS (amigos sin cuenta real, creados por el usuario)
CREATE TABLE IF NOT EXISTS virtual_friends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOTIFICATIONS (sistema de notificaciones)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL, -- 'payment_confirmation', 'friend_request', 'debt_request', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB, -- datos adicionales como debt_id, friend_id, etc.
  read BOOLEAN DEFAULT FALSE,
  action_required BOOLEAN DEFAULT FALSE,
  action_type TEXT, -- 'confirm_payment', 'accept_friend', etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PAYMENT_CONFIRMATIONS (confirmaciones de pago pendientes)
CREATE TABLE IF NOT EXISTS payment_confirmations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debt_id UUID REFERENCES debts(id) ON DELETE CASCADE NOT NULL,
  requester_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  confirmer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'rejected'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

-- ============================================
-- PASO 2: AGREGAR COLUMNAS FALTANTES
-- ============================================

-- Profiles
DO $$ BEGIN ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'user'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE profiles ADD COLUMN avatar_url TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE profiles ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW(); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE profiles ADD COLUMN monthly_income DECIMAL(12,2) DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE profiles ADD COLUMN nickname TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE profiles ADD COLUMN first_name TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE profiles ADD COLUMN last_name TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE profiles ADD COLUMN country TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE profiles ADD COLUMN status TEXT DEFAULT 'active'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Categories
DO $$ BEGIN ALTER TABLE categories ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE categories ADD COLUMN is_default BOOLEAN DEFAULT FALSE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE categories ADD COLUMN icon TEXT DEFAULT '📁'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE categories ADD COLUMN color TEXT DEFAULT '#6366f1'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Expenses
DO $$ BEGIN ALTER TABLE expenses ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE expenses ADD COLUMN category_id UUID REFERENCES categories(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE expenses ADD COLUMN category TEXT DEFAULT 'other'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE expenses ADD COLUMN payment_source TEXT DEFAULT 'cash'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE expenses ADD COLUMN is_paid BOOLEAN DEFAULT FALSE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE expenses ADD COLUMN paid_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE expenses ADD COLUMN installments INTEGER DEFAULT 1; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE expenses ADD COLUMN current_installment INTEGER DEFAULT 1; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE expenses ADD COLUMN parent_expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE expenses ADD COLUMN friend_id UUID REFERENCES auth.users(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Friendships
DO $$ BEGIN ALTER TABLE friendships ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE friendships ADD COLUMN friend_id UUID REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE friendships ADD COLUMN accepted_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Debts
DO $$ BEGIN ALTER TABLE debts ADD COLUMN creditor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE debts ADD COLUMN debtor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE debts ADD COLUMN virtual_friend_id UUID REFERENCES virtual_friends(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE debts ADD COLUMN remaining_amount DECIMAL(12,2); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE debts ADD COLUMN due_date DATE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE debts ADD COLUMN accepted_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE debts ADD COLUMN category TEXT DEFAULT 'other'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Debt payments
DO $$ BEGIN ALTER TABLE debt_payments ADD COLUMN debt_id UUID REFERENCES debts(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Installments
DO $$ BEGIN ALTER TABLE installments ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE installments ADD COLUMN due_day INTEGER; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Installment payments
DO $$ BEGIN ALTER TABLE installment_payments ADD COLUMN installment_id UUID REFERENCES installments(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ============================================
-- PASO 3: HABILITAR RLS
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE installment_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE virtual_friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_confirmations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PASO 4: ELIMINAR POLÍTICAS EXISTENTES
-- ============================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON profiles;
DROP POLICY IF EXISTS "Service role bypass" ON profiles;

DROP POLICY IF EXISTS "Users can manage own categories" ON categories;
DROP POLICY IF EXISTS "Users can view default categories" ON categories;

DROP POLICY IF EXISTS "Users can manage own expenses" ON expenses;

DROP POLICY IF EXISTS "Users can view own friendships" ON friendships;
DROP POLICY IF EXISTS "Users can create friendship requests" ON friendships;
DROP POLICY IF EXISTS "Users can update friendships they're part of" ON friendships;
DROP POLICY IF EXISTS "Users can delete own friendships" ON friendships;

DROP POLICY IF EXISTS "Users can view debts they're part of" ON debts;
DROP POLICY IF EXISTS "Users can create debts as creditor" ON debts;
DROP POLICY IF EXISTS "Users can update debts they're part of" ON debts;
DROP POLICY IF EXISTS "Creditors can delete their debts" ON debts;

DROP POLICY IF EXISTS "Users can view payments for their debts" ON debt_payments;
DROP POLICY IF EXISTS "Users can create payments for debts they're part of" ON debt_payments;

DROP POLICY IF EXISTS "Users can manage own installments" ON installments;

DROP POLICY IF EXISTS "Users can manage payments for own installments" ON installment_payments;

DROP POLICY IF EXISTS "Anyone can read site config" ON site_config;

DROP POLICY IF EXISTS "Users can manage own virtual friends" ON virtual_friends;

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;

DROP POLICY IF EXISTS "Users can view own payment confirmations" ON payment_confirmations;
DROP POLICY IF EXISTS "Users can create payment confirmations" ON payment_confirmations;
DROP POLICY IF EXISTS "Users can update payment confirmations" ON payment_confirmations;

-- ============================================
-- PASO 5: CREAR POLÍTICAS RLS
-- ============================================

-- Profiles (políticas simples sin subconsultas)
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Enable insert for authenticated users only" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Service role bypass" ON profiles FOR ALL USING (auth.role() = 'service_role');

-- Categories
CREATE POLICY "Users can manage own categories" ON categories FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view default categories" ON categories FOR SELECT USING (is_default = TRUE);

-- Expenses
CREATE POLICY "Users can manage own expenses" ON expenses FOR ALL USING (auth.uid() = user_id);

-- Friendships
CREATE POLICY "Users can view own friendships" ON friendships FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can create friendship requests" ON friendships FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update friendships they're part of" ON friendships FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can delete own friendships" ON friendships FOR DELETE USING (auth.uid() = user_id);

-- Debts
CREATE POLICY "Users can view debts they're part of" ON debts FOR SELECT USING (auth.uid() = creditor_id OR auth.uid() = debtor_id);
CREATE POLICY "Users can create debts as creditor" ON debts FOR INSERT WITH CHECK (auth.uid() = creditor_id);
CREATE POLICY "Users can update debts they're part of" ON debts FOR UPDATE USING (auth.uid() = creditor_id OR auth.uid() = debtor_id);
CREATE POLICY "Creditors can delete their debts" ON debts FOR DELETE USING (auth.uid() = creditor_id);

-- Debt Payments
CREATE POLICY "Users can view payments for their debts" ON debt_payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM debts WHERE debts.id = debt_payments.debt_id AND (debts.creditor_id = auth.uid() OR debts.debtor_id = auth.uid()))
);
CREATE POLICY "Users can create payments for debts they're part of" ON debt_payments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM debts WHERE debts.id = debt_id AND (debts.creditor_id = auth.uid() OR debts.debtor_id = auth.uid()))
);

-- Installments
CREATE POLICY "Users can manage own installments" ON installments FOR ALL USING (auth.uid() = user_id);

-- Installment Payments
CREATE POLICY "Users can manage payments for own installments" ON installment_payments FOR ALL USING (
  EXISTS (SELECT 1 FROM installments WHERE installments.id = installment_payments.installment_id AND installments.user_id = auth.uid())
);

-- Site Config (todos pueden leer, solo desde el backend se modifica)
CREATE POLICY "Anyone can read site config" ON site_config FOR SELECT USING (TRUE);

-- Virtual Friends (usuarios gestionan sus amigos virtuales)
CREATE POLICY "Users can manage own virtual friends" ON virtual_friends FOR ALL USING (auth.uid() = user_id);

-- Notifications
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert notifications" ON notifications FOR INSERT WITH CHECK (TRUE);

-- Payment Confirmations
CREATE POLICY "Users can view own payment confirmations" ON payment_confirmations FOR SELECT 
  USING (auth.uid() = requester_id OR auth.uid() = confirmer_id);
CREATE POLICY "Users can create payment confirmations" ON payment_confirmations FOR INSERT 
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Users can update payment confirmations" ON payment_confirmations FOR UPDATE 
  USING (auth.uid() = confirmer_id);

-- ============================================
-- PASO 6: FUNCIONES Y TRIGGERS
-- ============================================

-- Función: Crear perfil automáticamente al registrar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Función: Actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_debts_updated_at ON debts;
CREATE TRIGGER update_debts_updated_at BEFORE UPDATE ON debts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_installments_updated_at ON installments;
CREATE TRIGGER update_installments_updated_at BEFORE UPDATE ON installments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PASO 7: DATOS POR DEFECTO
-- ============================================

-- Configuración del sitio
INSERT INTO site_config (key, value) VALUES ('site_name', '"GestorDeudas"'::jsonb) ON CONFLICT (key) DO NOTHING;
INSERT INTO site_config (key, value) VALUES ('currency', '"$"'::jsonb) ON CONFLICT (key) DO NOTHING;
INSERT INTO site_config (key, value) VALUES ('theme', '"dark"'::jsonb) ON CONFLICT (key) DO NOTHING;
INSERT INTO site_config (key, value) VALUES ('maintenance_mode', 'false'::jsonb) ON CONFLICT (key) DO NOTHING;

-- Categorías por defecto (sin user_id = categorías del sistema)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM categories WHERE is_default = TRUE LIMIT 1) THEN
    INSERT INTO categories (name, icon, color, is_default, user_id) VALUES ('Comida', '🍔', '#ef4444', TRUE, NULL);
    INSERT INTO categories (name, icon, color, is_default, user_id) VALUES ('Transporte', '🚗', '#f97316', TRUE, NULL);
    INSERT INTO categories (name, icon, color, is_default, user_id) VALUES ('Entretenimiento', '🎮', '#8b5cf6', TRUE, NULL);
    INSERT INTO categories (name, icon, color, is_default, user_id) VALUES ('Salud', '💊', '#10b981', TRUE, NULL);
    INSERT INTO categories (name, icon, color, is_default, user_id) VALUES ('Educación', '📚', '#3b82f6', TRUE, NULL);
    INSERT INTO categories (name, icon, color, is_default, user_id) VALUES ('Hogar', '🏠', '#6366f1', TRUE, NULL);
    INSERT INTO categories (name, icon, color, is_default, user_id) VALUES ('Ropa', '👕', '#ec4899', TRUE, NULL);
    INSERT INTO categories (name, icon, color, is_default, user_id) VALUES ('Servicios', '💡', '#eab308', TRUE, NULL);
    INSERT INTO categories (name, icon, color, is_default, user_id) VALUES ('Otros', '📦', '#64748b', TRUE, NULL);
  END IF;
END $$;

-- ============================================
-- PASO 8: ÍNDICES PARA RENDIMIENTO
-- ============================================
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_debts_creditor ON debts(creditor_id);
CREATE INDEX IF NOT EXISTS idx_debts_debtor ON debts(debtor_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_installments_user ON installments(user_id);
CREATE INDEX IF NOT EXISTS idx_virtual_friends_user ON virtual_friends(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_payment_confirmations_confirmer ON payment_confirmations(confirmer_id, status);
