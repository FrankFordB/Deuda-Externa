-- =====================================================
-- FIX COMPLETO: Corregir todos los problemas de la BD
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- 1. Eliminar constraints incorrectas
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_friend_id_fkey;
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_user_id_fkey;

-- 2. Eliminar columna friend_id si causa problemas (opcional)
-- Si prefieres no tener friend_id en expenses, descomenta esta línea:
-- ALTER TABLE public.expenses DROP COLUMN IF EXISTS friend_id;

-- 3. Hacer columnas de profiles nullable para evitar errores al registrar
ALTER TABLE public.profiles 
ALTER COLUMN first_name DROP NOT NULL,
ALTER COLUMN last_name DROP NOT NULL,
ALTER COLUMN nickname DROP NOT NULL;

-- 4. Agregar columnas faltantes a expenses si no existen
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'expenses' AND column_name = 'installments') THEN
        ALTER TABLE public.expenses ADD COLUMN installments INTEGER DEFAULT 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'expenses' AND column_name = 'current_installment') THEN
        ALTER TABLE public.expenses ADD COLUMN current_installment INTEGER DEFAULT 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'expenses' AND column_name = 'parent_expense_id') THEN
        ALTER TABLE public.expenses ADD COLUMN parent_expense_id UUID;
    END IF;
END $$;

-- 5. Agregar columnas faltantes a debts si no existen
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'debts' AND column_name = 'virtual_friend_id') THEN
        ALTER TABLE public.debts ADD COLUMN virtual_friend_id UUID;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'debts' AND column_name = 'debtor_type') THEN
        ALTER TABLE public.debts ADD COLUMN debtor_type TEXT DEFAULT 'real';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'debts' AND column_name = 'purchase_date') THEN
        ALTER TABLE public.debts ADD COLUMN purchase_date DATE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'debts' AND column_name = 'due_date') THEN
        ALTER TABLE public.debts ADD COLUMN due_date DATE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'debts' AND column_name = 'installments') THEN
        ALTER TABLE public.debts ADD COLUMN installments INTEGER DEFAULT 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'debts' AND column_name = 'installment_amount') THEN
        ALTER TABLE public.debts ADD COLUMN installment_amount DECIMAL(12,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'debts' AND column_name = 'total_amount') THEN
        ALTER TABLE public.debts ADD COLUMN total_amount DECIMAL(12,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'debts' AND column_name = 'accepted_at') THEN
        ALTER TABLE public.debts ADD COLUMN accepted_at TIMESTAMPTZ;
    END IF;
END $$;

-- 6. Crear tabla virtual_friends si no existe
CREATE TABLE IF NOT EXISTS public.virtual_friends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Crear tabla debt_installments si no existe
CREATE TABLE IF NOT EXISTS public.debt_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    due_date DATE NOT NULL,
    is_paid BOOLEAN DEFAULT FALSE,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Crear tabla notifications si no existe
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    data JSONB,
    read BOOLEAN DEFAULT FALSE,
    action_required BOOLEAN DEFAULT FALSE,
    action_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Habilitar RLS en nuevas tablas
ALTER TABLE public.virtual_friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 10. Políticas para virtual_friends
DROP POLICY IF EXISTS "Users can manage their virtual friends" ON public.virtual_friends;
CREATE POLICY "Users can manage their virtual friends" ON public.virtual_friends
    FOR ALL USING (auth.uid() = user_id);

-- 11. Políticas para debt_installments
DROP POLICY IF EXISTS "Users can view their debt installments" ON public.debt_installments;
CREATE POLICY "Users can view their debt installments" ON public.debt_installments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.debts 
            WHERE debts.id = debt_installments.debt_id 
            AND (debts.creditor_id = auth.uid() OR debts.debtor_id = auth.uid())
        )
    );

-- 12. Políticas para notifications
DROP POLICY IF EXISTS "Users can manage their notifications" ON public.notifications;
CREATE POLICY "Users can manage their notifications" ON public.notifications
    FOR ALL USING (auth.uid() = user_id);

-- 13. Verificar y corregir políticas de expenses
DROP POLICY IF EXISTS "Users can manage their expenses" ON public.expenses;
CREATE POLICY "Users can manage their expenses" ON public.expenses
    FOR ALL USING (auth.uid() = user_id);

-- 14. Verificar y corregir políticas de debts
DROP POLICY IF EXISTS "Users can view debts where they are creditor or debtor" ON public.debts;
CREATE POLICY "Users can view debts where they are creditor or debtor" ON public.debts
    FOR SELECT USING (auth.uid() = creditor_id OR auth.uid() = debtor_id);

DROP POLICY IF EXISTS "Users can create debts as creditor" ON public.debts;
CREATE POLICY "Users can create debts as creditor" ON public.debts
    FOR INSERT WITH CHECK (auth.uid() = creditor_id);

DROP POLICY IF EXISTS "Users can update debts they participate in" ON public.debts;
CREATE POLICY "Users can update debts they participate in" ON public.debts
    FOR UPDATE USING (auth.uid() = creditor_id OR auth.uid() = debtor_id);

-- =====================================================
-- FIN - Ejecutar este script completo en SQL Editor
-- =====================================================
