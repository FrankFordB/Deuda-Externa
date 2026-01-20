# 🎯 GUÍA DE IMPLEMENTACIÓN: Sistema de Pagos y Notificaciones

## 📋 Resumen de Cambios

Esta guía describe las mejoras implementadas para el sistema de deudas:

1. ✅ **Botones de pago funcionando en debts** - Los botones ahora cambian correctamente el estado
2. 🔄 **Reversión de pagos de cuotas** - Posibilidad de revertir pagos erróneos
3. 🎨 **Diseño mejorado del panel de cuotas** - Interface más clara y profesional
4. 🔔 **Círculos de notificaciones** - Indicadores visuales en pestañas "Me Deben" y "Yo Debo"

---

## 🗄️ PASO 1: Aplicar Cambios en la Base de Datos

### 1.1 Sistema de Pagos Completo

Ejecuta en **Supabase SQL Editor**:

```bash
# Archivo: supabase/FIX_PAYMENT_SYSTEM_COMPLETE.sql
```

Este script agrega:
- ✅ Columna `debtor_confirmed_paid` para confirmaciones del deudor
- ✅ Columnas para reversión de pagos en `debt_installments`
- ✅ Columna `paid_installments` en `debts` (contador automático)
- ✅ Triggers para actualizar contadores automáticamente
- ✅ Trigger para marcar deuda como `paid` cuando todas las cuotas están pagadas
- ✅ Vista `v_notification_counters` para estadísticas

**Verificación:**
```sql
-- Debe mostrar las nuevas columnas
SELECT * FROM information_schema.columns 
WHERE table_name IN ('debts', 'debt_installments')
AND column_name IN (
  'debtor_confirmed_paid', 
  'paid_installments',
  'payment_reverted',
  'paid_by',
  'reverted_at'
);
```

### 1.2 Funciones de Contadores de Notificaciones

Ejecuta en **Supabase SQL Editor**:

```bash
# Archivo: supabase/ADD_NOTIFICATION_COUNTERS.sql
```

Este script crea:
- ✅ Función `get_debtor_notifications_count()` - Notificaciones de "Yo Debo"
- ✅ Función `get_creditor_notifications_count()` - Notificaciones de "Me Deben"
- ✅ Función `get_all_debt_notifications_count()` - Contador general
- ✅ Vista materializada `mv_notification_counters` (optimización)
- ✅ Triggers para actualizar contadores automáticamente

**Verificación:**
```sql
-- Probar las funciones (reemplaza con tu user_id)
SELECT * FROM get_debtor_notifications_count('tu-user-id-aqui');
SELECT * FROM get_creditor_notifications_count('tu-user-id-aqui');
SELECT * FROM get_all_debt_notifications_count('tu-user-id-aqui');
```

---

## 💻 PASO 2: Verificar Archivos Actualizados

Los siguientes archivos ya fueron modificados:

### 2.1 Servicios

#### `src/services/debtsService.js`
- ✅ `markInstallmentAsPaid()` - Ahora recibe `userId` y registra quién marcó el pago
- ✅ `revertInstallmentPayment()` - Nueva función para revertir pagos
- ✅ Eliminada lógica manual de conteo (ahora usa triggers de BD)

#### `src/services/notificationsService.js`
- ✅ `getDebtorNotificationsCount()` - Contador para "Yo Debo"
- ✅ `getCreditorNotificationsCount()` - Contador para "Me Deben"
- ✅ `getAllDebtNotificationsCount()` - Contador general

### 2.2 Componentes

#### `src/pages/Debts/Debts.jsx`
- ✅ `handleMarkInstallmentPaid()` - Actualizado para pasar `userId`
- ✅ `handleRevertInstallmentPayment()` - Nueva función para revertir pagos
- ✅ Estados `debtorNotifCount` y `creditorNotifCount` agregados
- ✅ useEffect para cargar contadores de notificaciones cada 30 segundos
- ✅ Badges de notificación en pestañas "Yo Debo" y "Me Deben"
- ✅ Botón "Revertir" en cuotas pagadas (solo para acreedores)

#### `src/pages/Debts/Debts.module.css`
- ✅ `.installmentItem` - Diseño mejorado con hover y mejor espaciado
- ✅ `.installmentActions` - Contenedor para botones de acción
- ✅ `.notificationBadge` - Badge animado para notificaciones
- ✅ Animación `notificationPulse` - Efecto visual para atraer atención

---

## 🚀 PASO 3: Ejecutar la Aplicación

```bash
# Instalar dependencias si es necesario
npm install

# Iniciar en modo desarrollo
npm run dev
```

---

## ✅ PASO 4: Verificar Funcionalidades

### 4.1 Botones de Pago en Deudas

1. Ve a **Debts** → Pestaña **"Me Deben"**
2. Haz clic en **"📋 Ver Cuotas"** en una deuda con cuotas
3. Verifica que aparezcan botones:
   - ✓ **"✓ Pagar"** para cuotas pendientes
   - ✓ **"↺ Revertir"** para cuotas pagadas

**Prueba:**
- Marca una cuota como pagada → Debe cambiar a color verde
- Revierte el pago → Debe volver a estado pendiente
- Verifica que el contador `X/Y pagadas` se actualice automáticamente

### 4.2 Reversión de Pagos

1. Marca una cuota como pagada
2. Haz clic en **"↺ Revertir"**
3. Confirma la acción
4. Verifica que:
   - La cuota vuelva a estado pendiente
   - El contador de cuotas pagadas disminuya
   - Si todas las cuotas estaban pagadas, la deuda vuelva a estado `accepted`

### 4.3 Círculos de Notificaciones

1. Ve a **Debts**
2. Verifica los badges en las pestañas:
   - 🔔 **"Yo Debo"** → Muestra notificaciones de deudas pendientes, pagos marcados, etc.
   - 🔔 **"Me Deben"** → Muestra confirmaciones de pago, cobros pendientes, etc.

**Características:**
- Badge con animación de pulso
- Color azul (`primary-500`)
- Se actualiza automáticamente cada 30 segundos
- Desaparece cuando no hay notificaciones

### 4.4 Diseño del Panel de Cuotas

1. Abre cualquier deuda con cuotas
2. Verifica el diseño:
   - ✅ Cards con bordes y sombra al hacer hover
   - ✅ Información clara: número de cuota, fecha, monto
   - ✅ Estados visuales: verde (pagada), rojo (vencida), amarillo (pendiente)
   - ✅ Botones de acción alineados a la derecha
   - ✅ Espaciado apropiado entre elementos

---

## 🔧 PASO 5: Resolución de Problemas

### Problema: Los botones no cambian el estado

**Solución:**
1. Verifica que aplicaste `FIX_PAYMENT_SYSTEM_COMPLETE.sql`
2. Revisa la consola del navegador por errores
3. Asegúrate de que las políticas RLS permitan UPDATE en `debt_installments`

```sql
-- Verificar políticas
SELECT * FROM pg_policies WHERE tablename = 'debt_installments';
```

### Problema: Los contadores de notificaciones no aparecen

**Solución:**
1. Verifica que aplicaste `ADD_NOTIFICATION_COUNTERS.sql`
2. Prueba las funciones manualmente:

```sql
SELECT * FROM get_debtor_notifications_count('tu-user-id');
```

3. Si da error, verifica que el usuario tenga permisos:

```sql
GRANT EXECUTE ON FUNCTION get_debtor_notifications_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_creditor_notifications_count(UUID) TO authenticated;
```

### Problema: El diseño no se ve correctamente

**Solución:**
1. Fuerza un refresh completo: `Ctrl + F5` (Windows) o `Cmd + Shift + R` (Mac)
2. Limpia la caché del navegador
3. Verifica que `Debts.module.css` tenga los nuevos estilos

---

## 📊 PASO 6: Monitoreo y Mantenimiento

### Verificar Triggers Funcionando

```sql
-- Ver si paid_installments se actualiza automáticamente
SELECT 
  d.id,
  d.description,
  d.installments as total_installments,
  d.paid_installments,
  (SELECT COUNT(*) FROM debt_installments WHERE debt_id = d.id AND paid = true) as actual_paid
FROM debts d
WHERE d.installments > 1
LIMIT 10;

-- Debe coincidir: paid_installments = actual_paid
```

### Refrescar Vista Materializada (si usas)

```sql
-- Ejecutar periódicamente (ej: cron job diario)
SELECT refresh_notification_counters();
```

### Limpiar Notificaciones Antiguas

```sql
-- Eliminar notificaciones leídas de más de 30 días
DELETE FROM notifications 
WHERE read = true 
AND created_at < NOW() - INTERVAL '30 days';
```

---

## 📝 PASO 7: Documentación Técnica

### Estructura de BD

#### Tabla `debts`
```
+ paid_by_creditor: boolean (ya existía)
+ creditor_marked_paid_at: timestamptz (ya existía)
+ debtor_confirmed_paid: boolean (NUEVO)
+ debtor_confirmed_paid_at: timestamptz (NUEVO)
+ paid_installments: integer (NUEVO)
```

#### Tabla `debt_installments`
```
+ paid_by: uuid (NUEVO) - Referencia al usuario que marcó como pagada
+ payment_reverted: boolean (NUEVO)
+ reverted_at: timestamptz (NUEVO)
+ reverted_by: uuid (NUEVO)
+ revert_reason: text (NUEVO)
```

### Flujo de Pago de Cuotas

1. **Acreedor marca cuota como pagada:**
   ```
   markInstallmentAsPaid(installmentId, userId)
   → UPDATE debt_installments SET paid=true, paid_by=userId
   → TRIGGER: actualiza paid_installments en debts
   → TRIGGER: si todas pagadas, marca deuda como 'paid'
   ```

2. **Acreedor revierte pago:**
   ```
   revertInstallmentPayment(installmentId, userId, reason)
   → UPDATE debt_installments SET paid=false, payment_reverted=true
   → TRIGGER: actualiza paid_installments en debts
   → TRIGGER: si deuda estaba 'paid', vuelve a 'accepted'
   ```

### Flujo de Notificaciones

1. **Carga inicial:**
   ```javascript
   useEffect(() => {
     getDebtorNotificationsCount(userId) // "Yo Debo"
     getCreditorNotificationsCount(userId) // "Me Deben"
   }, [user])
   ```

2. **Actualización periódica:**
   ```javascript
   setInterval(() => {
     // Recarga contadores cada 30 segundos
   }, 30000)
   ```

3. **Renderizado de badges:**
   ```jsx
   {debtorNotifCount > 0 && (
     <span className={styles.notificationBadge}>
       {debtorNotifCount}
     </span>
   )}
   ```

---

## 🎉 RESULTADO ESPERADO

Después de completar todos los pasos:

✅ Los botones de pago en deudas funcionan correctamente
✅ Se pueden revertir pagos de cuotas por error
✅ El panel de cuotas tiene un diseño profesional y claro
✅ Los círculos de notificaciones aparecen en "Yo Debo" y "Me Deben"
✅ Los contadores se actualizan automáticamente
✅ La UI es más intuitiva y fácil de usar

---

## 📞 Soporte

Si encuentras problemas:
1. Revisa la consola del navegador (F12)
2. Verifica los logs de Supabase
3. Consulta esta guía paso a paso
4. Revisa las secciones de "Resolución de Problemas"

---

**Última actualización:** 2026-01-19
**Versión:** 1.0
**Compatibilidad:** React 18+, Supabase PostgreSQL 14+
