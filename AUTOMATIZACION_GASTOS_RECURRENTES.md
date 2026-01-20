# 🤖 AUTOMATIZACIÓN DE GASTOS RECURRENTES

## Opción 1: Edge Function en Supabase (RECOMENDADO)

### Paso 1: Crear Edge Function

1. Ve a tu proyecto en Supabase
2. Ve a **Edge Functions** en el menú lateral
3. Crea una nueva función llamada `generate-recurring-expenses`
4. Usa este código:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    // Crear cliente de Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Obtener todos los usuarios
    const { data: users, error: usersError } = await supabaseClient.auth.admin.listUsers()
    
    if (usersError) {
      throw usersError
    }

    let totalGenerated = 0
    const results = []

    // Generar gastos para cada usuario
    for (const user of users.users) {
      const { data, error } = await supabaseClient.rpc('generate_recurring_expenses', {
        p_user_id: user.id
      })

      if (error) {
        console.error(`Error generating for user ${user.id}:`, error)
        results.push({ user_id: user.id, success: false, error: error.message })
      } else {
        totalGenerated += data.generated || 0
        results.push({ user_id: user.id, success: true, generated: data.generated })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_users: users.users.length,
        total_generated: totalGenerated,
        results
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

### Paso 2: Configurar Cron Job

1. En Supabase, ve a **Database** > **Cron Jobs** (o usa pg_cron)
2. Crea un nuevo job:

```sql
-- Ejecutar todos los días a las 00:01
SELECT cron.schedule(
  'generate-recurring-expenses-daily',
  '1 0 * * *', -- Minuto 1, Hora 0, Todos los días
  $$
  SELECT net.http_post(
    url:='https://[TU_PROJECT_REF].supabase.co/functions/v1/generate-recurring-expenses',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer [TU_ANON_KEY]"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

3. Reemplaza:
   - `[TU_PROJECT_REF]` con tu referencia de proyecto
   - `[TU_ANON_KEY]` con tu clave anónima de Supabase

---

## Opción 2: Trigger de Base de Datos (ALTERNATIVA)

Si prefieres que se genere automáticamente cuando un usuario accede:

```sql
-- Crear función que verifica y genera gastos
CREATE OR REPLACE FUNCTION check_and_generate_recurring()
RETURNS trigger AS $$
BEGIN
  PERFORM generate_recurring_expenses(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger que se ejecuta al crear un gasto
CREATE TRIGGER auto_generate_recurring
  AFTER INSERT ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION check_and_generate_recurring();
```

---

## Opción 3: Botón Manual en la App (YA IMPLEMENTADO)

El usuario puede hacer clic en **"🔄 Generar Ahora"** en la UI para ejecutar manualmente.

Esto llama a:
```javascript
recurringExpensesService.generateRecurringExpenses(userId)
```

---

## Opción 4: Script Node.js (Para servidor propio)

Si tienes un servidor Node.js, puedes usar este script con cron:

```javascript
// cron-generate-recurring.js
const { createClient } = require('@supabase/supabase-js');
const cron = require('node-cron');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Ejecutar todos los días a las 00:01
cron.schedule('1 0 * * *', async () => {
  console.log('🔄 Generando gastos recurrentes...');
  
  try {
    // Obtener todos los usuarios
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    
    if (error) throw error;

    let totalGenerated = 0;

    for (const user of users) {
      const { data, error } = await supabase.rpc('generate_recurring_expenses', {
        p_user_id: user.id
      });

      if (error) {
        console.error(`❌ Error for user ${user.id}:`, error);
      } else {
        totalGenerated += data.generated || 0;
        console.log(`✅ User ${user.id}: ${data.generated} gastos generados`);
      }
    }

    console.log(`✨ Total: ${totalGenerated} gastos generados para ${users.length} usuarios`);
  } catch (error) {
    console.error('❌ Error:', error);
  }
});

console.log('⏰ Cron job iniciado - Ejecutará a las 00:01 cada día');
```

Instalar dependencias:
```bash
npm install @supabase/supabase-js node-cron
```

Ejecutar:
```bash
node cron-generate-recurring.js
```

---

## 🧪 TESTING

### Probar la función manualmente en Supabase SQL Editor:

```sql
-- Probar con tu usuario
SELECT generate_recurring_expenses('tu-user-id-aqui');

-- Ver resultado
SELECT * FROM expenses 
WHERE is_recurring = true 
ORDER BY created_at DESC 
LIMIT 10;
```

### Verificar que funciona:

```sql
-- Ver próximas generaciones programadas
SELECT 
  id,
  name,
  amount,
  frequency,
  next_generation_date,
  is_active
FROM recurring_expenses
WHERE is_active = true
ORDER BY next_generation_date;

-- Ver gastos generados hoy
SELECT * FROM expenses 
WHERE is_recurring = true 
AND DATE(created_at) = CURRENT_DATE;
```

---

## 📊 MONITOREO

### Dashboard de estado:

```sql
-- Estadísticas de gastos recurrentes
SELECT 
  frequency,
  COUNT(*) as total,
  SUM(amount) as total_amount,
  COUNT(CASE WHEN is_active THEN 1 END) as active_count
FROM recurring_expenses
GROUP BY frequency;

-- Gastos generados en el último mes
SELECT 
  DATE(created_at) as fecha,
  COUNT(*) as gastos_generados,
  SUM(amount) as total_amount
FROM expenses
WHERE is_recurring = true
AND created_at > CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY fecha DESC;
```

---

## 🔔 NOTIFICACIONES (OPCIONAL)

Puedes agregar notificaciones cuando se generan gastos:

```sql
-- Modificar la función generate_recurring_expenses para crear notificación
-- Agregar después de generar cada gasto:

INSERT INTO notifications (
  user_id,
  type,
  title,
  message,
  created_at
) VALUES (
  p_user_id,
  'recurring_generated',
  'Gasto Recurrente Generado',
  format('Se generó automáticamente: %s - $%s', rec.name, rec.amount),
  NOW()
);
```

---

## 💡 MEJORES PRÁCTICAS

1. **Ejecutar a horas de bajo tráfico** (00:01 AM recomendado)
2. **Log de errores**: Guardar logs de ejecución
3. **Retry logic**: Reintentar si falla
4. **Rate limiting**: No ejecutar más de 1 vez por día
5. **Testing**: Probar con pocos usuarios primero

---

## 🆘 TROUBLESHOOTING

### La función no se ejecuta automáticamente
- Verifica que el cron job esté activo
- Revisa los logs de Edge Functions
- Asegúrate de tener el plan correcto de Supabase

### Se generan gastos duplicados
- Verifica que `last_generated_date` se actualice correctamente
- Revisa la lógica de `next_generation_date`

### No se generan algunos gastos
- Verifica que `is_active = true`
- Asegúrate de que `next_generation_date` sea hoy o anterior
- Revisa que no haya errores en los logs

---

## 📞 SOPORTE

Si tienes problemas:
1. Revisa los logs de Supabase
2. Ejecuta la función manualmente para ver errores
3. Verifica las políticas RLS
4. Asegúrate de haber aplicado el SQL correctamente
