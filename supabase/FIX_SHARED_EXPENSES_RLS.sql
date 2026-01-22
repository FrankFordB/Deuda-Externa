-- =====================================================
-- FIX: Recursión infinita en políticas RLS
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- Eliminar TODAS las políticas existentes
DROP POLICY IF EXISTS "group_members_select" ON public.expense_group_members;
DROP POLICY IF EXISTS "group_members_insert" ON public.expense_group_members;
DROP POLICY IF EXISTS "group_members_update" ON public.expense_group_members;
DROP POLICY IF EXISTS "group_members_delete" ON public.expense_group_members;
DROP POLICY IF EXISTS "expense_groups_select" ON public.expense_groups;
DROP POLICY IF EXISTS "expense_groups_insert" ON public.expense_groups;
DROP POLICY IF EXISTS "expense_groups_update" ON public.expense_groups;
DROP POLICY IF EXISTS "expense_groups_delete" ON public.expense_groups;

-- Eliminar función helper si existe
DROP FUNCTION IF EXISTS public.is_group_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_user_group_ids(uuid);

-- =====================================================
-- FUNCIÓN HELPER CON SECURITY DEFINER
-- Esta función bypasea RLS para evitar recursión
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_user_group_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT group_id 
  FROM public.expense_group_members 
  WHERE user_id = p_user_id AND is_active = TRUE;
$$;

-- Función para verificar si un usuario es miembro de un grupo
CREATE OR REPLACE FUNCTION public.is_group_member(p_user_id uuid, p_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.expense_group_members 
    WHERE user_id = p_user_id 
    AND group_id = p_group_id 
    AND is_active = TRUE
  );
$$;

-- Función para verificar si un usuario es creador de un grupo
CREATE OR REPLACE FUNCTION public.is_group_creator(p_user_id uuid, p_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.expense_groups 
    WHERE id = p_group_id AND created_by = p_user_id
  );
$$;

-- =====================================================
-- POLÍTICAS EXPENSE_GROUPS (usando funciones helper)
-- =====================================================

CREATE POLICY "expense_groups_select" ON public.expense_groups
  FOR SELECT USING (
    created_by = auth.uid() OR
    public.is_group_member(auth.uid(), id)
  );

CREATE POLICY "expense_groups_insert" ON public.expense_groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "expense_groups_update" ON public.expense_groups
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "expense_groups_delete" ON public.expense_groups
  FOR DELETE USING (auth.uid() = created_by);

-- =====================================================
-- POLÍTICAS EXPENSE_GROUP_MEMBERS (usando funciones helper)
-- =====================================================

CREATE POLICY "group_members_select" ON public.expense_group_members
  FOR SELECT USING (
    user_id = auth.uid() OR
    public.is_group_creator(auth.uid(), group_id) OR
    public.is_group_member(auth.uid(), group_id)
  );

CREATE POLICY "group_members_insert" ON public.expense_group_members
  FOR INSERT WITH CHECK (
    public.is_group_creator(auth.uid(), group_id)
  );

CREATE POLICY "group_members_update" ON public.expense_group_members
  FOR UPDATE USING (
    public.is_group_creator(auth.uid(), group_id)
  );

CREATE POLICY "group_members_delete" ON public.expense_group_members
  FOR DELETE USING (
    user_id = auth.uid() OR
    public.is_group_creator(auth.uid(), group_id)
  );

-- =====================================================
-- Verificar que las políticas se aplicaron
-- =====================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies 
WHERE tablename IN ('expense_groups', 'expense_group_members')
ORDER BY tablename, policyname;

-- =====================================================
-- Mensaje de éxito
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Políticas RLS corregidas con funciones SECURITY DEFINER';
END $$;
