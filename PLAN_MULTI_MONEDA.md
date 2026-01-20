# 🌍 Sistema Multi-Moneda - Plan de Implementación

## 📋 Resumen de Requerimientos

El usuario quiere:
1. **Seleccionar moneda al crear gastos/cobros/deudas**
2. **Múltiples "sueldos" con diferentes monedas**
3. **Cálculos separados por moneda** (dólares con dólares, pesos con pesos)
4. **Visualización clara** de totales por moneda

---

## 🎯 Cambios Requeridos

### 1. **Base de Datos - Nuevas Columnas**

#### Tabla `expenses`:
```sql
ALTER TABLE expenses 
ADD COLUMN currency VARCHAR(3) DEFAULT 'ARS',
ADD COLUMN currency_symbol VARCHAR(5) DEFAULT '$';
```

#### Tabla `debts`:
```sql
ALTER TABLE debts 
ADD COLUMN currency VARCHAR(3) DEFAULT 'ARS',
ADD COLUMN currency_symbol VARCHAR(5) DEFAULT '$';
```

#### Tabla `installments`:
```sql
ALTER TABLE installments 
ADD COLUMN currency VARCHAR(3) DEFAULT 'ARS',
ADD COLUMN currency_symbol VARCHAR(5) DEFAULT '$';
```

#### Tabla `profiles` (para ingresos múltiples):
```sql
-- Agregar JSON para múltiples fuentes de ingreso
ALTER TABLE profiles 
ADD COLUMN income_sources JSONB DEFAULT '[]'::jsonb;

-- Estructura del JSON:
-- [
--   { "id": "1", "name": "Sueldo Principal", "amount": 500000, "currency": "ARS", "symbol": "$" },
--   { "id": "2", "name": "Freelance", "amount": 1000, "currency": "USD", "symbol": "US$" }
-- ]
```

---

### 2. **Frontend - Componente de Selección de Moneda**

Crear `src/components/CurrencySelect/CurrencySelect.jsx`:

```jsx
const CURRENCIES = [
  { value: 'ARS', label: 'Peso Argentino', symbol: '$' },
  { value: 'USD', label: 'Dólar', symbol: 'US$' },
  { value: 'EUR', label: 'Euro', symbol: '€' },
  { value: 'BRL', label: 'Real', symbol: 'R$' },
  { value: 'CLP', label: 'Peso Chileno', symbol: 'CLP$' },
  { value: 'COP', label: 'Peso Colombiano', symbol: 'COL$' },
  { value: 'MXN', label: 'Peso Mexicano', symbol: 'MX$' },
  { value: 'UYU', label: 'Peso Uruguayo', symbol: '$U' }
];
```

---

### 3. **Modificar Formularios**

#### Gastos (Expenses):
- Agregar selector de moneda
- Mostrar símbolo correcto al lado del monto
- Validar que el monto sea válido para esa moneda

#### Deudas (Debts):
- Mismo tratamiento
- Ambas partes deben ver la moneda correcta

#### Cuotas (Installments):
- Heredar moneda del gasto/deuda padre
- Mostrar moneda en cada cuota

---

### 4. **Cálculos y Estadísticas**

#### Dashboard:
```javascript
// Antes (una sola moneda):
const totalGastos = 125000;

// Después (múltiples monedas):
const totalesPorMoneda = {
  ARS: { gastos: 125000, cobros: 80000, balance: 45000 },
  USD: { gastos: 500, cobros: 200, balance: 300 }
};
```

#### Componente de Estadísticas:
- Mostrar secciones separadas por moneda
- O pestañas para cambiar entre monedas
- Cards individuales por cada moneda activa

---

### 5. **Ingresos Múltiples (Perfil)**

#### Página de Perfil/Settings:
- Sección "Fuentes de Ingreso"
- Botón "+ Agregar Ingreso"
- Lista editable de ingresos:
  ```
  ┌─────────────────────────────────────┐
  │ 💰 Fuentes de Ingreso              │
  ├─────────────────────────────────────┤
  │ Sueldo Principal                    │
  │ $500,000 ARS             [Editar]   │
  ├─────────────────────────────────────┤
  │ Freelance                           │
  │ US$1,000 USD             [Editar]   │
  ├─────────────────────────────────────┤
  │ [+ Agregar Nueva Fuente]            │
  └─────────────────────────────────────┘
  ```

---

### 6. **Visualización en Listas**

#### Lista de Gastos:
```
Descripción          Monto        Moneda
─────────────────────────────────────────
Supermercado        $50,000       ARS
Laptop             US$1,200       USD
Cena                  R$150        BRL
```

#### Totales por Moneda:
```
📊 Resumen Mensual
──────────────────────
ARS: $125,000
USD: US$1,500
EUR: €200
```

---

## 🔧 Archivos a Modificar

### Base de Datos:
- [ ] `supabase/migrations/add_multi_currency.sql` (CREAR)

### Componentes:
- [ ] `src/components/CurrencySelect/` (CREAR)
- [ ] `src/components/StatCard/StatCard.jsx` (MODIFICAR)
- [ ] `src/components/MonthlyStatsPanel/` (MODIFICAR)

### Páginas:
- [ ] `src/pages/Expenses/Expenses.jsx` (MODIFICAR)
- [ ] `src/pages/Debts/Debts.jsx` (MODIFICAR)
- [ ] `src/pages/Dashboard/Dashboard.jsx` (MODIFICAR)
- [ ] `src/pages/Profile/Profile.jsx` (MODIFICAR)
- [ ] `src/pages/Settings/Settings.jsx` (MODIFICAR)

### Contextos:
- [ ] `src/context/ExpensesContext.jsx` (MODIFICAR)
- [ ] `src/context/DebtsContext.jsx` (MODIFICAR)

### Servicios:
- [ ] `src/services/expensesService.js` (MODIFICAR)
- [ ] `src/services/debtsService.js` (MODIFICAR)

---

## 📊 Ejemplo de Flujo de Usuario

### Crear Gasto en USD:
```
1. Click "Nuevo Gasto"
2. Monto: 1200
3. Moneda: USD 🇺🇸
4. Descripción: "Laptop"
5. Se guarda: amount=1200, currency='USD', symbol='US$'
```

### Ver Dashboard:
```
┌─────────────────────────────┐
│ 💵 USD                      │
│ Gastos: US$1,500            │
│ Ingresos: US$2,000          │
│ Balance: US$500             │
└─────────────────────────────┘

┌─────────────────────────────┐
│ 💰 ARS                      │
│ Gastos: $125,000            │
│ Ingresos: $500,000          │
│ Balance: $375,000           │
└─────────────────────────────┘
```

---

## ⚠️ Consideraciones Importantes

### NO hacer conversión automática de divisas:
- No intentar convertir USD a ARS automáticamente
- Cada moneda se maneja independientemente
- El usuario decide cuándo "transferir" entre monedas

### Validaciones:
- Un gasto en USD no puede pagarse con ingreso en ARS
- Las cuotas heredan la moneda del gasto padre
- Las deudas entre amigos deben acordar la moneda

### Performance:
- Índices en columna `currency` para queries rápidas
- Cache de totales por moneda
- Actualización incremental

---

## 🚀 Orden de Implementación Sugerido

### Fase 1: Base de Datos
1. Script SQL para agregar columnas
2. Migración de datos existentes (default a moneda del perfil)
3. Verificar constraints

### Fase 2: Backend/Servicios
1. Actualizar `expensesService.createExpense()` para recibir `currency`
2. Actualizar queries para filtrar por moneda
3. Crear función `getStatsByCurrency()`

### Fase 3: Componentes Base
1. Crear `CurrencySelect` component
2. Actualizar `StatCard` para mostrar símbolo correcto
3. Crear `MultiCurrencyStats` component

### Fase 4: Formularios
1. Agregar selector de moneda a formulario de gastos
2. Agregar a formulario de deudas
3. Validaciones y feedback visual

### Fase 5: Dashboard y Estadísticas
1. Modificar Dashboard para mostrar por moneda
2. Actualizar gráficos (uno por moneda o pestañas)
3. Totales separados

### Fase 6: Perfil e Ingresos Múltiples
1. UI para gestionar income_sources
2. CRUD de fuentes de ingreso
3. Sincronización con cálculos

---

## 🤔 Preguntas para el Usuario

Antes de implementar, confirmar:

1. **¿Qué monedas quieres soportar?**
   - Lista de las que mostré arriba?
   - Alguna adicional?

2. **¿Conversión de divisas?**
   - NO (recomendado) - cada moneda independiente
   - SÍ - usar API de conversión (más complejo)

3. **¿Ingresos múltiples?**
   - Sí, ejemplo: "$500k ARS + US$1k USD"
   - Cuántos máximo por usuario?

4. **¿Moneda por defecto?**
   - La del país del registro?
   - Seleccionable en settings?

5. **¿Reportes?**
   - Un reporte por moneda?
   - Reporte consolidado (sin conversión)?

---

## ✅ Beneficios del Sistema

- ✅ Manejo real de finanzas multi-moneda
- ✅ Sin confusión de conversiones automáticas
- ✅ Claridad en totales por moneda
- ✅ Útil para freelancers internacionales
- ✅ Útil en países con economías dolarizadas

---

**¿Quieres que empiece a implementar o tienes dudas sobre el sistema?**
