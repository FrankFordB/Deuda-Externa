# 🤝 Sistema de Gastos Compartidos - Documentación

## 📋 Resumen

Sistema completo de gastos compartidos estilo Splitwise/Tricount integrado nativamente en la aplicación de finanzas personales.

## 🚀 Instalación

### 1. Ejecutar el SQL en Supabase

Copia y ejecuta el contenido de `supabase/CREATE_SHARED_EXPENSES.sql` en el SQL Editor de Supabase.

Este script crea:
- 7 tablas nuevas
- Políticas RLS completas
- Triggers para cálculo automático de balances
- Categorías por defecto

### 2. Verificar la instalación

Después de ejecutar el SQL, verifica que las tablas se crearon:

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%expense%' OR table_name LIKE '%group%' OR table_name LIKE '%settlement%';
```

## 📁 Estructura de Archivos

```
src/
├── pages/
│   └── SharedExpenses/
│       ├── index.js
│       ├── SharedExpenses.jsx    # Componente principal
│       └── SharedExpenses.css    # Estilos
├── services/
│   └── sharedExpensesService.js  # Lógica de negocio
supabase/
└── CREATE_SHARED_EXPENSES.sql    # Schema de base de datos
```

## 🎯 Funcionalidades

### Gestión de Grupos
- ✅ Crear grupos de gastos con nombre, descripción y categoría
- ✅ Editar información del grupo
- ✅ Eliminar grupos (soft delete)
- ✅ Ver lista de grupos con resumen de balance

### Miembros
- ✅ Agregar amigos reales (usuarios del sistema)
- ✅ Agregar amigos virtuales/ficticios
- ✅ Remover miembros del grupo
- ✅ Roles: Admin y Miembro

### Registro de Gastos
- ✅ Registrar gasto con descripción, monto, categoría y fecha
- ✅ Opción de un solo pagador
- ✅ Opción de múltiples pagadores con montos parciales
- ✅ División en partes iguales
- ✅ División con montos personalizados
- ✅ Categorías personalizables con botón + para agregar nuevas

### Balances y Liquidaciones
- ✅ Cálculo automático de balances por miembro
- ✅ Vista de quién debe y a quién le deben
- ✅ Sugerencias de liquidación optimizadas
- ✅ Registro de liquidaciones

### Integración con Finanzas Personales
- ✅ Modal de confirmación al registrar un gasto
- ✅ Opción de registrar como gasto personal
- ✅ Opción de descontar de cuenta bancaria

## 🗄️ Modelo de Datos

### expense_groups
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| name | TEXT | Nombre del grupo |
| description | TEXT | Descripción opcional |
| category | TEXT | Categoría del grupo |
| created_by | UUID | FK → profiles |
| total_spent | DECIMAL | Total gastado |
| currency | TEXT | Moneda (ARS, USD, etc.) |

### expense_group_members
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| group_id | UUID | FK → expense_groups |
| user_id | UUID | FK → profiles (nullable) |
| virtual_friend_id | UUID | FK → virtual_friends (nullable) |
| role | TEXT | 'admin' o 'member' |
| balance | DECIMAL | Saldo actual en el grupo |

### shared_expenses
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| group_id | UUID | FK → expense_groups |
| description | TEXT | Descripción del gasto |
| total_amount | DECIMAL | Monto total |
| category | TEXT | Categoría |
| expense_date | DATE | Fecha del gasto |
| split_type | TEXT | 'equal', 'custom', 'percentage' |
| is_settled | BOOLEAN | ¿Está saldado? |

### shared_expense_payers
Registra quién pagó y cuánto.

### shared_expense_splits
Registra cuánto debe cada miembro.

### group_settlements
Registra las liquidaciones entre miembros.

## 🎨 Diseño UI

El diseño sigue el mismo patrón visual que el componente Friends:
- Header con gradiente
- Cards con hover effects
- Tabs para navegación
- Modales consistentes
- Paleta de colores indigo/violeta

## 🔧 Uso del Servicio

```javascript
import sharedExpensesService from './services/sharedExpensesService';

// Obtener grupos del usuario
const { groups } = await sharedExpensesService.getUserGroups(userId);

// Crear un grupo
const { group } = await sharedExpensesService.createGroup(userId, {
  name: 'Viaje a la Costa',
  description: 'Gastos del viaje',
  category: 'viaje'
});

// Agregar un miembro
await sharedExpensesService.addMember(groupId, friendUserId);

// Crear un gasto compartido
await sharedExpensesService.createSharedExpense(userId, {
  groupId: 'xxx',
  description: 'Cena',
  totalAmount: 5000,
  splitType: 'equal',
  payers: [{ memberId: 'yyy', amount: 5000 }]
});

// Obtener balances
const { balances, settlements } = await sharedExpensesService.getGroupBalances(groupId);
```

## 📱 Acceso

El módulo está disponible desde el sidebar en la sección "Principal":
- Ruta: `/shared-expenses`
- Icono: 🤝

## 🔒 Seguridad

- RLS habilitado en todas las tablas
- Solo miembros del grupo pueden ver sus datos
- Solo admins pueden agregar/remover miembros
- Solo el creador puede eliminar el grupo

## 🚧 Próximas Mejoras

- [ ] Notificaciones cuando alguien agrega un gasto
- [ ] Historial de actividad del grupo
- [ ] Exportar resumen a PDF
- [ ] Adjuntar comprobantes/fotos
- [ ] Repetir gastos recurrentes en grupo
