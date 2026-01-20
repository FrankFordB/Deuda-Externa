# 📋 Instrucciones para Configurar el Sistema

## ⚠️ IMPORTANTE: Orden de Ejecución

Debes ejecutar los scripts SQL en el **orden exacto** que se indica a continuación en tu base de datos de Supabase.

---

## 🔢 Orden de Ejecución

### 0️⃣ **PRIMER PASO (CRÍTICO): Reparar Payment Methods**
**Archivo:** `supabase/migrations/fix_payment_methods_constraint.sql`

**Qué hace:**
- Actualiza el constraint de la tabla `payment_methods` para permitir nuevos tipos
- Corrige la función que crea métodos de pago predeterminados
- Previene errores al crear nuevos usuarios

**Cómo ejecutar:**
1. Ve a tu proyecto en Supabase Dashboard
2. Abre el **SQL Editor**
3. Copia y pega el contenido de `fix_payment_methods_constraint.sql`
4. Haz clic en **RUN**
5. Verifica que diga "✅ PAYMENT METHODS REPARADO"

---

### 1️⃣ **SEGUNDO PASO: Reparar Perfiles**
**Archivo:** `supabase/migrations/diagnostico_y_reparacion_perfiles.sql`

**Qué hace:**
- Verifica que todos los usuarios tengan un perfil en la tabla `profiles`
- Crea perfiles faltantes automáticamente
- Repara perfiles incompletos (sin nombre, nickname, etc.)
- Re-crea el trigger para crear perfiles automáticamente en nuevos registros

**Cómo ejecutar:**
1. Ve a tu proyecto en Supabase Dashboard
2. Abre el **SQL Editor**
3. Copia y pega el contenido de `diagnostico_y_reparacion_perfiles.sql`
4. Haz clic en **RUN**
5. Verifica el resultado en los mensajes (debe decir "✅ Todos los usuarios tienen perfil")

⚠️ **IMPORTANTE:** Este script debe ejecutarse PRIMERO para asegurar que tu perfil esté completo.

---

### 2️⃣ **TERCER PASO: Sistema Multi-Moneda**
**Archivo:** `supabase/migrations/add_multi_currency.sql`

**Qué hace:**
- Agrega columnas `currency` y `currency_symbol` a las tablas `expenses`, `debts` e `installments`
- Actualiza datos existentes para usar ARS por defecto
- Modifica las políticas RLS para incluir los nuevos campos

**Cómo ejecutar:**
1. Ve a tu proyecto en Supabase Dashboard
2. Abre el **SQL Editor**
3. Copia y pega el contenido de `add_multi_currency.sql`
4. Haz clic en **RUN**
5. Verifica que no haya errores

---

### 3️⃣ **CUARTO PASO: Sistema de Cuentas Bancarias**
**Archivo:** `supabase/migrations/add_bank_accounts.sql`

**Qué hace:**
- Crea la tabla `bank_accounts` con límite de 4 cuentas por usuario
- Agrega columna `bank_account_id` a las tablas `expenses`, `debts` y `monthly_incomes`
- Crea función `update_account_balance()` para cálculo automático de saldos
- Crea triggers que actualizan el saldo automáticamente cuando:
  - Se paga un gasto
  - Se paga una deuda
  - Se agrega un ingreso mensual

**Cómo ejecutar:**
1. Ve al **SQL Editor** en Supabase
2. Copia y pega el contenido de `add_bank_accounts.sql`
3. Haz clic en **RUN**
4. Verifica que no haya errores

---

## ✅ Verificar que Todo Funcione

Después de ejecutar ambos scripts, verifica la instalación con estas consultas:

### Verificar tabla de cuentas bancarias:
```sql
SELECT * FROM bank_accounts LIMIT 1;
```

### Verificar columnas de moneda:
```sql
SELECT id, description, currency, currency_symbol, amount 
FROM expenses 
LIMIT 5;
```

### Verificar función de balance:
```sql
SELECT proname 
FROM pg_proc 
WHERE proname = 'update_account_balance';
```

### Verificar triggers:
```sql
SELECT tgname 
FROM pg_trigger 
WHERE tgname LIKE '%account%';
```

---

## 🎯 Funcionalidades Disponibles

### **Multi-Moneda (8 monedas):**
- 🇦🇷 Peso Argentino (ARS) - $
- 🇺🇸 Dólar (USD) - US$
- 🇪🇺 Euro (EUR) - €
- 🇧🇷 Real Brasileño (BRL) - R$
- 🇨🇱 Peso Chileno (CLP) - CLP$
- 🇨🇴 Peso Colombiano (COP) - COL$
- 🇲🇽 Peso Mexicano (MXN) - MX$
- 🇺🇾 Peso Uruguayo (UYU) - $U

**Cómo usar:**
- En el Dashboard: Usa las pestañas superiores para filtrar por moneda
- En Gastos/Deudas: Selecciona la moneda al crear un gasto o deuda
- Cada moneda es independiente (sin conversión automática)

---

### **Cuentas Bancarias (máximo 4 por usuario):**

**Características:**
- Cada cuenta tiene su propia moneda
- El saldo se calcula automáticamente: `saldo_inicial + ingresos - gastos_pagados - deudas_pagadas`
- Las cuentas son "inteligentes": agrupan gastos según su moneda

**Cómo usar:**

1. **Crear una cuenta:**
   - En el Dashboard, busca el panel "Mis Cuentas Bancarias"
   - Haz clic en el botón **"+ Nueva Cuenta"**
   - Completa el formulario:
     - Nombre (ej: "Cuenta Sueldo", "Caja de Ahorro USD")
     - Selecciona la moneda
     - Ingresa el balance inicial
   - Máximo 4 cuentas permitidas

2. **Ver detalles de una cuenta:**
   - En el panel de cuentas, haz clic en cualquier cuenta
   - Se abrirá una vista detallada con:
     - Balance actual
     - Filtro por mes y año
     - Lista de gastos asociados
     - Estadísticas mensuales

3. **Asociar gastos a una cuenta:**
   - Al crear un gasto, selecciona la cuenta bancaria en el formulario
   - Solo se mostrarán cuentas que coincidan con la moneda del gasto
   - El balance se actualiza automáticamente cuando marcas el gasto como pagado

4. **Asociar deudas a una cuenta:**
   - Similar a los gastos, selecciona la cuenta al crear una deuda
   - El balance se actualiza cuando la deuda se paga

5. **Configurar ingreso mensual:**
   - Al configurar tu sueldo mensual, selecciona a qué cuenta ingresa
   - El balance se actualiza automáticamente

---

## 🔍 Diagnóstico de Problemas

### Si ves errores de "column does not exist":
- Verifica que ejecutaste `add_multi_currency.sql` PRIMERO
- Ejecuta este query para verificar las columnas:
  ```sql
  SELECT column_name 
  FROM information_schema.columns 
  WHERE table_name = 'expenses' 
    AND column_name IN ('currency', 'currency_symbol', 'bank_account_id');
  ```

### Si no puedes crear cuentas:
- Verifica que ejecutaste `add_bank_accounts.sql`
- Verifica que no tengas 4 cuentas ya creadas:
  ```sql
  SELECT COUNT(*) as total_cuentas 
  FROM bank_accounts 
  WHERE user_id = auth.uid() AND is_active = true;
  ```

### Si el balance no se actualiza:
- Verifica que los triggers existan:
  ```sql
  SELECT tgname, tgrelid::regclass 
  FROM pg_trigger 
  WHERE tgname IN ('on_expense_paid', 'on_debt_paid', 'on_income_added');
  ```

- Si faltan, re-ejecuta `add_bank_accounts.sql`

---

## 📞 Soporte

Si encuentras algún problema:
1. Revisa los logs de Supabase en la sección "Logs" > "Database"
2. Verifica que ambos scripts se ejecutaron sin errores
3. Ejecuta las queries de verificación de arriba

---

## 🎉 ¡Listo!

Una vez ejecutados ambos scripts:
- ✅ Sistema multi-moneda funcionando
- ✅ Filtrado por moneda en Dashboard
- ✅ Cuentas bancarias disponibles
- ✅ Balance automático
- ✅ Panel de cuentas en Dashboard
- ✅ Vista detallada de cada cuenta

**¡Disfruta tu nuevo sistema de gestión financiera!** 💰
