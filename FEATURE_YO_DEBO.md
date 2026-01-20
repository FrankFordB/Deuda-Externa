# ✅ Nueva Funcionalidad: Yo Debo Dinero

## 🎯 Problema Resuelto

**Antes:**
- Solo se podían crear deudas donde TÚ eres el acreedor (te deben dinero)
- No había forma de registrar que TÚ le debes dinero a alguien

**Ahora:**
- ✅ Puedes crear deudas donde TÚ eres el deudor (le debes a alguien)
- ✅ Puedes vincular esas deudas con cuentas bancarias
- ✅ Las deudas aparecen correctamente en "Yo Debo"
- ✅ El amigo puede aceptar la deuda
- ✅ Se vincula con las estadísticas de bancos

---

## 🔧 Cambios Implementados

### 1. **Frontend - Formulario de Deudas**

**Archivo:** `src/pages/Debts/Debts.jsx`

**Nuevo selector de dirección:**
```jsx
Tipo de deuda:
○ 💰 Me deben (alguien me debe dinero)
○ 💸 Yo debo (le debo dinero a alguien)
```

**Cambios en formData:**
```javascript
{
  debtDirection: 'i_owe', // 'i_owe' | 'owed_to_me'
  friendId: '', // ID del amigo
  friendType: 'real', // 'real' | 'virtual'
  amount: '',
  description: '',
  bank_account_id: '', // NUEVO: para vincular con banco
  // ... otros campos
}
```

**Campo de cuenta bancaria (solo si "yo debo"):**
- Muestra solo cuentas de la misma moneda que la deuda
- Opcional
- Se vincula automáticamente con el banco

### 2. **Backend - Servicio de Deudas**

**Archivo:** `src/services/debtsService.js`

**Función `createDebt()` actualizada:**
```javascript
// Ahora soporta:
- direction: 'i_owe' | 'owed_to_me'
- bank_account_id: UUID (opcional)

// Lógica:
if (direction === 'i_owe') {
  creditor_id = friendId    // El amigo es el acreedor
  debtor_id = userId        // Yo soy el deudor
} else {
  creditor_id = userId      // Yo soy el acreedor
  debtor_id = friendId      // El amigo es el deudor
}
```

---

## 📋 Flujo de Uso

### Escenario 1: YO DEBO dinero

```
1. Usuario hace clic en "Nueva Deuda"
2. Selecciona "💸 Yo debo"
3. Selecciona al amigo acreedor
4. Ingresa monto (ej: $5,000 ARS)
5. Selecciona cuenta bancaria (opcional)
6. Descripción: "Préstamo para emergencia"
7. Hace clic en "Crear"

Resultado:
✅ Se crea la deuda con:
   - creditor_id = amigo
   - debtor_id = yo
   - status = 'pending'
   - bank_account_id = cuenta seleccionada
   
✅ El amigo recibe notificación para aceptar
✅ Aparece en mi sección "Yo Debo"
✅ Si tiene cuenta bancaria, se resta del balance (cuando se acepta)
```

### Escenario 2: ME DEBEN dinero (anterior funcionalidad)

```
1. Usuario hace clic en "Nueva Deuda"
2. Selecciona "💰 Me deben" (default)
3. Selecciona al amigo deudor
4. Ingresa monto
5. Descripción
6. Hace clic en "Crear"

Resultado:
✅ Se crea la deuda con:
   - creditor_id = yo
   - debtor_id = amigo
   - status = 'pending'
   
✅ El amigo recibe notificación para aceptar
✅ Aparece en sección "Me Deben"
```

---

## 🏦 Vinculación con Cuentas Bancarias

### Cómo funciona:

1. **Al crear deuda "yo debo":**
   - Puedes seleccionar una cuenta bancaria
   - Solo aparecen cuentas de la misma moneda
   - Campo opcional

2. **Cuando el amigo acepta:**
   - Si tiene cuenta bancaria vinculada:
     - Se crea el gasto automáticamente
     - Se resta del balance de la cuenta
     - El trigger SQL actualiza el balance
   - Si NO tiene cuenta:
     - Solo se registra la deuda
     - No afecta cuentas bancarias

3. **En estadísticas:**
   - Las deudas con cuenta aparecen en stats del banco
   - Se suman a los gastos totales
   - Se muestran en detalles de la cuenta

---

## 📊 Estados de la Deuda

| Estado | Descripción | Aparece en |
|--------|-------------|------------|
| `pending` | Esperando aceptación del amigo | "Pendientes" del receptor |
| `accepted` | Aceptada, debe pagarse | "Yo Debo" o "Me Deben" |
| `paid` | Pagada completamente | Historial |
| `rejected` | Rechazada por el amigo | Eliminada |

---

## 🧪 Casos de Prueba

### Caso 1: Crear deuda que yo debo con cuenta bancaria

```
Datos:
- Dirección: "Yo debo"
- Amigo: Juan Pérez
- Monto: $10,000 ARS
- Cuenta: Cuenta Sueldo ARS ($50,000)
- Descripción: "Préstamo personal"

Resultado esperado:
✅ Deuda creada (status: pending)
✅ Notificación enviada a Juan
✅ Aparece en "Yo Debo" - Pendientes
✅ Cuando Juan acepta:
   - Cuenta Sueldo: $40,000 ARS (restó $10,000)
   - Deuda pasa a "accepted"
   - Aparece en stats del banco
```

### Caso 2: Crear deuda que yo debo sin cuenta

```
Datos:
- Dirección: "Yo debo"
- Amigo: María García  
- Monto: $50 USD
- Cuenta: -- Sin cuenta --
- Descripción: "Cena compartida"

Resultado esperado:
✅ Deuda creada (status: pending)
✅ Notificación enviada a María
✅ NO afecta ninguna cuenta bancaria
✅ Solo se registra la deuda
```

### Caso 3: Crear deuda que me deben (anterior)

```
Datos:
- Dirección: "Me deben"
- Amigo: Pedro López
- Monto: $20,000 ARS
- Descripción: "Adelanto de sueldo"

Resultado esperado:
✅ Deuda creada (status: pending)
✅ Notificación enviada a Pedro
✅ Aparece en "Me Deben"
✅ NO aparece en cuentas bancarias (yo soy acreedor)
```

---

## 🔄 Integración con Sistema Existente

### 1. Context (DebtsContext.jsx)
- ✅ Ya soporta ambas direcciones
- ✅ `debtsAsCreditor`: Me deben
- ✅ `debtsAsDebtor`: Yo debo
- ✅ Filtros por moneda funcionan
- ✅ `refreshDebts()` actualiza todo

### 2. Notificaciones
- ✅ Se envían al amigo cuando creas la deuda
- ✅ El amigo puede aceptar/rechazar
- ✅ Funciona igual para ambas direcciones

### 3. Cuotas
- ✅ Soportadas en ambas direcciones
- ✅ Se crean automáticamente
- ✅ Se pueden marcar como pagadas

### 4. Triggers SQL
- ✅ El trigger `update_account_balance()` ya funciona
- ✅ Filtra por moneda correctamente
- ✅ Actualiza balance en tiempo real

---

## 📱 UI Actualizada

**Formulario de nueva deuda:**
```
┌─────────────────────────────────────┐
│ Nueva Deuda                         │
├─────────────────────────────────────┤
│                                     │
│ Tipo de deuda:                      │
│ ○ 💰 Me deben                       │
│ ● 💸 Yo debo                        │
│                                     │
│ ¿A quién le debes?                  │
│ [Juan Pérez ▼]                      │
│                                     │
│ Monto:                              │
│ [$10,000]                           │
│                                     │
│ Moneda:                             │
│ [ARS - Peso Argentino ▼]            │
│                                     │
│ Cuenta Bancaria (opcional):         │
│ [$ Cuenta Sueldo ($50,000) ▼]      │
│                                     │
│ Descripción:                        │
│ [Préstamo personal]                 │
│                                     │
│ Número de cuotas:                   │
│ [1] [3] [6] [12]                   │
│                                     │
│         [Cancelar] [Crear]          │
└─────────────────────────────────────┘
```

---

## ⚠️ Importante

### Lo que hace automáticamente:

✅ **Cuando creas "yo debo" con cuenta:**
- Se vincula a la cuenta bancaria
- Cuando se acepta, se crea el gasto
- El balance se actualiza automáticamente
- Aparece en estadísticas del banco

✅ **Cuando creas "yo debo" sin cuenta:**
- Solo se registra la deuda
- NO afecta cuentas bancarias
- Aparece en "Yo Debo"

✅ **Cuando creas "me deben":**
- El amigo debe aceptar
- NO afecta TUS cuentas bancarias
- Solo se registra que te deben

### Validaciones:

- ✅ Solo cuentas de la misma moneda que la deuda
- ✅ Amigo es obligatorio
- ✅ Monto debe ser mayor a 0
- ✅ Descripción obligatoria
- ✅ Cuotas deben ser 1 o más

---

## 🎯 Resumen

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| Crear "yo debo" | ❌ No | ✅ Sí |
| Vincular con banco | ❌ No | ✅ Sí |
| Aceptación del amigo | ✅ Sí | ✅ Sí |
| Estadísticas banco | ❌ Parcial | ✅ Completo |
| Multi-moneda | ✅ Sí | ✅ Sí |
| Cuotas | ✅ Sí | ✅ Sí |
| Amigos virtuales | ✅ Sí | ✅ Sí |

**¡Ahora puedes gestionar TODAS tus deudas en un solo lugar!** 💰💸
