# Sistema Multi-Moneda - Instrucciones de Configuración

## 1. Migración de Base de Datos

Antes de usar el sistema multi-moneda, debes ejecutar el script SQL en Supabase:

### Paso 1: Accede al panel de Supabase
1. Ve a https://supabase.com y accede a tu proyecto
2. Navega a **SQL Editor** en el menú lateral

### Paso 2: Ejecuta el script de migración
1. Abre el archivo `supabase/migrations/add_multi_currency.sql`
2. Copia todo el contenido del archivo
3. Pega el contenido en el SQL Editor de Supabase
4. Haz clic en **Run** o presiona `Ctrl + Enter`

El script agrega:
- Columnas `currency` (código de moneda: ARS, USD, EUR, etc.)
- Columnas `currency_symbol` (símbolo: $, US$, €, etc.)
- Columnas en las tablas: `expenses`, `debts`, `installments`
- Campo `income_sources` (JSONB) en `profiles` para fuentes de ingreso
- Índices para mejorar el rendimiento

## 2. Monedas Soportadas

El sistema ahora soporta 8 monedas:

| Código | Moneda | Símbolo | País |
|--------|--------|---------|------|
| ARS | Peso Argentino 🇦🇷 | $ | Argentina |
| USD | Dólar Estadounidense 🇺🇸 | US$ | Estados Unidos |
| EUR | Euro 🇪🇺 | € | Europa |
| BRL | Real Brasileño 🇧🇷 | R$ | Brasil |
| CLP | Peso Chileno 🇨🇱 | CLP$ | Chile |
| COP | Peso Colombiano 🇨🇴 | COL$ | Colombia |
| MXN | Peso Mexicano 🇲🇽 | MX$ | México |
| UYU | Peso Uruguayo 🇺🇾 | $U | Uruguay |

**IMPORTANTE**: Cada moneda es independiente. No hay conversión automática entre monedas.

## 3. Cómo Usar el Sistema Multi-Moneda

### Crear un Gasto en Moneda Extranjera

1. Ve a **Gastos** → **+ Nuevo Gasto**
2. Completa los datos del gasto (descripción, monto, categoría)
3. Selecciona la moneda en el selector de moneda
4. El símbolo correcto se mostrará automáticamente
5. Guarda el gasto

### Crear una Deuda en Moneda Extranjera

1. Ve a **Deudas** → **+ Nueva Deuda**
2. Selecciona el amigo
3. Completa descripción y monto
4. Selecciona la moneda
5. Guarda la deuda

### Filtrar por Moneda en el Dashboard

En el Dashboard verás botones de filtro por moneda:
```
[💰 ARS] [💵 USD] [💶 EUR] ...
```

Al hacer clic en un botón:
- Las **StatCards** mostrarán totales solo de esa moneda
- El **Resumen de Deudas** mostrará solo deudas en esa moneda
- Los **Próximos Pagos** mostrarán gastos en esa moneda
- El símbolo correcto se mostrará en todos los montos (US$1,200 en vez de $1,200)

## 4. Verificar que Funciona

Sigue estos pasos para probar:

### Prueba 1: Crear Gastos Multi-Moneda
1. Crea un gasto de **$50,000 ARS**
2. Crea un gasto de **US$100 USD**
3. Crea un gasto de **€75 EUR**

### Prueba 2: Verificar Dashboard
1. Ve al Dashboard
2. Haz clic en el botón **ARS**: deberías ver solo $50,000
3. Haz clic en el botón **USD**: deberías ver solo US$100
4. Haz clic en el botón **EUR**: deberías ver solo €75

### Prueba 3: Listas de Gastos
1. Ve a **Gastos**
2. Verifica que cada gasto muestre su símbolo correcto:
   - $50,000 (ARS)
   - US$100 (USD)
   - €75 (EUR)

### Prueba 4: Crear Deuda en USD
1. Ve a **Deudas** → **+ Nueva Deuda**
2. Crea una deuda de **US$200** a un amigo
3. En el Dashboard, filtra por USD
4. Verifica que aparezca con el símbolo US$

## 5. Próximas Funcionalidades

### Fuentes de Ingreso Multi-Moneda (Pendiente)
En Settings/Perfil podrás configurar hasta 4 fuentes de ingreso:
- Ejemplo: "Sueldo: $500,000 ARS"
- Ejemplo: "Freelance: US$1,000 USD"
- Cada fuente tendrá su propia moneda

Esta funcionalidad se implementará en la siguiente fase.

## 6. Notas Importantes

- ⚠️ **No hay conversión automática**: Si tienes $1,000 ARS y US$100 USD, son dos montos separados
- ⚠️ **Filtro obligatorio**: En el Dashboard, siempre verás los datos de UNA moneda a la vez
- ⚠️ **Moneda por defecto**: Al crear un gasto/deuda nuevo, se pre-selecciona la moneda de tu país (perfil)
- ⚠️ **Cuotas heredan moneda**: Si creas un gasto con cuotas en USD, todas las cuotas serán en USD

## 7. Solución de Problemas

### No veo los botones de moneda en el Dashboard
- Verifica que hayas ejecutado el script SQL `add_multi_currency.sql`
- Recarga la página con `Ctrl + Shift + R`

### Los símbolos no se muestran correctamente
- Asegúrate de que el script SQL se ejecutó correctamente
- Los gastos/deudas antiguos (antes de ejecutar el script) tendrán símbolo `$` por defecto

### Error al crear gasto con moneda
- Verifica que el script SQL se haya ejecutado sin errores
- Revisa la consola del navegador (F12) para ver el error específico

## 8. Contacto

Si encuentras algún problema o tienes preguntas, revisa los logs de la aplicación en la consola del navegador (F12) y comparte el error.
