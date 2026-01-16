# 💰 DebtTracker - Programa de Gestión de Deudas y Gastos

Una aplicación SPA profesional para gestionar gastos personales, deudas entre amigos y cuotas, construida con React + Vite y Supabase.

## 🚀 Características

### Autenticación
- ✅ Registro con nickname único auto-generado
- ✅ Login con email y contraseña
- ✅ Sesión persistente
- ✅ Cambio de contraseña

### Gestión de Gastos
- ✅ Registro de gastos con categorías y fuentes de pago
- ✅ Soporte para pagos en cuotas
- ✅ Filtros por mes/año
- ✅ Estados: pendiente, pagado, vencido

### Sistema de Amigos
- ✅ Búsqueda por nickname único
- ✅ Envío de solicitudes de amistad
- ✅ Aceptar/Rechazar solicitudes
- ✅ Lista de amigos

### Deudas entre Amigos
- ✅ Crear deudas a amigos
- ✅ Aceptar/Rechazar deudas
- ✅ Marcar como pagada
- ✅ Resumen de deudas (debo/me deben)

### Dashboard
- ✅ Estadísticas del mes
- ✅ Gráficos de categorías
- ✅ Próximos pagos
- ✅ Resumen de deudas

### Panel de Administración
- ✅ Dashboard de administración
- ✅ Gestión de usuarios
- ✅ Configuración del sitio
- ✅ Acceso solo para superadmins

## 🛠️ Tecnologías

- **Frontend:** React 18 + Vite
- **Estilos:** CSS Modules
- **Routing:** React Router DOM v6
- **Backend:** Supabase (Auth, Database, Realtime)
- **Gráficos:** Recharts
- **Utilidades:** date-fns, uuid

## 📦 Instalación

### 1. Clonar e instalar dependencias

```bash
cd "Programa de deudas"
npm install
```

### 2. Configurar Supabase

1. Crear un proyecto en [Supabase](https://supabase.com)
2. Ir a SQL Editor y ejecutar el contenido de `supabase_schema.sql`
3. Copiar `.env.example` a `.env` y completar:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

### 3. Ejecutar en desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

## 📁 Estructura del Proyecto

```
src/
├── components/         # Componentes reutilizables
│   ├── Button/
│   ├── Card/
│   ├── Input/
│   ├── Modal/
│   ├── Select/
│   └── ...
├── context/           # Contextos de React (estado global)
│   ├── AuthContext.jsx
│   ├── ExpensesContext.jsx
│   ├── FriendsContext.jsx
│   ├── DebtsContext.jsx
│   └── UIContext.jsx
├── layouts/           # Layouts de la aplicación
│   ├── AuthLayout/
│   ├── DashboardLayout/
│   └── AdminLayout/
├── pages/             # Páginas de la aplicación
│   ├── Login/
│   ├── Register/
│   ├── Dashboard/
│   ├── Expenses/
│   ├── Debts/
│   ├── Friends/
│   ├── Statistics/
│   ├── Installments/
│   ├── Profile/
│   ├── Settings/
│   └── Admin/
├── services/          # Servicios de API
│   ├── supabase.js
│   ├── authService.js
│   ├── friendsService.js
│   ├── expensesService.js
│   ├── debtsService.js
│   └── adminService.js
├── styles/            # Estilos globales
│   ├── globals.css
│   └── components.css
├── App.jsx            # Componente principal con rutas
└── main.jsx           # Entry point
```

## 🎨 Personalización

### Colores
Edita las variables CSS en `src/styles/globals.css`:

```css
:root {
  --primary: #6366f1;
  --secondary: #8b5cf6;
  /* ... */
}
```

### Configuración del Sitio
Como superadmin, accede a `/admin/config` para cambiar:
- Nombre del sitio
- Moneda
- Color principal
- Permitir registros

## 👤 Crear Super Admin

Después de registrar el primer usuario, ejecuta en Supabase SQL Editor:

```sql
UPDATE public.profiles
SET is_superadmin = true
WHERE email = 'tu-email@ejemplo.com';
```

## 📱 Responsive

La aplicación está diseñada para funcionar en:
- 🖥️ Desktop (1200px+)
- 💻 Laptop (900px - 1200px)
- 📱 Tablet (600px - 900px)
- 📱 Mobile (< 600px)

## 🔒 Seguridad

- Row Level Security (RLS) habilitado en todas las tablas
- Los usuarios solo pueden ver/editar sus propios datos
- Las deudas solo son visibles para acreedor y deudor
- Panel de admin restringido a superadmins

## 📝 Licencia

MIT © 2024
