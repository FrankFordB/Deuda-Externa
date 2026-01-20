# SOLUCIÓN URGENTE - Problemas de Deudas y Notificaciones

## 🚨 Problemas Identificados

1. **Error 403 Forbidden al crear notificaciones** - Las políticas RLS están bloqueando la creación de notificaciones
2. **Keys duplicadas en React** - Notificaciones con el mismo ID se renderizaban múltiples veces
3. **Auto-asignación de deudas** - Cuando creas una deuda "Yo debo" a un amigo, se envía al usuario incorrecto

## ✅ Soluciones Implementadas

### 1. Fix de RLS para Notifications (CRÍTICO)

**Archivo creado:** `supabase/FIX_RLS_NOTIFICATIONS_V2.sql`

**Qué hace:**
- Elimina todas las políticas RLS conflictivas de la tabla `notifications`
- Crea políticas permisivas que permiten a cualquier usuario autenticado crear notificaciones para otros usuarios
- Mantiene la seguridad: solo puedes ver/editar/eliminar TUS propias notificaciones

**CÓMO APLICARLO:**

1. Abre Supabase Dashboard → SQL Editor
2. Copia y pega el contenido de `supabase/FIX_RLS_NOTIFICATIONS_V2.sql`
3. Ejecuta el script completo
4. Verifica que al final veas:
   - 4 políticas creadas: `notifications_insert_any`, `notifications_select_own`, `notifications_update_own`, `notifications_delete_own`
   - `rowsecurity = true` para la tabla notifications

**SIN ESTE FIX, LAS NOTIFICACIONES NO FUNCIONARÁN**

### 2. Fix de Notificaciones Duplicadas

**Archivos modificados:**
- `src/context/NotificationsContext.jsx`

**Cambios:**
- Agregada verificación de duplicados al recibir notificaciones en tiempo real
- Eliminación de duplicados en la carga inicial usando `Map` para deduplicar por ID
- Logs de advertencia si se detectan duplicados

**Resultado:** Ya no verás el error "Encountered two children with the same key"

### 3. Logs de Depuración para Deudas

**Archivos modificados:**
- `src/services/debtsService.js`
- `src/pages/Debts/Debts.jsx`

**Qué hacen:**
Agregué logs detallados con el emoji 🔍 que muestran:
- Quién es el creador de la deuda
- Quién es el amigo (friendId)
- Valores de creditorId y debtorId
- Quién debería recibir la notificación

**Cómo usarlos:**
1. Abre las DevTools del navegador (F12)
2. Ve a la pestaña Console
3. Crea una deuda "Yo debo" a un amigo
4. Observa los logs que empiezan con `🔍 DEBUG`
5. Verifica que:
   - `formData.friendId` sea el ID del AMIGO, no tuyo
   - `recipientId` sea el ID del AMIGO
   - Los valores de `creditorId` y `debtorId` sean correctos

**Si ves que `formData.friendId` es igual a `user.id`, entonces el problema está en el selector de amigos**

## 🔍 Diagnóstico del Problema de Auto-Asignación

El código actual debería funcionar correctamente, pero si las deudas se siguen auto-asignando, el problema está en **cómo se está seleccionando el amigo en el formulario**.

**Posibles causas:**
1. El selector de amigos está retornando tu propio ID en lugar del ID del amigo
2. La variable `f.friend?.id` está undefined y cae en tu ID por default
3. Hay un problema con la estructura de datos de `friends` del contexto

**Para verificar:**
Revisa los logs en la consola cuando seleccionas un amigo en el dropdown. Deberías ver:
```
🔍 DEBUG - handleSubmit Debts.jsx:
  - formData.friendId (raw): [UUID del amigo]
  - friendId (limpio): [UUID del amigo]
  - user.id (yo): [TU UUID]
```

Si `formData.friendId` es igual a `user.id`, entonces el problema está en el `onChange` del select de amigos (línea 646-660 de Debts.jsx).

## 📝 Próximos Pasos

1. **APLICAR EL SQL FIX** - Sin esto, las notificaciones no funcionarán
2. **Probar creación de deudas** - Observar los logs en la consola
3. **Reportar qué valores aparecen en los logs** - Así podremos identificar exactamente dónde está el problema

## 🐛 Si el problema persiste

Si después de aplicar el SQL fix y verificar los logs, el problema de auto-asignación persiste, necesitaré que me compartas:

1. Los logs completos de la consola cuando creas una deuda
2. La estructura de un objeto `friend` del array `friends` (puedes hacer `console.log(friends[0])` en Debts.jsx)
3. Si el problema ocurre con todos los amigos o solo con algunos

## ⚠️ Notas Importantes

- Los logs de depuración se pueden eliminar después de resolver el problema
- El fix de SQL es permanente y solo necesita aplicarse una vez
- La deduplicación de notificaciones previene errores futuros
- Si tienes notificaciones duplicadas existentes en la base de datos, considera limpiarlas con una query SQL manual

