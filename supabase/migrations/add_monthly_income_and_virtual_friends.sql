-- =====================================================
-- MIGRACIÓN: Agregar sueldos mensuales y amigos virtuales
-- =====================================================

-- =====================================================
-- TABLA: monthly_incomes (Sueldos mensuales)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.monthly_incomes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  amount DECIMAL(12, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, year, month)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_monthly_incomes_user ON public.monthly_incomes(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_incomes_date ON public.monthly_incomes(year, month);

-- =====================================================
-- TABLA: virtual_friends (Amigos virtuales)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.virtual_friends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_virtual_friends_user ON public.virtual_friends(user_id);

-- =====================================================
-- TABLA: debt_installments (Cuotas de deudas)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.debt_installments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  due_date DATE NOT NULL,
  paid BOOLEAN DEFAULT FALSE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_debt_installments_debt ON public.debt_installments(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_installments_due_date ON public.debt_installments(due_date);
CREATE INDEX IF NOT EXISTS idx_debt_installments_paid ON public.debt_installments(paid);

-- =====================================================
-- ACTUALIZAR TABLA: debts
-- =====================================================
-- Agregar columnas para soportar amigos virtuales y cuotas
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS virtual_friend_id UUID REFERENCES public.virtual_friends(id) ON DELETE CASCADE;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS debtor_type TEXT DEFAULT 'real' CHECK (debtor_type IN ('real', 'virtual'));
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other';
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS purchase_date DATE;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS installments INTEGER DEFAULT 1;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS installment_amount DECIMAL(12, 2);
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12, 2);
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;

-- Hacer debtor_id nullable para permitir amigos virtuales
ALTER TABLE public.debts ALTER COLUMN debtor_id DROP NOT NULL;

-- Actualizar índices
CREATE INDEX IF NOT EXISTS idx_debts_virtual_friend ON public.debts(virtual_friend_id);
CREATE INDEX IF NOT EXISTS idx_debts_debtor_type ON public.debts(debtor_type);

-- =====================================================
-- ACTUALIZAR TABLA: expenses
-- =====================================================
-- Agregar columnas faltantes
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS debt_id UUID REFERENCES public.debts(id) ON DELETE SET NULL;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS parent_expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE;

-- Índice
CREATE INDEX IF NOT EXISTS idx_expenses_debt ON public.expenses(debt_id);
CREATE INDEX IF NOT EXISTS idx_expenses_parent ON public.expenses(parent_expense_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS en nuevas tablas
ALTER TABLE public.monthly_incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.virtual_friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_installments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS: monthly_incomes
-- =====================================================

-- Eliminar políticas existentes si ya existen
DROP POLICY IF EXISTS "Users can view own monthly incomes" ON public.monthly_incomes;
DROP POLICY IF EXISTS "Users can create own monthly incomes" ON public.monthly_incomes;
DROP POLICY IF EXISTS "Users can update own monthly incomes" ON public.monthly_incomes;
DROP POLICY IF EXISTS "Users can delete own monthly incomes" ON public.monthly_incomes;

-- Los usuarios pueden ver sus propios ingresos mensuales
CREATE POLICY "Users can view own monthly incomes"
  ON public.monthly_incomes FOR SELECT
  USING (auth.uid() = user_id);

-- Los usuarios pueden crear sus propios ingresos mensuales
CREATE POLICY "Users can create own monthly incomes"
  ON public.monthly_incomes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Los usuarios pueden actualizar sus propios ingresos mensuales
CREATE POLICY "Users can update own monthly incomes"
  ON public.monthly_incomes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Los usuarios pueden eliminar sus propios ingresos mensuales
CREATE POLICY "Users can delete own monthly incomes"
  ON public.monthly_incomes FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- POLÍTICAS: virtual_friends
-- =====================================================

-- Eliminar políticas existentes si ya existen
DROP POLICY IF EXISTS "Users can view own virtual friends" ON public.virtual_friends;
DROP POLICY IF EXISTS "Users can create own virtual friends" ON public.virtual_friends;
DROP POLICY IF EXISTS "Users can update own virtual friends" ON public.virtual_friends;
DROP POLICY IF EXISTS "Users can delete own virtual friends" ON public.virtual_friends;

-- Los usuarios pueden ver sus propios amigos virtuales
CREATE POLICY "Users can view own virtual friends"
  ON public.virtual_friends FOR SELECT
  USING (auth.uid() = user_id);

-- Los usuarios pueden crear sus propios amigos virtuales
CREATE POLICY "Users can create own virtual friends"
  ON public.virtual_friends FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Los usuarios pueden actualizar sus propios amigos virtuales
CREATE POLICY "Users can update own virtual friends"
  ON public.virtual_friends FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Los usuarios pueden eliminar sus propios amigos virtuales
CREATE POLICY "Users can delete own virtual friends"
  ON public.virtual_friends FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- POLÍTICAS: debt_installments
-- =====================================================

-- Eliminar políticas existentes si ya existen
DROP POLICY IF EXISTS "Users can view own debt installments" ON public.debt_installments;
DROP POLICY IF EXISTS "Users can create debt installments as creditor" ON public.debt_installments;
DROP POLICY IF EXISTS "Users can update debt installments" ON public.debt_installments;

-- Los usuarios pueden ver cuotas de sus deudas (como acreedor o deudor)
CREATE POLICY "Users can view own debt installments"
  ON public.debt_installments FOR SELECT
  USING (
    debt_id IN (
      SELECT id FROM public.debts 
      WHERE creditor_id = auth.uid() OR debtor_id = auth.uid()
    )
  );

-- Los usuarios pueden crear cuotas para sus deudas como acreedor
CREATE POLICY "Users can create debt installments as creditor"
  ON public.debt_installments FOR INSERT
  WITH CHECK (
    debt_id IN (
      SELECT id FROM public.debts WHERE creditor_id = auth.uid()
    )
  );

-- Los usuarios pueden actualizar cuotas de sus deudas
CREATE POLICY "Users can update debt installments"
  ON public.debt_installments FOR UPDATE
  USING (
    debt_id IN (
      SELECT id FROM public.debts 
      WHERE creditor_id = auth.uid() OR debtor_id = auth.uid()
    )
  );

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Eliminar triggers existentes si ya existen
DROP TRIGGER IF EXISTS update_monthly_incomes_updated_at ON public.monthly_incomes;
DROP TRIGGER IF EXISTS update_virtual_friends_updated_at ON public.virtual_friends;
DROP TRIGGER IF EXISTS update_debt_installments_updated_at ON public.debt_installments;

-- Trigger para updated_at en monthly_incomes
CREATE TRIGGER update_monthly_incomes_updated_at
  BEFORE UPDATE ON public.monthly_incomes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para updated_at en virtual_friends
CREATE TRIGGER update_virtual_friends_updated_at
  BEFORE UPDATE ON public.virtual_friends
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para updated_at en debt_installments
CREATE TRIGGER update_debt_installments_updated_at
  BEFORE UPDATE ON public.debt_installments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================
