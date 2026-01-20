# 🚨 FIX URGENTE: Error 403 en Notificaciones

## ❌ Problema

```
POST .../rest/v1/notifications?select=* 403 (Forbidden)
Error: new row violates row-level security policy for table "notifications"
```

## ✅ Solución (2 minutos)

### Paso 1: Abrir Supabase Dashboard
1. Ve a [supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto: **kvlxpoauwwpqciuvxhrt**
3. Click en **SQL Editor** (icono 📊 en el menú lateral)

### Paso 2: Aplicar el Fix
1. Click en **"New Query"** (botón arriba a la derecha)
2. Copia y pega TODO el contenido de: `supabase/FIX_NOTIFICATIONS_RLS_URGENTE.sql`
3. Click en **"Run"** o presiona `Ctrl + Enter`

### Paso 3: Verificar
Deberías ver al final:

```
✅ 4 rows returned

policyname:
- notifications_insert_any
- notifications_select_own
- notifications_update_own
- notifications_delete_own
```

### Paso 4: Probar en la App
1. Recarga la aplicación: `http://localhost:5175`
2. Realiza una acción que genere notificación (crear deuda, marcar pagada, etc.)
3. El error 403 ya NO debería aparecer

---

## 🔍 Qué Hace el Fix

### Políticas Anteriores (PROBLEMA)
```sql
❌ Políticas mal configuradas o duplicadas
❌ WITH CHECK demasiado restrictivo
❌ No permitía insertar notificaciones para otros usuarios
```

### Políticas Nuevas (SOLUCIÓN)
```sql
✅ INSERT: Cualquier usuario autenticado puede crear notificaciones
✅ SELECT: Solo ver notificaciones propias (user_id = auth.uid())
✅ UPDATE: Solo actualizar notificaciones propias
✅ DELETE: Solo eliminar notificaciones propias
```

---

## 📋 Checklist Post-Fix

- [ ] Script ejecutado sin errores
- [ ] 4 políticas creadas (verificar query final)
- [ ] Aplicación recargada
- [ ] Error 403 ya NO aparece en consola
- [ ] Notificaciones se crean correctamente

---

## 🐛 Si Aún Tienes Problemas

### Verificar Usuario Autenticado
```javascript
// En la consola del navegador
const { data: { user } } = await supabase.auth.getUser();
console.log('Usuario:', user?.id);
```

### Verificar RLS Habilitado
```sql
-- En SQL Editor de Supabase
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'notifications';
-- Debe mostrar: rowsecurity = true
```

### Verificar Políticas Activas
```sql
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'notifications';
-- Debe mostrar las 4 políticas
```

---

## 📞 Nota Técnica

### Por Qué Ocurrió el Error

Las políticas RLS (Row Level Security) de PostgreSQL protegen las tablas. Cuando un usuario intenta insertar una notificación, PostgreSQL verifica:

1. **¿Está autenticado?** → Sí (tiene token)
2. **¿Tiene permiso INSERT?** → Verifica política
3. **¿WITH CHECK pasa?** → **AQUÍ FALLABA**

El problema era que la política `WITH CHECK` no permitía que un usuario creara notificaciones para OTROS usuarios, lo cual es necesario cuando:
- Usuario A crea una deuda → Se notifica a Usuario B
- Usuario B marca como pagada → Se notifica a Usuario A

### La Solución

```sql
CREATE POLICY "notifications_insert_any"
  WITH CHECK (true);  -- ✅ Permite crear para cualquier user_id
```

Esto es SEGURO porque:
- Solo usuarios autenticados pueden insertar
- Solo pueden VER sus propias notificaciones (SELECT policy)
- Solo pueden EDITAR/BORRAR sus propias notificaciones

---

## ✅ Resultado Final

**Antes:**
```
❌ 403 Forbidden
❌ Notificaciones no se crean
❌ Error en consola
```

**Después:**
```
✅ 200 OK
✅ Notificaciones creadas
✅ Sin errores en consola
```

---

**Archivo SQL:** `supabase/FIX_NOTIFICATIONS_RLS_URGENTE.sql`  
**Tiempo estimado:** 2 minutos  
**Dificultad:** Fácil (copy/paste)
