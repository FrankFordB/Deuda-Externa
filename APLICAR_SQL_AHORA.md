# 🚨 APLICAR ESTE SQL EN SUPABASE AHORA

## Errores Actuales
```
POST debts 403 (Forbidden)
new row violates row-level security policy for table "debts"

POST notifications 403 (Forbidden)
new row violates row-level security policy for table "notifications"
```

## Solución - Script COMPLETO

1. **Abre Supabase Dashboard**
2. **Ve a SQL Editor**
3. **Copia y pega el contenido de:** `supabase/FIX_RLS_COMPLETO.sql`
4. **Ejecuta el script completo (corrige DEBTS y NOTIFICATIONS)**

## Qué hace el script

### Para DEBTS:
- Permite crear deudas donde eres CREDITOR (te deben) O DEBTOR (debes)
- Antes solo permitía crear si eras CREDITOR
- Ahora puedes crear deudas "Yo debo" sin error 403

### Para NOTIFICATIONS:
- Permite crear notificaciones para otros usuarios
- Antes bloqueaba la creación (error 403)
- Ahora las notificaciones funcionan correctamente

## Sin este fix

❌ No puedes crear deudas "Yo debo" (error 403)
❌ Las notificaciones NO funcionarán (error 403)
❌ Los amigos NO recibirán notificaciones
❌ Las confirmaciones de pago fallarán

## Después de aplicarlo

✅ Puedes crear deudas "Yo debo" y "Me deben"
✅ Las notificaciones se crearán correctamente
✅ Los amigos recibirán notificaciones cuando les debas
✅ Las confirmaciones de pago funcionarán
✅ No más error 403 Forbidden

---

**ESTE ES EL PASO MÁS CRÍTICO - APLICA `FIX_RLS_COMPLETO.sql`**
