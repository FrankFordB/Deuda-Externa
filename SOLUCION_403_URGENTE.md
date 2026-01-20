# 🚨 ERROR 403 - SOLUCIÓN INMEDIATA

## El Problema
```
POST notifications 403 (Forbidden)
new row violates row-level security policy
```

## ¿Por Qué Ocurre?
Las políticas RLS (Row Level Security) de Supabase están bloqueando la creación de notificaciones y deudas.

## Solución en 3 Pasos

### PASO 1: Aplicar SQL Fix
1. Abre **Supabase Dashboard** → **SQL Editor**
2. Copia **TODO** el contenido de estos archivos:
   - `supabase/FIX_NOTIFICATIONS_SIMPLE.sql`
   - `supabase/FIX_DEBTS_SIMPLE.sql`
3. Pega y ejecuta **cada uno** (uno por uno)

### PASO 2: Cerrar Sesión (CRÍTICO ⚠️)
**IMPORTANTE:** Después de aplicar los SQL:
1. En tu aplicación, click en tu perfil
2. **Cerrar sesión**
3. Espera 5 segundos

### PASO 3: Volver a Iniciar Sesión
1. Inicia sesión nuevamente
2. Ahora intenta crear una deuda
3. Debería funcionar sin error 403

## ¿Por Qué Cerrar Sesión?
Los tokens de autenticación de Supabase cachean los permisos RLS. Al cerrar sesión y volver a entrar, se regeneran los tokens con los nuevos permisos.

## Si Sigue Sin Funcionar

Verifica en Supabase SQL Editor:
```sql
-- Ver políticas actuales de notifications
SELECT policyname, cmd, with_check 
FROM pg_policies 
WHERE tablename = 'notifications';

-- Ver políticas actuales de debts
SELECT policyname, cmd, with_check 
FROM pg_policies 
WHERE tablename = 'debts';
```

Deberías ver:
- **notifications**: política `allow_all_inserts` con `WITH CHECK (true)`
- **debts**: política `allow_debt_inserts` con creditor O debtor

---

**SIN ESTOS PASOS, LA APP NO FUNCIONARÁ**
