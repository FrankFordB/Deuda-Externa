# 📘 EJEMPLOS DE USO - GASTOS RECURRENTES

## 🎯 Casos de Uso Comunes

### 1. Gimnasio Mensual

**Escenario**: Pagas $15,000 de gym el día 5 de cada mes

**Configuración**:
```
Nombre: Gimnasio
Categoría: 🏋️ Gym
Monto: 15000
Moneda: ARS
Frecuencia: Mensual
Día del mes: 5
Fecha inicio: 2025-01-01
Cuenta bancaria: Banco Galicia
```

**Resultado**: 
- Cada día 5 se generará automáticamente un gasto de $15,000
- Aparecerá en "Gastos del Mes" con categoría Gym
- Se descontará de la cuenta bancaria seleccionada

---

### 2. Netflix Mensual

**Escenario**: Suscripción a Netflix de $5,000 que se cobra el día 15

**Configuración**:
```
Nombre: Netflix Premium
Categoría: 📺 Suscripciones
Monto: 5000
Moneda: ARS
Frecuencia: Mensual
Día del mes: 15
Fecha inicio: 2025-01-01
```

**Resultado**: 
- Se generará automáticamente cada 15 de mes
- Puedes ver cuánto gastas al año: $60,000

---

### 3. Seguro de Auto Anual

**Escenario**: Pagas seguro de auto $120,000 una vez al año

**Configuración**:
```
Nombre: Seguro Auto
Categoría: 🛡️ Seguros
Monto: 120000
Moneda: ARS
Frecuencia: Anual
Fecha inicio: 2025-03-15 (fecha del próximo pago)
```

**Resultado**: 
- Se generará una vez al año el 15 de marzo
- No afecta tus estadísticas mensuales normales

---

### 4. Alquiler con Fecha de Fin

**Escenario**: Alquiler mensual hasta que te mudes (6 meses)

**Configuración**:
```
Nombre: Alquiler Depto
Categoría: 🏠 Alquiler
Monto: 80000
Moneda: ARS
Frecuencia: Mensual
Día del mes: 1
Fecha inicio: 2025-01-01
Fecha fin: 2025-06-30
```

**Resultado**: 
- Se generará el día 1 de cada mes
- Se detendrá automáticamente después del 30 de junio

---

### 5. Combustible Semanal

**Escenario**: Cargas nafta todas las semanas

**Configuración**:
```
Nombre: Nafta
Categoría: 🚗 Transporte
Monto: 25000
Moneda: ARS
Frecuencia: Semanal
Fecha inicio: 2025-01-06 (próximo lunes)
```

**Resultado**: 
- Se generará cada 7 días
- Aparecerá en tus estadísticas semanales

---

## 🛠️ Gestión de Gastos Recurrentes

### Pausar temporalmente

Si te vas de viaje y no usarás el gym por 2 meses:

1. Ve a "Gastos Fijos"
2. Encuentra "Gimnasio"
3. Haz clic en "⏸️ Pausar"
4. Los gastos no se generarán hasta que lo reactives

### Editar monto

Si aumenta el precio de Netflix:

1. Ve a "Gastos Fijos"
2. Encuentra "Netflix"
3. Haz clic en "✏️ Editar"
4. Cambia el monto
5. Los próximos gastos tendrán el nuevo monto

### Eliminar completamente

Si cancelas una suscripción:

1. Ve a "Gastos Fijos"
2. Encuentra la suscripción
3. Haz clic en "🗑️ Eliminar"
4. Los gastos ya generados NO se eliminarán (quedan en el historial)

---

## 📊 Estadísticas y Análisis

### Ver gasto mensual en servicios

```
Filtra por categoría: "💡 Servicios"
Suma los gastos recurrentes mensuales
```

Ejemplo:
- Internet: $8,000
- Luz: $12,000
- Gas: $6,000
- Agua: $3,000
**Total mensual servicios: $29,000**

### Proyección anual

Multiplica tus gastos recurrentes mensuales por 12:

```
Total mensual recurrente: $150,000
Total anual: $1,800,000
```

Puedes ver esto en las tarjetas de estadísticas:
- 💰 Total Mensual: $150,000
- 📅 Total Anual: $1,800,000

---

## 🎨 Ejemplos de Configuración Completa

### Setup de Estudiante

```javascript
[
  {
    nombre: "Spotify",
    categoria: "Suscripciones",
    monto: 1500,
    frecuencia: "Mensual",
    dia: 10
  },
  {
    nombre: "Netflix",
    categoria: "Suscripciones",
    monto: 5000,
    frecuencia: "Mensual",
    dia: 15
  },
  {
    nombre: "Gym",
    categoria: "Gym",
    monto: 12000,
    frecuencia: "Mensual",
    dia: 5
  },
  {
    nombre: "Internet",
    categoria: "Servicios",
    monto: 8000,
    frecuencia: "Mensual",
    dia: 20
  }
]
// Total mensual: $26,500
```

### Setup de Profesional

```javascript
[
  {
    nombre: "Alquiler",
    categoria: "Alquiler",
    monto: 80000,
    frecuencia: "Mensual",
    dia: 1
  },
  {
    nombre: "Seguro Auto",
    categoria: "Seguros",
    monto: 15000,
    frecuencia: "Mensual",
    dia: 10
  },
  {
    nombre: "Obra Social",
    categoria: "Salud",
    monto: 25000,
    frecuencia: "Mensual",
    dia: 5
  },
  {
    nombre: "Nafta",
    categoria: "Transporte",
    monto: 30000,
    frecuencia: "Semanal"
  },
  {
    nombre: "Luz + Gas + Agua",
    categoria: "Servicios",
    monto: 20000,
    frecuencia: "Mensual",
    dia: 15
  }
]
// Total mensual fijo: $140,000
// Total mensual variable (nafta): $120,000
// Total general: $260,000
```

---

## 💡 Tips y Trucos

### 1. Agrupa gastos similares

En vez de crear:
- "Luz" - $8,000
- "Gas" - $6,000
- "Agua" - $4,000

Puedes crear:
- "Servicios Básicos" - $18,000

### 2. Usa descripciones claras

❌ Mal:
```
Nombre: S
Descripción: (vacío)
```

✅ Bien:
```
Nombre: Spotify Premium
Descripción: Suscripción familiar para 6 personas
```

### 3. Revisa mensualmente

Al final de cada mes:
1. Ve a "Gastos Fijos"
2. Revisa que todos estén activos
3. Actualiza montos si hubo cambios
4. Elimina los que ya no uses

### 4. Usa fechas de fin

Si sabes que un gasto es temporal:
```
Fecha inicio: 2025-01-01
Fecha fin: 2025-06-30
```

Así no tienes que acordarte de eliminarlo.

---

## 📱 Flujo de Trabajo Recomendado

### Al inicio del mes
1. Ve a "Gastos Fijos"
2. Haz clic en "🔄 Generar Ahora"
3. Revisa que se hayan generado todos
4. Ve a "Gastos del Mes" y marca como pagados

### Cuando contratas un servicio nuevo
1. Ve a "Gastos Fijos"
2. Haz clic en "+ Nuevo Gasto Fijo"
3. Completa toda la información
4. Guarda

### Cuando cancelas un servicio
1. Ve a "Gastos Fijos"
2. Encuentra el servicio
3. Opción A: Pausa si es temporal
4. Opción B: Elimina si es definitivo

---

## 🔍 Consultas SQL Útiles

### Ver todos mis gastos recurrentes

```sql
SELECT 
  name,
  amount,
  currency,
  frequency,
  day_of_month,
  next_generation_date,
  is_active
FROM recurring_expenses
WHERE user_id = 'tu-user-id'
ORDER BY amount DESC;
```

### Ver gastos generados este mes

```sql
SELECT 
  e.description,
  e.amount,
  e.date,
  r.name as recurring_name
FROM expenses e
JOIN recurring_expenses r ON e.recurring_expense_id = r.id
WHERE e.user_id = 'tu-user-id'
AND EXTRACT(MONTH FROM e.date) = EXTRACT(MONTH FROM CURRENT_DATE)
AND EXTRACT(YEAR FROM e.date) = EXTRACT(YEAR FROM CURRENT_DATE)
ORDER BY e.date;
```

### Proyección de próximos gastos

```sql
SELECT 
  name,
  amount,
  next_generation_date,
  frequency
FROM recurring_expenses
WHERE user_id = 'tu-user-id'
AND is_active = true
AND next_generation_date > CURRENT_DATE
ORDER BY next_generation_date
LIMIT 10;
```

---

## 🎓 Preguntas Frecuentes

### ¿Puedo tener gastos en diferentes monedas?
Sí, cada gasto recurrente puede tener su propia moneda (USD, EUR, ARS, BRL).

### ¿Se pueden editar los gastos ya generados?
Sí, los gastos generados aparecen en "Gastos del Mes" y se pueden editar o eliminar individualmente sin afectar el gasto recurrente.

### ¿Qué pasa si mi banco me cobra en una fecha diferente?
Puedes editar el gasto recurrente y cambiar el "Día del mes" cuando quieras.

### ¿Se pueden crear gastos recurrentes con cuotas?
No directamente, pero puedes:
1. Crear un gasto normal con cuotas
2. Luego crear un gasto recurrente para futuras compras

### ¿Puedo ver el historial de gastos generados?
Sí, en "Gastos del Mes" filtra por categoría o búscate por nombre del gasto recurrente.

---

## 🚀 Siguiente Nivel

### Integración con notificaciones
```javascript
// Cuando se genera un gasto recurrente
showNotification({
  title: "Gasto Generado",
  message: `Se generó automáticamente: ${nombre} - $${monto}`,
  type: "info"
});
```

### Predicción de gastos futuros
```javascript
// Calcular gastos de los próximos 3 meses
const futureExpenses = recurringExpenses
  .filter(e => e.is_active)
  .map(e => ({
    name: e.name,
    occurrences: e.frequency === 'monthly' ? 3 : e.frequency === 'weekly' ? 12 : 0.25,
    total: e.amount * occurrences
  }));
```

### Dashboard personalizado
Crea tu propio dashboard con:
- Gráfica de gastos fijos vs variables
- Tendencia mensual
- Alertas de gastos altos
- Comparación con meses anteriores
