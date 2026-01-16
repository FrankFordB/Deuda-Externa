-- =====================================================
-- MIGRACIÓN COMPLETA: Corregir todos los problemas
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. CORREGIR TABLA PROFILES
-- =====================================================

-- Hacer columnas nullable para evitar problemas de inserción
ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN nickname DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN first_name DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN last_name DROP NOT NULL;

-- Agregar columna avatar_url para foto de perfil
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Agregar monthly_income si no existe
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_income DECIMAL(12, 2) DEFAULT 0;

-- =====================================================
-- 2. CORREGIR TABLA EXPENSES - Agregar columnas faltantes
-- =====================================================

-- La tabla expenses necesita estas columnas que el servicio espera
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS friend_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS installments INTEGER DEFAULT 1;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS current_installment INTEGER DEFAULT 1;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS parent_expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS debt_id UUID REFERENCES public.debts(id) ON DELETE SET NULL;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS due_date DATE;

-- Renombrar is_installment a usar installments si es necesario
-- (la tabla original usa is_installment pero el servicio usa installments)

-- =====================================================
-- 3. CORREGIR TABLA DEBTS - Agregar columnas para cuotas
-- =====================================================

-- Columnas para deudas virtuales y cuotas
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS virtual_friend_id UUID;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS debtor_type TEXT DEFAULT 'real' CHECK (debtor_type IN ('real', 'virtual'));
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other';
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS purchase_date DATE;

-- Columnas para cuotas
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS installments INTEGER DEFAULT 1;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS current_installment INTEGER DEFAULT 1;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS installment_amount DECIMAL(12, 2);
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12, 2);

-- Hacer debtor_id nullable para deudas con amigos virtuales
ALTER TABLE public.debts ALTER COLUMN debtor_id DROP NOT NULL;

-- =====================================================
-- 4. CREAR TABLA debt_installments
-- =====================================================

CREATE TABLE IF NOT EXISTS public.debt_installments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  due_date DATE NOT NULL,
  paid BOOLEAN DEFAULT FALSE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para debt_installments
CREATE INDEX IF NOT EXISTS idx_debt_installments_debt ON public.debt_installments(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_installments_due_date ON public.debt_installments(due_date);
CREATE INDEX IF NOT EXISTS idx_debt_installments_paid ON public.debt_installments(paid);

-- RLS para debt_installments
ALTER TABLE public.debt_installments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own debt installments" ON public.debt_installments;
CREATE POLICY "Users can view own debt installments"
  ON public.debt_installments FOR SELECT
  USING (
    debt_id IN (
      SELECT id FROM public.debts WHERE creditor_id = auth.uid() OR debtor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create debt installments" ON public.debt_installments;
CREATE POLICY "Users can create debt installments"
  ON public.debt_installments FOR INSERT
  WITH CHECK (
    debt_id IN (
      SELECT id FROM public.debts WHERE creditor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update debt installments" ON public.debt_installments;
CREATE POLICY "Users can update debt installments"
  ON public.debt_installments FOR UPDATE
  USING (
    debt_id IN (
      SELECT id FROM public.debts WHERE creditor_id = auth.uid() OR debtor_id = auth.uid()
    )
  );

-- =====================================================
-- 5. CREAR TABLA virtual_friends si no existe
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

-- Agregar FK a debts si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'debts_virtual_friend_id_fkey'
  ) THEN
    ALTER TABLE public.debts 
    ADD CONSTRAINT debts_virtual_friend_id_fkey 
    FOREIGN KEY (virtual_friend_id) REFERENCES public.virtual_friends(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- RLS para virtual_friends
ALTER TABLE public.virtual_friends ENABLE ROW LEVEL SECURITY;

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
-- 6. CREAR TABLA notifications si no existe
-- =====================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);

-- RLS para notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create notifications" ON public.notifications;
CREATE POLICY "Users can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 7. HABILITAR REALTIME en las tablas
-- =====================================================

-- Necesario para que funcionen los canales de realtime
-- Usar DO block para ignorar errores si ya están agregadas
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- Ya está agregada, ignorar
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.debts;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.debt_installments;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- =====================================================
-- 8. FUNCIÓN para generar nickname único
-- =====================================================

CREATE OR REPLACE FUNCTION generate_unique_nickname(base_name TEXT)
RETURNS TEXT AS $$
DECLARE
  clean_name TEXT;
  new_nickname TEXT;
  counter INTEGER := 0;
BEGIN
  -- Limpiar nombre: solo letras minúsculas y números
  clean_name := lower(regexp_replace(base_name, '[^a-zA-Z0-9]', '', 'g'));
  
  -- Si queda vacío, usar 'user'
  IF clean_name = '' THEN
    clean_name := 'user';
  END IF;
  
  -- Intentar generar nickname único
  LOOP
    IF counter = 0 THEN
      new_nickname := clean_name || floor(random() * 9999)::text;
    ELSE
      new_nickname := clean_name || floor(random() * 99999)::text;
    END IF;
    
    -- Verificar si existe
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE nickname = new_nickname) THEN
      RETURN new_nickname;
    END IF;
    
    counter := counter + 1;
    EXIT WHEN counter > 10;
  END LOOP;
  
  -- Fallback con timestamp
  RETURN clean_name || extract(epoch from now())::bigint::text;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 9. NOTA: Trigger para crear perfil automáticamente
-- =====================================================
-- El trigger en auth.users no se puede crear desde SQL Editor.
-- El perfil se crea desde el código de la aplicación (authService.js)
-- cuando el usuario se registra.

-- =====================================================
-- 10. CREAR BUCKET para avatares (fotos de perfil)
-- =====================================================

-- NOTA: El bucket y las políticas de Storage se deben crear desde el Dashboard:
-- 1. Ve a Storage -> New Bucket
-- 2. Nombre: "avatars"
-- 3. Marcar como "Public bucket"
-- 4. En Policies, agregar las políticas necesarias desde la UI

-- El siguiente INSERT puede fallar si no tienes permisos, es seguro ignorarlo:
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'No se pudo crear bucket avatars. Créalo manualmente desde Storage.';
END $$;

-- =====================================================
-- 11. CREAR PERFILES FALTANTES para usuarios existentes
-- =====================================================

INSERT INTO public.profiles (id, email, nickname, first_name, last_name, created_at, updated_at)
SELECT 
  u.id,
  u.email,
  generate_unique_nickname(split_part(u.email, '@', 1)),
  COALESCE(u.raw_user_meta_data->>'first_name', split_part(u.email, '@', 1)),
  COALESCE(u.raw_user_meta_data->>'last_name', ''),
  u.created_at,
  NOW()
FROM auth.users u
WHERE u.id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
