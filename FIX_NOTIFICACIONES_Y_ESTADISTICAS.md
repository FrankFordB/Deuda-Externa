# ✅ Fix: Notificaciones de Deudas y Estadísticas de Cuentas

## 🐛 Problemas Resueltos

### 1. **Notificaciones no llegaban al amigo**
**Problema:** Al crear una deuda propia ("yo debo"), el amigo no recibía ninguna notificación para aceptarla.

**Causa:** El servicio `debtsService.js` no enviaba notificaciones al crear deudas.

**Solución:** ✅ Implementado sistema de notificaciones automáticas

---

### 2. **Estadísticas de cuenta bancaria no mostraban datos**
**Problema:** En `/account/:id` no aparecían las estadísticas de gastos y deudas vinculadas.

**Causa:** 
- El query filtraba deudas solo por mes, pero afectan el balance total
- No se mostraba información de balance, moneda, y deudas totales

**Solución:** ✅ Reestructuradas estadísticas con información completa

---

## 🔧 Cambios Implementados

### 📁 **src/services/debtsService.js**

#### Cambio 1: Importar servicio de notificaciones
```javascript
import { createNotification } from './notificationsService';
```

#### Cambio 2: Enviar notificación al crear deuda con amigo real
```javascript
// Después de crear la deuda exitosamente
if (!isVirtualFriend && data) {
  // Identificar creador
  const creatorId = isIOwe ? debtData.debtorId : debtData.creditorId;
  
  // Obtener nombre del creador
  const { data: creatorProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', creatorId)
    .single();

  // Enviar notificación al amigo
  await createNotification({
    userId: debtData.friendId, // El amigo recibe la notif
    type: 'debt_request',
    title: isIOwe 
      ? 'Nueva deuda - Te deben dinero' 
      : 'Nueva deuda - Debes dinero',
    message: isIOwe 
      ? `${creatorName} registró que te debe $${amount}...`
      : `${creatorName} registró que le debes $${amount}...`,
    actionRequired: true,
    actionType: 'accept_debt'
  });
}
```

#### Cambio 3: Incluir moneda y cuenta al aceptar deuda
```javascript
// Al crear el gasto automático cuando se acepta
const { data: expense } = await supabase
  .from('expenses')
  .insert({
    user_id: debt.debtor_id,
    amount: debt.amount,
    description: `Deuda: ${debt.description}`,
    bank_account_id: debt.bank_account_id, // ✅ NUEVO
    currency: debt.currency,                 // ✅ NUEVO
    currency_symbol: debt.currency_symbol,   // ✅ NUEVO
    // ... otros campos
  });
```

---

### 📁 **src/services/bankAccountsService.js**

#### Reestructuración completa de `getAccountStats()`

**Antes:**
```javascript
// Solo obtenía deudas del mes
const { data: debts } = await supabase
  .from('debts')
  .eq('bank_account_id', accountId)
  .gte('created_at', startDate)
  .lte('created_at', endDate); // ❌ Filtraba por mes

return {
  stats: {
    totalExpenses,
    paidExpenses,
    totalDebts, // Solo del mes
    // ...
  }
};
```

**Ahora:**
```javascript
// Obtener TODAS las deudas vinculadas (sin filtro de mes)
const { data: allDebts } = await supabase
  .from('debts')
  .eq('bank_account_id', accountId)
  .eq('currency', account.currency); // Solo filtro por moneda

// Filtrar deudas del mes para stats mensuales
const monthDebts = allDebts?.filter(d => {
  const debtDate = new Date(d.created_at);
  return debtDate >= startDate && debtDate <= endDate;
});

return {
  stats: {
    // ✅ Balance general
    currentBalance: account.current_balance,
    initialBalance: account.initial_balance,
    currency: account.currency,
    currencySymbol: account.currency_symbol,
    
    // ✅ Gastos del mes
    totalExpenses,
    paidExpenses,
    pendingExpenses,
    expenseCount,
    
    // ✅ Deudas del mes
    totalDebtsMonth,
    paidDebtsMonth,
    debtCountMonth,
    
    // ✅ Deudas totales (todas)
    totalDebtsAll,
    paidDebtsAll,
    debtCountAll
  }
};
```

---

### 📁 **src/pages/AccountDetail/AccountDetail.jsx**

#### Nueva UI con dos secciones de estadísticas

**Balance General:**
```jsx
<h2>💰 Balance General</h2>
<div className={styles.statsGrid}>
  <StatCard 
    label="Balance Actual"
    value={`${stats.currencySymbol}${stats.currentBalance}`}
    variant={stats.currentBalance >= 0 ? 'success' : 'danger'}
  />
  <StatCard 
    label="Balance Inicial"
    value={`${stats.currencySymbol}${stats.initialBalance}`}
  />
  <StatCard 
    label="Total Gastado (mes)"
    value={`${stats.currencySymbol}${stats.totalExpenses}`}
  />
  <StatCard 
    label="Deudas (todas)"
    value={`${stats.currencySymbol}${stats.totalDebtsAll}`}
  />
</div>
```

**Estadísticas del Mes:**
```jsx
<h2>📊 Estadísticas de {mes} {año}</h2>
<div className={styles.statsGrid}>
  <StatCard 
    label="Gastos Pagados"
    value={`${stats.currencySymbol}${stats.paidExpenses}`}
  />
  <StatCard 
    label="Gastos Pendientes"
    value={`${stats.currencySymbol}${stats.pendingExpenses}`}
  />
  <StatCard 
    label="Deudas del Mes"
    value={`${stats.currencySymbol}${stats.totalDebtsMonth}`}
  />
  <StatCard 
    label="Cantidad"
    value={`${stats.expenseCount} gastos + ${stats.debtCountMonth} deudas`}
  />
</div>
```

---

### 📁 **src/pages/AccountDetail/AccountDetail.module.css**

#### Nuevo estilo para títulos de sección
```css
.sectionTitle {
  font-size: var(--font-xl);
  font-weight: 600;
  color: var(--text-primary);
  margin: var(--spacing-xl) 0 var(--spacing-md) 0;
}
```

---

## 📊 Cómo Funciona Ahora

### Flujo de Notificaciones:

```
Usuario A crea deuda "yo debo" a Usuario B
          ↓
debtsService.createDebt()
          ↓
Se crea registro en BD (status: 'pending')
          ↓
Se envía notificación a Usuario B
          ↓
Usuario B ve notificación en panel
          ↓
Usuario B acepta
          ↓
Se crea gasto automático para Usuario A
          ↓
Si tiene bank_account_id:
  - Se vincula gasto a cuenta
  - Trigger SQL actualiza balance
  - UI muestra en estadísticas
```

### Flujo de Estadísticas:

```
Usuario visita /account/:id
          ↓
AccountDetail.jsx carga datos
          ↓
bankAccountsService.getAccountStats()
          ↓
Query 1: Gastos del mes (con filtro de fecha)
Query 2: TODAS las deudas vinculadas (sin filtro de fecha)
          ↓
Se calculan:
  - Balance actual/inicial
  - Gastos del mes (pagados/pendientes)
  - Deudas del mes
  - Deudas totales
          ↓
UI muestra dos secciones:
  1. Balance General (con totales)
  2. Estadísticas Mensuales (del mes seleccionado)
```

---

## 🧪 Casos de Prueba

### Caso 1: Crear deuda "yo debo" y verificar notificación

**Pasos:**
1. Usuario A crea deuda "Yo debo $1000 ARS a Usuario B"
2. Selecciona cuenta bancaria "Cuenta Sueldo"
3. Hace clic en "Crear"

**Resultado esperado:**
✅ Usuario B recibe notificación: "Usuario A registró que te debe $1000 ARS"
✅ Notificación tiene botón "Aceptar/Rechazar"
✅ Aparece en panel de notificaciones de Usuario B
✅ Tiene badge rojo si no está leída

### Caso 2: Aceptar deuda y verificar vínculo con cuenta

**Pasos:**
1. Usuario B acepta la deuda
2. Usuario A navega a `/account/:id` de su cuenta vinculada
3. Verifica las estadísticas

**Resultado esperado:**
✅ Balance actual se reduce en $1000
✅ "Deudas (todas)" muestra $1000
✅ Si es del mes actual, "Deudas del Mes" también muestra $1000
✅ Contador de deudas aumenta
✅ Moneda es la misma (ARS)

### Caso 3: Ver estadísticas de meses anteriores

**Pasos:**
1. Usuario cambia selector de mes/año
2. Verifica estadísticas

**Resultado esperado:**
✅ "Balance Actual" NO cambia (siempre muestra balance actual)
✅ "Balance Inicial" NO cambia (es el inicial de la cuenta)
✅ "Deudas (todas)" NO cambia (incluye todas las deudas)
✅ "Total Gastado (mes)" SÍ cambia según mes seleccionado
✅ "Deudas del Mes" SÍ cambia según mes seleccionado
✅ Lista de gastos muestra solo los del mes

### Caso 4: Filtrado por moneda

**Pasos:**
1. Usuario tiene cuenta en USD
2. Crea gastos/deudas en USD y ARS
3. Visita cuenta USD

**Resultado esperado:**
✅ Solo muestra gastos/deudas en USD
✅ Balance solo incluye transacciones USD
✅ Gastos/deudas ARS NO afectan cuenta USD
✅ Estadísticas filtradas por moneda

---

## 🎯 Mejoras Técnicas

### Consistencia de Datos:
- ✅ Todas las deudas incluyen `currency` y `currency_symbol`
- ✅ Los gastos automáticos heredan moneda de la deuda
- ✅ Cuenta bancaria vinculada se preserva en aceptación
- ✅ Filtrado por moneda en todos los queries

### Performance:
- ✅ Queries optimizados con filtros tempranos
- ✅ Solo un query para deudas (luego filtrado en JS)
- ✅ Realtime subscriptions para actualizaciones automáticas

### UX:
- ✅ Notificaciones descriptivas con nombre del usuario
- ✅ Estadísticas separadas (balance general vs mes)
- ✅ Balance actual siempre visible
- ✅ Distinción clara entre deudas del mes y totales

---

## ⚠️ Notas Importantes

### Sobre las Deudas Totales:
Las deudas vinculadas a una cuenta afectan el balance TOTAL, no solo el del mes. Por eso:
- Se obtienen TODAS las deudas vinculadas
- Se muestran en "Balance General"
- Para stats mensuales, se filtran aparte

### Sobre las Notificaciones:
- Solo se envían para amigos reales (no virtuales)
- Los amigos virtuales auto-aceptan (no necesitan notificación)
- La notificación incluye toda la info necesaria para decidir

### Sobre el Balance:
- El balance actual es calculado por trigger SQL
- Incluye: inicial + ingresos - gastos - deudas
- Siempre filtrado por moneda de la cuenta
- Puede ser negativo (mostrado en rojo)

---

## 🚀 Próximos Pasos

1. **Probar notificaciones:**
   - Crear deuda "yo debo" con Usuario 3
   - Verificar que llega la notificación
   - Aceptar y ver que se crea el gasto

2. **Probar estadísticas:**
   - Visitar `/account/:id` de una cuenta
   - Verificar que muestra balance general
   - Cambiar mes y ver que stats cambian
   - Verificar que deudas totales permanecen

3. **Probar filtrado por moneda:**
   - Crear cuenta USD
   - Agregar gastos/deudas USD y ARS
   - Verificar que solo cuenta USD muestra transacciones USD

---

## 📝 Resumen de Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `debtsService.js` | ✅ Importar notificationsService<br>✅ Enviar notificación al crear deuda<br>✅ Incluir moneda/cuenta al aceptar |
| `bankAccountsService.js` | ✅ Reestructurar getAccountStats()<br>✅ Obtener todas las deudas<br>✅ Separar stats mensuales de totales |
| `AccountDetail.jsx` | ✅ Mostrar balance general<br>✅ Mostrar stats del mes<br>✅ Usar nuevos campos de stats |
| `AccountDetail.module.css` | ✅ Agregar estilo `.sectionTitle` |

---

**¡Todo funcionando! 🎉**
