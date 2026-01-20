# Instrucciones de Actualización

## Cambios Implementados

### 1. Sueldo Mensual Seleccionable
- **Nueva tabla `monthly_incomes`**: Permite guardar el sueldo para cada mes/año específico
- **Selector de mes/año en Dashboard**: Ahora puedes elegir el mes para ver las estadísticas
- Los cálculos de "te alcanza" se hacen con el sueldo específico del mes seleccionado

### 2. Validación de Pago de Deudas
- **Deudas con personas reales**: Ya no se pueden marcar como pagadas directamente. Debes solicitar confirmación al acreedor
- **Deudas con amigos virtuales**: Sí se pueden marcar como pagadas directamente
- Esto previene conflictos cuando pagas deudas a personas reales

### 3. Estadísticas Mejoradas
- Las estadísticas ahora usan los datos correctos de la base de datos
- Los cálculos de balance incluyen el sueldo mensual configurado
- Los gráficos muestran datos del mes seleccionado

### 4. Nuevas Tablas en Base de Datos
- `monthly_incomes`: Sueldos mensuales por usuario
- `virtual_friends`: Amigos virtuales (no usuarios del sistema)
- `debt_installments`: Cuotas de deudas

## Pasos para Aplicar los Cambios

### Paso 1: Ejecutar la Migración SQL en Supabase

1. Ve a tu proyecto en Supabase: https://app.supabase.com
2. Haz clic en **SQL Editor** en el menú izquierdo
3. Crea una nueva query
4. Copia y pega el contenido del archivo:
   ```
   supabase/migrations/add_monthly_income_and_virtual_friends.sql
   ```
5. Haz clic en **Run** para ejecutar la migración
6. Verifica que no haya errores

### Paso 2: Verificar las Tablas Creadas

En el **Table Editor** de Supabase, deberías ver las nuevas tablas:
- ✅ `monthly_incomes`
- ✅ `virtual_friends`
- ✅ `debt_installments`

Y las columnas actualizadas en `debts`:
- `virtual_friend_id`
- `debtor_type`
- `category`
- `purchase_date`
- `due_date`
- `installments`
- etc.

### Paso 3: Probar la Aplicación

1. **Configurar Sueldo Mensual**:
   - Ve al Dashboard
   - Selecciona un mes/año
   - Haz clic en "Configurar Sueldo"
   - Ingresa tu sueldo para ese mes
   - Guarda

2. **Cambiar de Mes**:
   - Usa los selectores de mes/año en el Dashboard
   - Observa cómo cambian los datos y el sueldo
   - Configura diferentes sueldos para diferentes meses

3. **Probar Deudas**:
   - Crea una deuda con un amigo real → No podrás marcarla como pagada directamente
   - Crea una deuda con un amigo virtual → Sí podrás marcarla como pagada

4. **Ver Estadísticas**:
   - Ve a la página de Estadísticas
   - Verifica que los gráficos muestren datos correctos
   - Cambia el año para ver datos históricos

## Características Nuevas

### Selector de Mes/Año
```
Dashboard: [Enero ▼] [2026 ▼] [➕ Nuevo Gasto]
```
- Cambia el mes para ver gastos y sueldo de ese período
- Las estadísticas se actualizan automáticamente
- Cada mes puede tener un sueldo diferente

### Gestión de Sueldo
- **Configura sueldo por mes**: Ideal para sueldos variables
- **Visualiza si te alcanza**: El dashboard muestra si tu sueldo cubre gastos + deudas
- **Histórico**: Guarda sueldos de meses anteriores

### Validación de Deudas
- **Personas reales**: Requieren confirmación del acreedor para marcar como pagada
- **Amigos virtuales**: Se pueden marcar como pagadas directamente
- Mensaje claro cuando intentas pagar una deuda real

## Solución de Problemas

### Error "Table does not exist"
- Asegúrate de ejecutar la migración SQL en Supabase
- Verifica que las tablas se crearon correctamente

### Error "RLS policy violation"
- Las políticas RLS se crean automáticamente con la migración
- Verifica que estés autenticado correctamente

### El sueldo no se guarda
- Revisa que la tabla `monthly_incomes` exista
- Verifica que tengas permisos de escritura (las políticas RLS lo permiten)
- Abre la consola del navegador para ver errores

### Las estadísticas no se actualizan
- Refresca la página
- Verifica que haya gastos en el mes seleccionado
- Revisa la consola del navegador

## Archivos Modificados

### Servicios
- ✅ `src/services/monthlyIncomeService.js` (nuevo)
- ✅ `src/services/debtsService.js` (actualizado)
- ✅ `src/services/expensesService.js` (actualizado)
- ✅ `src/services/index.js` (actualizado)

### Contextos
- ✅ `src/context/ExpensesContext.jsx` (actualizado)

### Páginas
- ✅ `src/pages/Dashboard/Dashboard.jsx` (actualizado)
- ✅ `src/pages/Dashboard/Dashboard.module.css` (actualizado)

### Base de Datos
- ✅ `supabase/migrations/add_monthly_income_and_virtual_friends.sql` (nuevo)

## Próximos Pasos Recomendados

1. **Migración de datos antiguos**: Si tenías un campo `monthly_income` en `profiles`, podrías crear un script para migrar esos datos a `monthly_incomes`

2. **Notificaciones**: Implementar notificaciones cuando alguien solicita confirmación de pago

3. **Recordatorios**: Sistema de recordatorios para deudas próximas a vencer

4. **Exportar datos**: Función para exportar estadísticas en PDF o Excel

## Contacto y Soporte

Si tienes problemas, revisa:
1. Consola del navegador (F12 → Console)
2. Network tab para ver errores de API
3. Supabase logs en el dashboard

¡Disfruta de las nuevas funcionalidades! 🎉
