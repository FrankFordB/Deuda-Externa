# 🚀 CHECKLIST - Sistema Multi-Moneda

## ❗ ANTES DE USAR - DEBES EJECUTAR ESTOS SCRIPTS EN SUPABASE

### 1️⃣ Arreglar Perfiles (Si tienes errores de perfil)
📄 Archivo: `supabase/fix_missing_profiles.sql`

**¿Cuándo ejecutar?** Si ves este error:
```
Error: insert or update on table "monthly_incomes" violates foreign key constraint
```

**Cómo ejecutar:**
1. Ve a Supabase Dashboard → SQL Editor
2. Abre `fix_missing_profiles.sql`
3. Copia TODO el contenido
4. Pégalo en SQL Editor
5. Haz clic en **Run** o presiona `Ctrl + Enter`

✅ **Resultado esperado:** Mensaje "TODOS LOS USUARIOS TIENEN PERFIL"

---

### 2️⃣ Activar Sistema Multi-Moneda (OBLIGATORIO)
📄 Archivo: `supabase/migrations/add_multi_currency.sql`

**¿Cuándo ejecutar?** SIEMPRE, antes de usar el sistema multi-moneda

**Cómo ejecutar:**
1. Ve a Supabase Dashboard → SQL Editor
2. Abre `add_multi_currency.sql`
3. Copia TODO el contenido
4. Pégalo en SQL Editor
5. Haz clic en **Run** o presiona `Ctrl + Enter`

✅ **Resultado esperado:** 
```
✅ SISTEMA MULTI-MONEDA INSTALADO
Columnas agregadas a:
  ✓ expenses (currency, currency_symbol)
  ✓ debts (currency, currency_symbol)
  ✓ installments (currency, currency_symbol)
  ✓ profiles (income_sources JSONB)
```

---

## 🎯 DESPUÉS DE EJECUTAR LOS SCRIPTS

### Verifica que funciona:

#### 1. Dashboard - Filtros de Moneda
- [ ] Ves botones como `[💰 ARS] [💵 USD] [💶 EUR]` debajo del header
- [ ] Al hacer clic en un botón, las estadísticas cambian
- [ ] Los símbolos se muestran correctamente (US$100 vs $100)

#### 2. Crear Gasto con Moneda
- [ ] Gastos → **+ Nuevo Gasto**
- [ ] Ves un selector de **Moneda** con 8 opciones:
  - 🇦🇷 Peso Argentino (ARS)
  - 🇺🇸 Dólar (USD)
  - 🇪🇺 Euro (EUR)
  - 🇧🇷 Real (BRL)
  - 🇨🇱 Peso Chileno (CLP)
  - 🇨🇴 Peso Colombiano (COP)
  - 🇲🇽 Peso Mexicano (MXN)
  - 🇺🇾 Peso Uruguayo (UYU)
- [ ] Al seleccionar USD, el símbolo muestra **US$**
- [ ] Guardas el gasto y aparece en la lista con el símbolo correcto

#### 3. Crear Deuda con Moneda
- [ ] Deudas → **+ Nueva Deuda**
- [ ] Ves el selector de Moneda
- [ ] Puedes crear una deuda en USD
- [ ] La deuda se muestra con **US$** en la lista

#### 4. Filtrado en Dashboard
**Prueba:**
1. Crea 2 gastos: uno de $10,000 ARS y otro de US$100 USD
2. Ve al Dashboard
3. Haz clic en el botón **ARS** → Solo ves $10,000
4. Haz clic en el botón **USD** → Solo ves US$100

---

## 🔴 Si NO VES los cambios:

### Opción A: No ejecutaste los scripts SQL
**Síntoma:** No hay errores pero no ves los botones de moneda
**Solución:** Ejecuta `add_multi_currency.sql` en Supabase

### Opción B: Hay errores en consola
**Cómo verificar:**
1. Presiona `F12` en el navegador
2. Ve a la pestaña **Console**
3. Busca errores en rojo

**Errores comunes:**
- `column "currency" does not exist` → No ejecutaste `add_multi_currency.sql`
- `foreign key constraint` → Ejecuta `fix_missing_profiles.sql`

### Opción C: El frontend está en caché
**Solución:**
1. Presiona `Ctrl + Shift + R` para recargar sin caché
2. O cierra y abre el navegador

### Opción D: El servidor no se reinició
**Solución:**
1. Detén el servidor (`Ctrl + C` en la terminal)
2. Ejecuta `npm run dev` nuevamente
3. Recarga la página

---

## 📋 CHECKLIST FINAL

Antes de reportar que "no funciona", verifica:

- [ ] ✅ Ejecuté `add_multi_currency.sql` en Supabase
- [ ] ✅ Vi el mensaje "SISTEMA MULTI-MONEDA INSTALADO"
- [ ] ✅ Recargué la página con `Ctrl + Shift + R`
- [ ] ✅ No hay errores en consola (F12)
- [ ] ✅ El servidor está corriendo (`npm run dev`)

---

## 🆘 AYUDA RÁPIDA

**¿Dónde está Supabase SQL Editor?**
1. Ve a https://supabase.com
2. Inicia sesión
3. Selecciona tu proyecto
4. En el menú lateral izquierdo → **SQL Editor**
5. Pega el script y haz clic en **Run**

**¿Cómo saber si funcionó?**
Después de ejecutar el script, ejecuta esta query:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'expenses' 
AND column_name IN ('currency', 'currency_symbol');
```

Deberías ver:
```
currency       | character varying
currency_symbol | character varying
```

---

## 📸 SCREENSHOTS DE REFERENCIA

**Dashboard con botones de moneda:**
```
┌────────────────────────────────────────┐
│  💰 Bienvenido, Franco                 │
│  [💰 ARS] [💵 USD] [💶 EUR] [💵 BRL]  │  ← AQUÍ
│                                        │
│  Sueldo de Enero: $500,000            │
│  Gastos: $50,000                      │
└────────────────────────────────────────┘
```

**Formulario de gasto con selector de moneda:**
```
┌────────────────────────────┐
│  Nuevo Gasto              │
├────────────────────────────┤
│  Descripción: [________]   │
│  Monto: [________]         │
│  Moneda: [🇦🇷 Peso Arg ▼] │  ← AQUÍ
│  Categoría: [________]     │
│                           │
│  [Guardar] [Cancelar]     │
└────────────────────────────┘
```

---

## 🎯 RESUMEN

**TODO lo que necesitas hacer:**

1. ✅ Ejecutar `add_multi_currency.sql` en Supabase SQL Editor
2. ✅ Recargar la página (`Ctrl + Shift + R`)
3. ✅ Ver los botones de moneda en Dashboard
4. ✅ Crear un gasto con USD
5. ✅ Filtrar en Dashboard por USD

**Si después de esto NO funciona**, abre la consola (F12) y compárteme el error exacto que aparece.
