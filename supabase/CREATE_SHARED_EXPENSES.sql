-- =====================================================
-- SISTEMA DE GASTOS COMPARTIDOS (SPLITWISE-LIKE)
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- =====================================================
-- TABLA: expense_groups (Grupos de gastos)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.expense_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  icon TEXT DEFAULT 'users',
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  total_spent DECIMAL(12, 2) DEFAULT 0,
  currency TEXT DEFAULT 'ARS',
  currency_symbol TEXT DEFAULT '$',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_expense_groups_created_by ON public.expense_groups(created_by);
CREATE INDEX IF NOT EXISTS idx_expense_groups_is_active ON public.expense_groups(is_active);

-- =====================================================
-- TABLA: expense_group_members (Miembros del grupo)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.expense_group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES public.expense_groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  virtual_friend_id UUID REFERENCES public.virtual_friends(id) ON DELETE CASCADE,
  -- Nombre para mostrar (útil para amigos virtuales o invitados)
  display_name TEXT,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  balance DECIMAL(12, 2) DEFAULT 0, -- Saldo en el grupo (+ = le deben, - = debe)
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  CONSTRAINT member_type_check CHECK (
    (user_id IS NOT NULL AND virtual_friend_id IS NULL) OR
    (user_id IS NULL AND virtual_friend_id IS NOT NULL)
  )
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_group_members_group ON public.expense_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON public.expense_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_virtual ON public.expense_group_members(virtual_friend_id);

-- Constraint único: un usuario/amigo virtual solo puede estar una vez en un grupo
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_in_group 
  ON public.expense_group_members(group_id, user_id) 
  WHERE user_id IS NOT NULL AND is_active = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_virtual_in_group 
  ON public.expense_group_members(group_id, virtual_friend_id) 
  WHERE virtual_friend_id IS NOT NULL AND is_active = TRUE;

-- =====================================================
-- TABLA: shared_expenses (Gastos compartidos)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.shared_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES public.expense_groups(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL,
  category TEXT DEFAULT 'general',
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  split_type TEXT DEFAULT 'equal' CHECK (split_type IN ('equal', 'custom', 'percentage')),
  notes TEXT,
  receipt_url TEXT,
  currency TEXT DEFAULT 'ARS',
  currency_symbol TEXT DEFAULT '$',
  is_settled BOOLEAN DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_shared_expenses_group ON public.shared_expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_shared_expenses_date ON public.shared_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_shared_expenses_settled ON public.shared_expenses(is_settled);
CREATE INDEX IF NOT EXISTS idx_shared_expenses_created_by ON public.shared_expenses(created_by);

-- =====================================================
-- TABLA: shared_expense_payers (Quién pagó el gasto)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.shared_expense_payers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID NOT NULL REFERENCES public.shared_expenses(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.expense_group_members(id) ON DELETE CASCADE,
  amount_paid DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_expense_payers_expense ON public.shared_expense_payers(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_payers_member ON public.shared_expense_payers(member_id);

-- =====================================================
-- TABLA: shared_expense_splits (División del gasto)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.shared_expense_splits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID NOT NULL REFERENCES public.shared_expenses(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.expense_group_members(id) ON DELETE CASCADE,
  amount_owed DECIMAL(12, 2) NOT NULL, -- Lo que debe pagar este miembro
  amount_paid DECIMAL(12, 2) DEFAULT 0, -- Lo que ya pagó
  is_settled BOOLEAN DEFAULT FALSE,
  settled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense ON public.shared_expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_member ON public.shared_expense_splits(member_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_settled ON public.shared_expense_splits(is_settled);

-- =====================================================
-- TABLA: group_settlements (Liquidaciones entre miembros)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.group_settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES public.expense_groups(id) ON DELETE CASCADE,
  from_member_id UUID NOT NULL REFERENCES public.expense_group_members(id) ON DELETE CASCADE,
  to_member_id UUID NOT NULL REFERENCES public.expense_group_members(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  notes TEXT,
  settled_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  confirmed_by UUID REFERENCES public.profiles(id),
  -- Si se registró en gastos personales y banco
  linked_expense_id UUID REFERENCES public.expenses(id),
  linked_to_bank BOOLEAN DEFAULT FALSE,
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_settlements_group ON public.group_settlements(group_id);
CREATE INDEX IF NOT EXISTS idx_settlements_from ON public.group_settlements(from_member_id);
CREATE INDEX IF NOT EXISTS idx_settlements_to ON public.group_settlements(to_member_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON public.group_settlements(status);

-- =====================================================
-- TABLA: expense_categories (Categorías personalizadas)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.shared_expense_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'tag',
  color TEXT DEFAULT '#6366f1',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice
CREATE INDEX IF NOT EXISTS idx_shared_categories_user ON public.shared_expense_categories(user_id);

-- Insertar categorías por defecto (para todos los usuarios nuevos)
INSERT INTO public.shared_expense_categories (user_id, name, icon, color, is_default)
SELECT 
  p.id,
  c.name,
  c.icon,
  c.color,
  TRUE
FROM public.profiles p
CROSS JOIN (
  VALUES 
    ('Viaje', 'plane', '#3b82f6'),
    ('Casa', 'home', '#22c55e'),
    ('Comida', 'utensils', '#f59e0b'),
    ('Transporte', 'car', '#8b5cf6'),
    ('Entretenimiento', 'film', '#ec4899'),
    ('Compras', 'shopping-bag', '#06b6d4'),
    ('Servicios', 'zap', '#eab308'),
    ('Salud', 'heart', '#ef4444'),
    ('Otros', 'more-horizontal', '#6b7280')
) AS c(name, icon, color)
WHERE NOT EXISTS (
  SELECT 1 FROM public.shared_expense_categories 
  WHERE user_id = p.id AND name = c.name
);

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Habilitar RLS
ALTER TABLE public.expense_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_expense_payers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_expense_categories ENABLE ROW LEVEL SECURITY;

-- EXPENSE_GROUPS policies
CREATE POLICY "expense_groups_select" ON public.expense_groups
  FOR SELECT USING (
    auth.uid() = created_by OR
    id IN (
      SELECT group_id FROM public.expense_group_members 
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "expense_groups_insert" ON public.expense_groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "expense_groups_update" ON public.expense_groups
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "expense_groups_delete" ON public.expense_groups
  FOR DELETE USING (auth.uid() = created_by);

-- EXPENSE_GROUP_MEMBERS policies (sin auto-referencia para evitar recursión)
CREATE POLICY "group_members_select" ON public.expense_group_members
  FOR SELECT USING (
    user_id = auth.uid() OR
    group_id IN (
      SELECT id FROM public.expense_groups WHERE created_by = auth.uid()
    ) OR
    group_id IN (
      SELECT egm.group_id FROM public.expense_group_members egm
      WHERE egm.user_id = auth.uid() AND egm.is_active = TRUE
    )
  );

CREATE POLICY "group_members_insert" ON public.expense_group_members
  FOR INSERT WITH CHECK (
    group_id IN (
      SELECT id FROM public.expense_groups WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "group_members_update" ON public.expense_group_members
  FOR UPDATE USING (
    group_id IN (
      SELECT id FROM public.expense_groups WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "group_members_delete" ON public.expense_group_members
  FOR DELETE USING (
    user_id = auth.uid() OR
    group_id IN (
      SELECT id FROM public.expense_groups WHERE created_by = auth.uid()
    )
  );

-- SHARED_EXPENSES policies
CREATE POLICY "shared_expenses_select" ON public.shared_expenses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.expense_group_members 
      WHERE group_id = shared_expenses.group_id 
      AND user_id = auth.uid() 
      AND is_active = TRUE
    )
  );

CREATE POLICY "shared_expenses_insert" ON public.shared_expenses
  FOR INSERT WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM public.expense_group_members 
      WHERE group_id = shared_expenses.group_id 
      AND user_id = auth.uid() 
      AND is_active = TRUE
    )
  );

CREATE POLICY "shared_expenses_update" ON public.shared_expenses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.expense_group_members 
      WHERE group_id = shared_expenses.group_id 
      AND user_id = auth.uid() 
      AND is_active = TRUE
    )
  );

CREATE POLICY "shared_expenses_delete" ON public.shared_expenses
  FOR DELETE USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM public.expense_groups 
      WHERE id = shared_expenses.group_id 
      AND created_by = auth.uid()
    )
  );

-- SHARED_EXPENSE_PAYERS policies
CREATE POLICY "expense_payers_select" ON public.shared_expense_payers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shared_expenses se
      JOIN public.expense_group_members m ON m.group_id = se.group_id
      WHERE se.id = shared_expense_payers.expense_id
      AND m.user_id = auth.uid()
      AND m.is_active = TRUE
    )
  );

CREATE POLICY "expense_payers_insert" ON public.shared_expense_payers
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "expense_payers_update" ON public.shared_expense_payers
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "expense_payers_delete" ON public.shared_expense_payers
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- SHARED_EXPENSE_SPLITS policies
CREATE POLICY "expense_splits_select" ON public.shared_expense_splits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shared_expenses se
      JOIN public.expense_group_members m ON m.group_id = se.group_id
      WHERE se.id = shared_expense_splits.expense_id
      AND m.user_id = auth.uid()
      AND m.is_active = TRUE
    )
  );

CREATE POLICY "expense_splits_insert" ON public.shared_expense_splits
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "expense_splits_update" ON public.shared_expense_splits
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "expense_splits_delete" ON public.shared_expense_splits
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- GROUP_SETTLEMENTS policies
CREATE POLICY "settlements_select" ON public.group_settlements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.expense_group_members 
      WHERE group_id = group_settlements.group_id 
      AND user_id = auth.uid() 
      AND is_active = TRUE
    )
  );

CREATE POLICY "settlements_insert" ON public.group_settlements
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "settlements_update" ON public.group_settlements
  FOR UPDATE USING (
    auth.uid() = created_by OR
    confirmed_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.expense_group_members m 
      WHERE m.id = group_settlements.to_member_id 
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "settlements_delete" ON public.group_settlements
  FOR DELETE USING (auth.uid() = created_by);

-- SHARED_EXPENSE_CATEGORIES policies
CREATE POLICY "categories_select" ON public.shared_expense_categories
  FOR SELECT USING (auth.uid() = user_id OR is_default = TRUE);

CREATE POLICY "categories_insert" ON public.shared_expense_categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "categories_update" ON public.shared_expense_categories
  FOR UPDATE USING (auth.uid() = user_id AND is_default = FALSE);

CREATE POLICY "categories_delete" ON public.shared_expense_categories
  FOR DELETE USING (auth.uid() = user_id AND is_default = FALSE);

-- =====================================================
-- FUNCIONES AUXILIARES
-- =====================================================

-- Función para recalcular balances del grupo
CREATE OR REPLACE FUNCTION recalculate_group_balances(p_group_id UUID)
RETURNS VOID AS $$
DECLARE
  member_rec RECORD;
  total_paid DECIMAL(12, 2);
  total_owed DECIMAL(12, 2);
BEGIN
  -- Para cada miembro del grupo
  FOR member_rec IN 
    SELECT id FROM public.expense_group_members 
    WHERE group_id = p_group_id AND is_active = TRUE
  LOOP
    -- Calcular total pagado
    SELECT COALESCE(SUM(amount_paid), 0) INTO total_paid
    FROM public.shared_expense_payers
    WHERE member_id = member_rec.id;
    
    -- Calcular total que debe
    SELECT COALESCE(SUM(amount_owed), 0) INTO total_owed
    FROM public.shared_expense_splits
    WHERE member_id = member_rec.id;
    
    -- Actualizar balance (positivo = le deben, negativo = debe)
    UPDATE public.expense_group_members
    SET balance = total_paid - total_owed
    WHERE id = member_rec.id;
  END LOOP;
  
  -- Actualizar total gastado del grupo
  UPDATE public.expense_groups
  SET total_spent = (
    SELECT COALESCE(SUM(total_amount), 0)
    FROM public.shared_expenses
    WHERE group_id = p_group_id
  ),
  updated_at = NOW()
  WHERE id = p_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para recalcular balances cuando se agrega un gasto
CREATE OR REPLACE FUNCTION trigger_recalculate_on_expense()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_group_balances(OLD.group_id);
    RETURN OLD;
  ELSE
    PERFORM recalculate_group_balances(NEW.group_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS recalculate_on_expense_change ON public.shared_expenses;
CREATE TRIGGER recalculate_on_expense_change
  AFTER INSERT OR UPDATE OR DELETE ON public.shared_expenses
  FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_on_expense();

-- Trigger para recalcular balances cuando se modifican payers o splits
CREATE OR REPLACE FUNCTION trigger_recalculate_on_split_change()
RETURNS TRIGGER AS $$
DECLARE
  v_group_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT group_id INTO v_group_id FROM public.shared_expenses WHERE id = OLD.expense_id;
  ELSE
    SELECT group_id INTO v_group_id FROM public.shared_expenses WHERE id = NEW.expense_id;
  END IF;
  
  IF v_group_id IS NOT NULL THEN
    PERFORM recalculate_group_balances(v_group_id);
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS recalculate_on_payer_change ON public.shared_expense_payers;
CREATE TRIGGER recalculate_on_payer_change
  AFTER INSERT OR UPDATE OR DELETE ON public.shared_expense_payers
  FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_on_split_change();

DROP TRIGGER IF EXISTS recalculate_on_split_change ON public.shared_expense_splits;
CREATE TRIGGER recalculate_on_split_change
  AFTER INSERT OR UPDATE OR DELETE ON public.shared_expense_splits
  FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_on_split_change();

-- =====================================================
-- MENSAJE DE ÉXITO
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Sistema de gastos compartidos creado correctamente';
  RAISE NOTICE '📋 Tablas creadas: expense_groups, expense_group_members, shared_expenses, shared_expense_payers, shared_expense_splits, group_settlements, shared_expense_categories';
  RAISE NOTICE '🔒 Políticas RLS configuradas';
  RAISE NOTICE '⚡ Triggers de balance automático configurados';
END $$;
