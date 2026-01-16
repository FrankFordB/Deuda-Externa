-- =====================================================
-- MIGRACIÓN: Agregar columnas y tablas faltantes
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 0. POLÍTICAS RLS PARA PROFILES (CRÍTICO PARA GUARDAR SUELDO)
-- =====================================================
-- Primero eliminar políticas existentes si hay conflictos
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can search profiles by nickname" ON public.profiles;

-- Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Política para ver propio perfil
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Política para buscar otros usuarios (necesario para agregar amigos)
CREATE POLICY "Users can search profiles by nickname"
  ON public.profiles FOR SELECT
  USING (true);

-- Política para actualizar propio perfil (CRÍTICO para guardar sueldo)
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Política para insertar propio perfil
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- =====================================================
-- 0.5 POLÍTICAS RLS PARA EXPENSES (CRÍTICO PARA GUARDAR GASTOS)
-- =====================================================
DROP POLICY IF EXISTS "Users can view own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can create expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can update own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can delete own expenses" ON public.expenses;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own expenses"
  ON public.expenses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expenses"
  ON public.expenses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses"
  ON public.expenses FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 0.6 POLÍTICAS RLS PARA DEBTS
-- =====================================================
DROP POLICY IF EXISTS "Users can view debts as creditor" ON public.debts;
DROP POLICY IF EXISTS "Users can view debts as debtor" ON public.debts;
DROP POLICY IF EXISTS "Users can create debts" ON public.debts;
DROP POLICY IF EXISTS "Users can update debts as creditor" ON public.debts;
DROP POLICY IF EXISTS "Users can update debts as debtor" ON public.debts;

ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view debts as creditor"
  ON public.debts FOR SELECT
  USING (auth.uid() = creditor_id);

CREATE POLICY "Users can view debts as debtor"
  ON public.debts FOR SELECT
  USING (auth.uid() = debtor_id);

CREATE POLICY "Users can create debts"
  ON public.debts FOR INSERT
  WITH CHECK (auth.uid() = creditor_id);

CREATE POLICY "Users can update debts as creditor"
  ON public.debts FOR UPDATE
  USING (auth.uid() = creditor_id);

CREATE POLICY "Users can update debts as debtor"
  ON public.debts FOR UPDATE
  USING (auth.uid() = debtor_id);

-- =====================================================
-- 0.7 POLÍTICAS RLS PARA FRIENDSHIPS
-- =====================================================
DROP POLICY IF EXISTS "Users can view own friendships" ON public.friendships;
DROP POLICY IF EXISTS "Users can create friendship requests" ON public.friendships;
DROP POLICY IF EXISTS "Users can update friendships" ON public.friendships;
DROP POLICY IF EXISTS "Users can delete own friendships" ON public.friendships;

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own friendships"
  ON public.friendships FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can create friendship requests"
  ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update friendships"
  ON public.friendships FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete own friendships"
  ON public.friendships FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- =====================================================
-- 1. Agregar columna monthly_income a profiles
-- =====================================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS monthly_income DECIMAL(12, 2) DEFAULT 0;

-- Agregar otras columnas que pueden faltar en profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS first_name TEXT;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_name TEXT;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS nickname TEXT;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS country TEXT;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Crear índice para nickname si no existe
CREATE INDEX IF NOT EXISTS idx_profiles_nickname ON public.profiles(nickname);

-- =====================================================
-- 1.5 Asegurar columnas en friendships
-- =====================================================
ALTER TABLE public.friendships 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.friendships 
ADD COLUMN IF NOT EXISTS friend_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.friendships 
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;

-- =====================================================
-- 2. Crear tabla virtual_friends (amigos ficticios)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.virtual_friends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para virtual_friends
CREATE INDEX IF NOT EXISTS idx_virtual_friends_user ON public.virtual_friends(user_id);
CREATE INDEX IF NOT EXISTS idx_virtual_friends_name ON public.virtual_friends(name);

-- RLS para virtual_friends
ALTER TABLE public.virtual_friends ENABLE ROW LEVEL SECURITY;

-- Políticas para virtual_friends (eliminar si existen)
DROP POLICY IF EXISTS "Users can view own virtual friends" ON public.virtual_friends;
CREATE POLICY "Users can view own virtual friends"
  ON public.virtual_friends FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create virtual friends" ON public.virtual_friends;
CREATE POLICY "Users can create virtual friends"
  ON public.virtual_friends FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own virtual friends" ON public.virtual_friends;
CREATE POLICY "Users can update own virtual friends"
  ON public.virtual_friends FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own virtual friends" ON public.virtual_friends;
CREATE POLICY "Users can delete own virtual friends"
  ON public.virtual_friends FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 3. Modificar tabla debts para soportar amigos virtuales
-- =====================================================
-- Agregar columna para tipo de deudor (real o virtual)
ALTER TABLE public.debts 
ADD COLUMN IF NOT EXISTS debtor_type TEXT DEFAULT 'real' CHECK (debtor_type IN ('real', 'virtual'));

-- Agregar columna para referencia a amigo virtual
ALTER TABLE public.debts 
ADD COLUMN IF NOT EXISTS virtual_friend_id UUID REFERENCES public.virtual_friends(id) ON DELETE SET NULL;

-- Agregar columna accepted_at para saber cuándo se aceptó
ALTER TABLE public.debts 
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;

-- Agregar columna category para categorizar deudas
ALTER TABLE public.debts 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other';

-- Hacer debtor_id nullable para deudas con amigos virtuales
ALTER TABLE public.debts 
ALTER COLUMN debtor_id DROP NOT NULL;

-- =====================================================
-- 4. Crear tabla payment_reminders (recordatorios de pago)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.payment_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('debt', 'expense', 'installment')),
  reference_id UUID NOT NULL, -- ID de la deuda, gasto o cuota
  reminder_date DATE NOT NULL, -- Fecha del recordatorio
  days_before INTEGER DEFAULT 1, -- Días antes del vencimiento
  message TEXT,
  sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para payment_reminders
CREATE INDEX IF NOT EXISTS idx_reminders_user ON public.payment_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_date ON public.payment_reminders(reminder_date);
CREATE INDEX IF NOT EXISTS idx_reminders_sent ON public.payment_reminders(sent);
CREATE INDEX IF NOT EXISTS idx_reminders_type ON public.payment_reminders(reminder_type);

-- RLS para payment_reminders
ALTER TABLE public.payment_reminders ENABLE ROW LEVEL SECURITY;

-- Políticas para payment_reminders (eliminar si existen)
DROP POLICY IF EXISTS "Users can view own reminders" ON public.payment_reminders;
CREATE POLICY "Users can view own reminders"
  ON public.payment_reminders FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create reminders" ON public.payment_reminders;
CREATE POLICY "Users can create reminders"
  ON public.payment_reminders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own reminders" ON public.payment_reminders;
CREATE POLICY "Users can update own reminders"
  ON public.payment_reminders FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own reminders" ON public.payment_reminders;
CREATE POLICY "Users can delete own reminders"
  ON public.payment_reminders FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 5. Agregar columna due_date a expenses para recordatorios
-- =====================================================
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS due_date DATE;

-- =====================================================
-- 6. Agregar columna due_date a debts para recordatorios
-- =====================================================
ALTER TABLE public.debts 
ADD COLUMN IF NOT EXISTS due_date DATE;

-- =====================================================
-- 7. Crear tabla notifications si no existe (mejorada)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'friend_request', 'debt_request', 'payment_reminder', 'payment_due', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB, -- Datos adicionales (IDs relacionados, etc.)
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

-- RLS para notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Políticas para notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create notifications" ON public.notifications;
CREATE POLICY "Users can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true); -- Permitir crear notificaciones para otros usuarios

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 8. Función para generar recordatorios automáticos
-- =====================================================
CREATE OR REPLACE FUNCTION generate_payment_reminders()
RETURNS void AS $$
DECLARE
  tomorrow DATE := CURRENT_DATE + INTERVAL '1 day';
  two_days DATE := CURRENT_DATE + INTERVAL '2 days';
BEGIN
  -- Recordatorios para deudas que debo pagar (1 día antes)
  INSERT INTO public.notifications (user_id, type, title, message, data)
  SELECT 
    d.debtor_id,
    'payment_due',
    '⏰ Pago mañana',
    'Tienes una deuda de $' || d.amount || ' que vence mañana: ' || d.description,
    jsonb_build_object('debt_id', d.id, 'amount', d.amount, 'due_date', d.due_date)
  FROM public.debts d
  WHERE d.due_date = tomorrow
    AND d.status = 'accepted'
    AND d.debtor_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n 
      WHERE n.data->>'debt_id' = d.id::text 
      AND n.type = 'payment_due'
      AND n.created_at > CURRENT_DATE - INTERVAL '1 day'
    );

  -- Recordatorios para deudas que debo pagar (2 días antes)
  INSERT INTO public.notifications (user_id, type, title, message, data)
  SELECT 
    d.debtor_id,
    'payment_reminder',
    '📅 Pago en 2 días',
    'Tienes una deuda de $' || d.amount || ' que vence en 2 días: ' || d.description,
    jsonb_build_object('debt_id', d.id, 'amount', d.amount, 'due_date', d.due_date)
  FROM public.debts d
  WHERE d.due_date = two_days
    AND d.status = 'accepted'
    AND d.debtor_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n 
      WHERE n.data->>'debt_id' = d.id::text 
      AND n.type = 'payment_reminder'
      AND n.created_at > CURRENT_DATE - INTERVAL '1 day'
    );

  -- Recordatorios para cobros (1 día antes)
  INSERT INTO public.notifications (user_id, type, title, message, data)
  SELECT 
    d.creditor_id,
    'collection_due',
    '💰 Cobro mañana',
    'Mañana vence el pago de $' || d.amount || ' de tu deuda: ' || d.description,
    jsonb_build_object('debt_id', d.id, 'amount', d.amount, 'due_date', d.due_date)
  FROM public.debts d
  WHERE d.due_date = tomorrow
    AND d.status = 'accepted'
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n 
      WHERE n.data->>'debt_id' = d.id::text 
      AND n.type = 'collection_due'
      AND n.created_at > CURRENT_DATE - INTERVAL '1 day'
    );

  -- Recordatorios para gastos con fecha de vencimiento (1 día antes)
  INSERT INTO public.notifications (user_id, type, title, message, data)
  SELECT 
    e.user_id,
    'expense_due',
    '📋 Gasto mañana',
    'Mañana vence tu gasto de $' || e.amount || ': ' || e.description,
    jsonb_build_object('expense_id', e.id, 'amount', e.amount, 'due_date', e.due_date)
  FROM public.expenses e
  WHERE e.due_date = tomorrow
    AND e.status = 'pending'
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n 
      WHERE n.data->>'expense_id' = e.id::text 
      AND n.type = 'expense_due'
      AND n.created_at > CURRENT_DATE - INTERVAL '1 day'
    );

  -- Recordatorios para cuotas (1 día antes)
  INSERT INTO public.notifications (user_id, type, title, message, data)
  SELECT 
    e.user_id,
    'installment_due',
    '🔄 Cuota mañana',
    'Mañana vence la cuota #' || i.installment_number || ' de $' || i.amount || ': ' || e.description,
    jsonb_build_object('installment_id', i.id, 'expense_id', e.id, 'amount', i.amount, 'due_date', i.due_date)
  FROM public.installments i
  JOIN public.expenses e ON e.id = i.expense_id
  WHERE i.due_date = tomorrow
    AND i.paid = FALSE
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n 
      WHERE n.data->>'installment_id' = i.id::text 
      AND n.type = 'installment_due'
      AND n.created_at > CURRENT_DATE - INTERVAL '1 day'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. Trigger para actualizar updated_at en virtual_friends
-- =====================================================
DROP TRIGGER IF EXISTS update_virtual_friends_updated_at ON public.virtual_friends;
CREATE TRIGGER update_virtual_friends_updated_at
  BEFORE UPDATE ON public.virtual_friends
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
