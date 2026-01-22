-- =====================================================
-- FIX: Corregir montos de gastos en cuotas
-- =====================================================
-- Este script identifica y corrige gastos con cuotas donde
-- el monto guardado es el total en vez del monto por cuota.
--
-- PROBLEMA: Gastos viejos se guardaron con amount = total
-- SOLUCIÓN: Dividir amount entre installments para las cuotas
-- =====================================================

-- Primero, veamos los gastos afectados (solo diagnóstico)
SELECT 
  id,
  description,
  amount as monto_actual,
  installments,
  current_installment,
  (amount / NULLIF(installments, 0)) as monto_por_cuota,
  date,
  parent_expense_id
FROM expenses
WHERE installments > 1
ORDER BY date DESC;

-- =====================================================
-- PASO 1: Corregir gastos PADRE (primera cuota sin parent_expense_id)
-- Estos son los gastos originales donde amount = total
-- =====================================================

-- Vista previa de qué se va a corregir
SELECT 
  id,
  description,
  amount as monto_total_guardado,
  installments,
  ROUND(amount / installments, 2) as nuevo_monto_cuota
FROM expenses
WHERE installments > 1 
  AND current_installment = 1 
  AND parent_expense_id IS NULL
  AND amount > (
    -- Si existe una cuota hija con el mismo monto, el padre ya está corregido
    SELECT COALESCE(MIN(e2.amount), 0)
    FROM expenses e2 
    WHERE e2.parent_expense_id = expenses.id
    LIMIT 1
  ) * 1.1; -- Margen del 10% para evitar falsos positivos

-- Ejecutar la corrección de gastos padre
/*
UPDATE expenses
SET amount = ROUND(amount / installments, 2)
WHERE installments > 1 
  AND current_installment = 1 
  AND parent_expense_id IS NULL
  AND id IN (
    -- Solo corregir si no hay cuotas hijas (gastos muy viejos)
    -- o si el monto es muy diferente a las cuotas hijas
    SELECT e1.id
    FROM expenses e1
    WHERE e1.installments > 1 
      AND e1.current_installment = 1 
      AND e1.parent_expense_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM expenses e2 
        WHERE e2.parent_expense_id = e1.id 
          AND ABS(e2.amount - (e1.amount / e1.installments)) < 1
      )
  );
*/

-- =====================================================
-- PASO 2: Verificar cuotas hijas
-- Las cuotas hijas creadas con createInstallments deberían
-- tener el monto correcto, pero verificamos por si acaso
-- =====================================================

-- Vista previa de cuotas hijas que podrían estar mal
SELECT 
  child.id,
  child.description,
  child.amount as monto_hijo,
  child.installments,
  child.current_installment,
  parent.amount as monto_padre,
  parent.description as desc_padre
FROM expenses child
JOIN expenses parent ON child.parent_expense_id = parent.id
WHERE child.amount != parent.amount
  AND child.installments > 1;

-- =====================================================
-- OPCIÓN ALTERNATIVA: Recalcular todo desde cero
-- =====================================================
-- Si prefieres un enfoque más agresivo, puedes recalcular
-- todos los montos de cuotas dividiendo por installments

/*
-- CUIDADO: Esto modificará TODOS los gastos con cuotas
UPDATE expenses
SET amount = ROUND(
  (SELECT COALESCE(
    (SELECT e2.amount FROM expenses e2 
     WHERE e2.id = expenses.parent_expense_id),
    expenses.amount
  )) / installments, 
  2
)
WHERE installments > 1;
*/

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================
-- Después de ejecutar las correcciones, verifica con:

SELECT 
  description,
  amount,
  installments,
  current_installment,
  CASE 
    WHEN installments > 1 THEN 
      CASE WHEN current_installment = 1 AND parent_expense_id IS NULL 
        THEN 'PADRE' 
        ELSE 'HIJO' 
      END
    ELSE 'NORMAL'
  END as tipo,
  date
FROM expenses
WHERE installments > 1
ORDER BY date DESC, parent_expense_id NULLS FIRST;
