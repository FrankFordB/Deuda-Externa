# Solución: Registro Lento + Avatars + Métodos de Pago

## 🐛 Problemas Solucionados

### 1. Registro se Queda Pensando
**Problema:** El registro intentaba crear el perfil manualmente después del registro, causando demoras.

**Solución:** 
- Eliminado el intento de crear perfil manualmente
- Ahora usa **trigger automático** `on_auth_user_created`
- El registro es instantáneo

### 2. Error de RLS en Avatars
**Problema:** `StorageApiError: new row violates row-level security policy`

**Solución:**
- Políticas de Storage configuradas correctamente
- Bucket `avatars` con acceso público
- Los usuarios pueden subir solo sus propios avatars

### 3. Métodos de Pago Automáticos
**Solución:**
- Trigger `on_profile_created` crea métodos predeterminados
- Se crean automáticamente al registrarse
- Script para usuarios existentes

## 📋 Orden de Ejecución en Supabase

### 1. Primera Migración
```sql
-- Archivo: add_monthly_income_and_virtual_friends.sql
-- Crea: monthly_incomes, virtual_friends, debt_installments
```

### 2. Segunda Migración (NUEVA)
```sql
-- Archivo: fix_storage_and_payment_methods.sql
-- Crea: 
--   - Storage RLS para avatars
--   - Tabla payment_methods
--   - Tabla debt_payments
--   - Triggers automáticos:
--     * handle_new_user() - Crea perfil al registrarse
--     * create_default_payment_methods() - Crea métodos de pago
--     * update_debt_amount_paid() - Actualiza pagos de deudas
```

### 3. Script para Usuarios Existentes (OPCIONAL)
```sql
-- Archivo: insert_payment_methods_existing_users.sql
-- Solo si ya tienes usuarios registrados antes de la migración
-- Inserta métodos de pago a usuarios que no los tengan
```

## 🚀 Pasos para Aplicar

### Paso 1: Ejecutar Migraciones en Supabase

1. Ve a **Supabase Dashboard** → **SQL Editor**

2. **Primera migración:**
   ```sql
   -- Copia y pega el contenido de:
   add_monthly_income_and_virtual_friends.sql
   ```
   Clic en **Run**

3. **Segunda migración:**
   ```sql
   -- Copia y pega el contenido de:
   fix_storage_and_payment_methods.sql
   ```
   Clic en **Run**

4. **Si tienes usuarios existentes:**
   ```sql
   -- Copia y pega el contenido de:
   insert_payment_methods_existing_users.sql
   ```
   Clic en **Run**

### Paso 2: Verificar en Table Editor

Deberías ver:
- ✅ Tabla `payment_methods` con políticas RLS
- ✅ Tabla `debt_payments`
- ✅ Tabla `monthly_incomes`
- ✅ Tabla `virtual_friends`
- ✅ Storage bucket `avatars` con políticas

### Paso 3: Verificar Triggers

En **Database** → **Functions**, deberías ver:
- ✅ `handle_new_user()` - Crea perfil
- ✅ `create_default_payment_methods()` - Crea métodos de pago
- ✅ `update_debt_amount_paid()` - Actualiza deudas
- ✅ `calculate_debt_remaining()` - Calcula saldo

En **Database** → **Triggers**, deberías ver:
- ✅ `on_auth_user_created` en `auth.users`
- ✅ `on_profile_created` en `profiles`
- ✅ `after_debt_payment_insert` en `debt_payments`
- ✅ `update_debt_remaining` en `debts`

## ✅ Probar la Solución

### 1. Probar Registro Rápido

1. Ve a: http://localhost:5173/register
2. Llena el formulario
3. Haz clic en **Crear Cuenta**
4. **Debería mostrar inmediatamente** la pantalla de verificación de email
5. Sin quedarse "pensando"

### 2. Probar Avatars

1. Inicia sesión
2. Ve a **Perfil**
3. Sube un avatar
4. **No debería dar error** de RLS
5. La imagen se guarda correctamente

### 3. Probar Métodos de Pago

1. Ve a **Gastos** → **Nuevo Gasto**
2. En "Método de Pago" deberías ver:
   - Efectivo 💵
   - Banco Santander 🏦
   - Banco BBVA 🏦
   - Mercado Pago 💳
   - Tarjeta de Crédito 💳
   - Tarjeta de Débito 💳
3. Haz clic en el botón **+**
4. Agrega un nuevo método (ej: "Banco Galicia")
5. Se selecciona automáticamente

## 🔧 Cambios en el Código

### authService.js
```javascript
// ANTES: Intentaba crear perfil manualmente
const { error: profileError } = await supabase
  .from('profiles')
  .upsert({...}) // ❌ Causaba demora

// AHORA: Deja que el trigger lo haga
// ✅ Rápido e instantáneo
return { user: authData.user, nickname, error: null };
```

### Triggers Automáticos
```sql
-- Cuando se registra un usuario
auth.users INSERT → handle_new_user() → Crea perfil

-- Cuando se crea un perfil
profiles INSERT → create_default_payment_methods() → Crea métodos

-- Cuando se paga una deuda
debt_payments INSERT → update_debt_amount_paid() → Actualiza deuda
```

## 📊 Flujo Completo de Registro

```
Usuario llena formulario
    ↓
Clic en "Crear Cuenta"
    ↓
authService.signUp()
    ↓
supabase.auth.signUp() → Crea usuario en auth.users
    ↓
TRIGGER: on_auth_user_created
    ↓
handle_new_user() → Crea registro en profiles
    ↓
TRIGGER: on_profile_created
    ↓
create_default_payment_methods() → Crea 6 métodos de pago
    ↓
✅ Pantalla de verificación (instantáneo)
```

## 🎯 Resultados Esperados

- ✅ Registro: < 2 segundos
- ✅ Perfil creado automáticamente
- ✅ 6 métodos de pago listos para usar
- ✅ Avatars sin errores de RLS
- ✅ Pantalla de verificación inmediata

## 🆘 Troubleshooting

### "El registro sigue lento"
- Verifica que el trigger `on_auth_user_created` exista
- Revisa la consola del navegador (F12) para ver logs
- Verifica que no haya errores en Supabase Dashboard → Logs

### "Error al subir avatar"
- Verifica que exista el bucket `avatars`
- Verifica las políticas en Storage → Policies
- El bucket debe ser **público**

### "No aparecen métodos de pago"
- Ejecuta el script `insert_payment_methods_existing_users.sql`
- Verifica el trigger `on_profile_created`
- Registra un usuario nuevo para probar

### "Error 'nickname already exists'"
- Normal si pruebas con el mismo nombre varias veces
- El sistema genera nickname único automáticamente
- Cambia el nombre o usa otro apellido

## 📝 Archivos Modificados

### Servicios
- ✅ `src/services/authService.js` - Registro optimizado

### Migraciones
- ✅ `supabase/migrations/fix_storage_and_payment_methods.sql` - Principal
- ✅ `supabase/migrations/insert_payment_methods_existing_users.sql` - Para usuarios existentes

## 🎉 Todo Listo

Después de ejecutar las migraciones:

1. **Registro:** Instantáneo ⚡
2. **Avatars:** Funcionando 📸
3. **Métodos de Pago:** Automáticos 💳
4. **Triggers:** Activos 🔄

---

**Última actualización:** 16 de Enero, 2026
**Estado:** ✅ Solucionado
