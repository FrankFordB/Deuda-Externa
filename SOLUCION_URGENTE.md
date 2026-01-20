# 🚨 SOLUCIÓN URGENTE - No se guardan datos

## ❌ Problema Identificado

**Supabase NO está guardando datos porque las tablas críticas NO EXISTEN en tu base de datos.**

## ✅ Solución en 3 Pasos

### PASO 1: Diagnóstico
1. Ve a [https://supabase.com](https://supabase.com)
2. Abre tu proyecto → **SQL Editor**
3. Copia y pega TODO el contenido de: `supabase/DIAGNOSTICO_TABLAS.sql`
4. Haz clic en **RUN**
5. Revisa los resultados:
   - ¿Qué tablas existen?
   - ¿Qué tablas faltan?
   - ¿Cuántos registros tienes?

### PASO 2: Ejecutar Migraciones (EN ORDEN)

**Debes ejecutar estos 4 archivos SQL EN ESTE ORDEN:**

#### 1️⃣ Primera Migración
- Archivo: `supabase/migrations/add_monthly_income_and_virtual_friends.sql`
- Crea: `monthly_incomes`, `virtual_friends`
- **Por qué**: Sin esto NO se guarda el sueldo mensual

#### 2️⃣ Segunda Migración
- Archivo: `supabase/migrations/fix_storage_and_payment_methods.sql`
- Crea: `payment_methods`, storage para avatares
- **Por qué**: Sin esto NO funcionan los métodos de pago

#### 3️⃣ Tercera Migración
- Archivo: `supabase/migrations/insert_payment_methods_existing_users.sql`
- Inserta: Métodos de pago predeterminados
- **Por qué**: Añade "Efectivo" y "Tarjeta" automáticamente

#### 4️⃣ Cuarta Migración
- Archivo: `supabase/migrations/add_change_requests_system.sql`
- Crea: `change_requests`
- **Por qué**: Sistema de aprobación de cambios

**Cómo ejecutar cada migración:**
1. Abre el archivo en VS Code
2. Copia TODO el contenido (Ctrl+A, Ctrl+C)
3. Ve a Supabase → SQL Editor
4. Pega el código
5. Haz clic en **RUN**
6. Verifica que diga "Success" sin errores
7. Pasa a la siguiente migración

### PASO 3: Verificación Final

Después de ejecutar las 4 migraciones, ejecuta de nuevo `DIAGNOSTICO_TABLAS.sql` para confirmar que TODO está creado.

## 🔍 ¿Por qué no funcionaba?

Las migraciones SQL son **archivos de configuración** que están en tu proyecto, pero **NO se ejecutan automáticamente**. Es como tener una receta sin cocinar la comida.

**Antes:**
```
Tu Código (Frontend) → Intenta guardar en Supabase
                     ↓
                  ❌ Error: tabla "monthly_incomes" no existe
```

**Después de ejecutar migraciones:**
```
Tu Código (Frontend) → Intenta guardar en Supabase
                     ↓
                  ✅ Éxito: datos guardados en tabla existente
```

## ⚠️ Datos Anteriores

Si tenías gastos/deudas guardados antes y ya no aparecen:

**Posibles causas:**
1. Estás en un proyecto diferente de Supabase
2. Los datos están ahí pero hay problema de RLS (permisos)
3. Se borraron por resetear la base de datos

**Para verificar:**
```sql
-- Ejecuta esto en SQL Editor
SELECT COUNT(*) as total_gastos FROM public.expenses;
SELECT COUNT(*) as total_deudas FROM public.debts;
SELECT COUNT(*) as total_usuarios FROM public.profiles;
```

Si los contadores están en 0, los datos se perdieron y necesitas crearlos de nuevo.

## 🎯 Próximos Pasos

1. ✅ Ejecuta `DIAGNOSTICO_TABLAS.sql` para ver qué falta
2. ✅ Ejecuta las 4 migraciones EN ORDEN
3. ✅ Recarga la aplicación (Ctrl+F5)
4. ✅ Prueba guardar un gasto o sueldo
5. ✅ Verifica que se guarde correctamente

## 📞 Si sigue sin funcionar

Después de ejecutar las migraciones, si SIGUE sin guardar:
- Abre la consola del navegador (F12)
- Ve a la pestaña **Console**
- Busca errores en rojo
- Compárteme el error exacto que aparece
