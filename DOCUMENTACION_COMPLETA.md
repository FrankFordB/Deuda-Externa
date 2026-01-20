# Sistema de Gestión Financiera - Documentación Completa

## 📊 Arquitectura y Persistencia

### Principio Fundamental
**TODOS los datos se guardan en la base de datos.** No hay estados temporales. Cada operación (crear, editar, pagar, cobrar) se refleja inmediatamente en Supabase.

## 🗄️ Modelo de Datos

### Tablas Principales

#### 1. **profiles** - Usuarios
```sql
- id (UUID)
- email, nickname
- first_name, last_name
- country, birth_date
- is_superadmin, is_active
```

#### 2. **monthly_incomes** - Sueldos Mensuales
```sql
- id (UUID)
- user_id (FK → profiles)
- year, month
- amount (DECIMAL)
- notes
- UNIQUE(user_id, year, month)
```
**Permite:** Configurar diferentes sueldos para cada mes/año

#### 3. **payment_methods** - Métodos de Pago
```sql
- id (UUID)
- user_id (FK → profiles)
- name (Ej: "Banco Santander", "Mercado Pago")
- type (bank, cash, card, digital_wallet, other)
- icon, color
- is_active
```
**Métodos predefinidos:**
- Efectivo 💵
- Banco Santander 🏦
- Banco BBVA 🏦
- Mercado Pago 📱
- Tarjeta de Crédito 💳
- Tarjeta de Débito 💳

El usuario puede agregar más desde la UI sin recargar.

#### 4. **expenses** - Gastos
```sql
- id (UUID)
- user_id (FK → profiles)
- description, amount
- category, payment_source
- payment_method_id (FK → payment_methods)
- date
- is_paid, paid_at
- debt_id (FK → debts) - Si viene de una deuda aceptada
- parent_expense_id (FK → expenses) - Para cuotas
```

#### 5. **debts** - Deudas entre Amigos
```sql
- id (UUID)
- creditor_id (FK → profiles) - Quien prestó
- debtor_id (FK → profiles) - Quien debe
- virtual_friend_id (FK → virtual_friends) - Si es amigo virtual
- debtor_type ('real' | 'virtual')
- amount, amount_paid, amount_remaining
- description, category
- status ('pending', 'accepted', 'rejected', 'paid')
- purchase_date, due_date
- installments, installment_amount
- accepted_at, rejected_at, paid_at
```

**Cálculo automático:**
```sql
amount_remaining = amount - amount_paid
```

#### 6. **debt_payments** - Pagos Parciales
```sql
- id (UUID)
- debt_id (FK → debts)
- amount (DECIMAL)
- payment_method_id (FK → payment_methods)
- payment_date
- notes
```

**Trigger automático:** Cada pago actualiza `amount_paid` en la deuda

#### 7. **virtual_friends** - Amigos No Usuarios
```sql
- id (UUID)
- user_id (FK → profiles)
- name, email, phone
```

#### 8. **debt_installments** - Cuotas de Deudas
```sql
- id (UUID)
- debt_id (FK → debts)
- installment_number
- amount, due_date
- paid, paid_at
```

## 🎯 Funcionalidades Implementadas

### 1. Sueldos Mensuales Configurables

**Archivos:**
- `src/services/monthlyIncomeService.js`
- `src/pages/Dashboard/Dashboard.jsx`

**Funciones:**
```javascript
// Obtener sueldo de un mes
getMonthlyIncome(userId, year, month)

// Guardar/actualizar sueldo
setMonthlyIncome(userId, year, month, amount, notes)

// Obtener todos los sueldos de un año
getYearlyIncomes(userId, year)
```

**UI:**
- Selector de mes/año en Dashboard
- Modal para configurar sueldo del mes seleccionado
- Cálculo automático: `sueldo - gastos - deudas = restante`
- Indicador visual: ✅ Te alcanza / ⚠️ No te alcanza

### 2. Métodos de Pago Dinámicos

**Archivos:**
- `src/services/paymentMethodsService.js`
- `src/components/PaymentMethodSelect/`

**Componente `<PaymentMethodSelect>`:**
```jsx
<PaymentMethodSelect
  value={paymentMethodId}
  onChange={(e) => setPaymentMethodId(e.target.value)}
  label="Método de Pago"
  required
/>
```

**Características:**
- Select con todos los métodos del usuario
- Botón "+" para agregar nuevos
- Modal con formulario (nombre, tipo, ícono, color)
- Selección automática del método recién creado
- Persistencia inmediata en BD

### 3. Pagos Parciales de Deudas

**Archivos:**
- `src/services/debtPaymentsService.js`

**Funciones:**
```javascript
// Registrar pago parcial
registerDebtPayment(debtId, {
  amount,
  paymentMethodId,
  date,
  notes
})

// Ver historial de pagos
getDebtPayments(debtId)

// Obtener deuda con todos sus pagos
getDebtWithPayments(debtId)
```

**Flujo:**
1. Usuario registra pago parcial
2. Trigger actualiza `amount_paid` en la deuda
3. Trigger recalcula `amount_remaining`
4. Si `amount_remaining = 0` → status = 'paid'

### 4. Validación de Deudas

**Regla implementada en `debtsService.js`:**

```javascript
// ❌ NO permitido: Marcar deuda con persona real como pagada
if (debt.debtor_type === 'real') {
  return error('Solicita confirmación de pago al acreedor')
}

// ✅ Permitido: Marcar deuda con amigo virtual como pagada
if (debt.debtor_type === 'virtual') {
  markAsPaid(debtId)
}
```

### 5. Dashboard Unificado

**Secciones del Dashboard:**

#### A. Header con Selectores
```
[Mes ▼] [Año ▼] [➕ Nuevo Gasto]
```

#### B. Sueldo del Mes
- Sueldo configurado
- Gastos del mes: -$X
- Deudas que debo: -$Y
- **Restante: $Z** (verde si alcanza, rojo si no)
- Botón: Configurar/Editar

#### C. Métricas Principales
- 💰 Ingresos Mensuales
- 💸 Total Gastado
- 📊 Balance
- 📋 Gastos Pendientes

#### D. Resumen de Deudas
- **Me deben:** +$X (verde)
- **Yo debo:** -$Y (rojo)
- **Balance neto:** $Z

#### E. Gráficos
- Gastos por categoría (PieChart)
- Gastos por fuente de pago (BarChart)

## 📝 Uso en Código

### Ejemplo: Crear Gasto con Método de Pago

```jsx
import { PaymentMethodSelect } from './components';
import { expensesService } from './services';

function NuevoGastoForm() {
  const [paymentMethodId, setPaymentMethodId] = useState('');
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const result = await expensesService.createExpense({
      userId: user.id,
      description,
      amount,
      category,
      payment_method_id: paymentMethodId, // 👈 ID del método
      date,
      is_paid: true
    });
    
    // Se guarda en BD inmediatamente
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <Input label="Descripción" />
      <Input label="Monto" type="number" />
      <PaymentMethodSelect 
        value={paymentMethodId}
        onChange={(e) => setPaymentMethodId(e.target.value)}
        required
      />
      <Button type="submit">Guardar</Button>
    </form>
  );
}
```

### Ejemplo: Pago Parcial de Deuda

```jsx
import { debtPaymentsService } from './services';

async function pagarDeudaParcial(debtId) {
  const result = await debtPaymentsService.registerDebtPayment(debtId, {
    amount: 5000,
    paymentMethodId: 'uuid-del-metodo',
    date: '2026-01-15',
    notes: 'Pago parcial #1'
  });
  
  // Trigger automático actualiza la deuda
  // amount_paid += 5000
  // amount_remaining -= 5000
}
```

## 🔄 Flujos Completos

### Flujo 1: Configurar Sueldo y Ver Balance

1. Usuario selecciona **Enero 2026**
2. Hace clic en "Configurar Sueldo"
3. Ingresa $100,000
4. Se guarda en `monthly_incomes`
5. Dashboard calcula automáticamente:
   - Gastos de enero: $45,000
   - Deudas que debo: $20,000
   - **Restante: $35,000** ✅ Te alcanza

### Flujo 2: Registrar Gasto con Nuevo Método

1. Usuario crea nuevo gasto
2. En "Método de Pago", hace clic en "+"
3. Llena modal: "Banco Galicia", tipo: "Banco", 🏦, color azul
4. Hace clic en "Agregar"
5. Se crea en `payment_methods`
6. Se selecciona automáticamente
7. Guarda el gasto
8. Se crea en `expenses` con `payment_method_id`

### Flujo 3: Pagar Deuda en Cuotas

1. Usuario tiene deuda de $10,000
2. Paga $3,000 con "Mercado Pago"
3. Se crea registro en `debt_payments`
4. Trigger actualiza deuda:
   - `amount_paid` = $3,000
   - `amount_remaining` = $7,000
5. Paga $4,000 más
6. Trigger actualiza:
   - `amount_paid` = $7,000
   - `amount_remaining` = $3,000
7. Paga $3,000 final
8. Trigger actualiza:
   - `amount_paid` = $10,000
   - `amount_remaining` = $0
   - `status` = 'paid'

## 🚀 Migraciones SQL

### Archivo 1: `add_monthly_income_and_virtual_friends.sql`
- Tabla `monthly_incomes`
- Tabla `virtual_friends`
- Tabla `debt_installments`
- Actualiza `debts` con nuevas columnas
- RLS y políticas

### Archivo 2: `fix_storage_and_payment_methods.sql`
- Bucket `avatars` con RLS
- Tabla `payment_methods`
- Tabla `debt_payments`
- Triggers automáticos para `amount_paid`
- Métodos predefinidos insertados

## ✅ Checklist de Implementación

- [x] Sueldos mensuales configurables por mes/año
- [x] Métodos de pago dinámicos con UI
- [x] Pagos parciales de deudas
- [x] Validación de deudas según tipo de amigo
- [x] Dashboard unificado con selectores de mes/año
- [x] Cálculo automático de saldo restante
- [x] Persistencia total en BD (no estados temporales)
- [x] RLS configurado correctamente
- [x] Triggers para cálculos automáticos
- [x] Código modular y escalable

## 📖 Próximos Pasos Sugeridos

1. **Proyecciones futuras:** Calcular gastos estimados para próximos meses
2. **Alertas:** Notificaciones cuando el sueldo no alcance
3. **Estadísticas avanzadas:** Comparación mes a mes, año a año
4. **Exportar datos:** PDF o Excel con resúmenes
5. **Metas de ahorro:** Definir objetivos y trackearlos
6. **Categorías personalizadas:** Permitir crear categorías de gastos
7. **Presupuestos:** Límites por categoría con alertas

## 🛠️ Arquitectura de Código

```
src/
├── services/
│   ├── monthlyIncomeService.js      ✅ CRUD de sueldos
│   ├── paymentMethodsService.js     ✅ CRUD de métodos de pago
│   ├── debtPaymentsService.js       ✅ Pagos parciales
│   ├── expensesService.js           ✅ Gastos
│   └── debtsService.js              ✅ Deudas con validación
├── components/
│   └── PaymentMethodSelect/         ✅ Select + agregar nuevo
├── pages/
│   └── Dashboard/                   ✅ Selectores mes/año + métricas
└── context/
    ├── ExpensesContext.jsx          ✅ Manejo global de gastos
    └── DebtsContext.jsx             ✅ Manejo global de deudas
```

**Principios aplicados:**
- Separación de responsabilidades
- Servicios reutilizables
- Componentes modulares
- Contextos para estado global
- Todo conectado a Supabase

---

**Última actualización:** 16 de Enero, 2026
**Estado:** Listo para producción ✅
