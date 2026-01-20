# 🔧 Guía para Arreglar el Error de Registro

## ❌ Error Actual
```
POST .../auth/v1/signup 500 (Internal Server Error)
AuthApiError: Database error saving new user
```

## ✅ Solución

### Paso 1: Ir a Supabase Dashboard
1. Abre https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Ve a la sección **SQL Editor** en el menú lateral

### Paso 2: Ejecutar Script de Corrección

**Opción A - Script Completo (Recomendado):**
```
Archivo: FIX_REGISTRO_COMPLETO.sql
```
- ✅ Verifica/agrega todas las columnas necesarias
- ✅ Crea la política de INSERT
- ✅ Recrea la función con manejo de errores
- ✅ Recrea el trigger
- ✅ Muestra información de verificación

**Opción B - Script Rápido:**
```
Archivo: FIX_REGISTRO.sql
```
- ✅ Crea la política de INSERT
- ✅ Recrea función y trigger con manejo de errores
- ✅ Verifica el estado

### Paso 3: Ejecutar en SQL Editor
1. Copia TODO el contenido del archivo elegido
2. Pégalo en el SQL Editor
3. Click en **RUN** (o Ctrl+Enter)
4. Espera a que termine (verás mensajes de éxito)

### Paso 4: Verificar Resultado
Deberías ver algo como:
```
✅ POLÍTICA DE INSERT CREADA
✅ Trigger activo: on_auth_user_created
```

### Paso 5: Probar Registro
1. Vuelve a tu aplicación en http://localhost:5176
2. Intenta registrar un nuevo usuario
3. Debería funcionar correctamente

---

## 🔍 ¿Qué Hace el Script?

### 1. **Elimina políticas viejas de INSERT**
```sql
DROP POLICY IF EXISTS "System can create profiles" ON public.profiles;
```

### 2. **Crea la política correcta**
```sql
CREATE POLICY "System can create profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (true);
```
- Permite que el trigger del sistema inserte perfiles
- Sin esta política, el trigger falla con 500

### 3. **Recrea la función con manejo de errores**
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
...
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creando perfil: %', SQLERRM;
    RETURN NEW;
END;
```
- Si algo falla, registra el error pero no bloquea el registro
- Usa `SECURITY DEFINER` para ejecutar con permisos elevados

### 4. **Recrea el trigger**
```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```
- Se ejecuta automáticamente cuando se crea un usuario en auth.users
- Crea el perfil en public.profiles con los datos del metadata

---

## 🚨 Si Sigue Fallando

### Verificar en SQL Editor:
```sql
-- Ver si la política existe
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'profiles' AND cmd = 'INSERT';
```
Debería mostrar: `System can create profiles | INSERT`

```sql
-- Ver si el trigger existe
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';
```
Debería mostrar: `on_auth_user_created | O` (O = activo)

### Verificar columnas de profiles:
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;
```
Debe incluir: `id`, `email`, `nickname`, `first_name`, `last_name`, `birth_date`, `country`

---

## 📝 Causa del Problema

1. **Tabla `profiles` tiene RLS (Row Level Security) activo**
2. **Solo había políticas para SELECT, UPDATE, DELETE**
3. **Faltaba política para INSERT**
4. **El trigger `handle_new_user` intenta insertar pero es bloqueado por RLS**
5. **Resultado: Error 500 "Database error saving new user"**

---

## ✅ Después de Aplicar

El flujo será:
1. Usuario llena formulario de registro
2. Frontend envía datos a Supabase Auth
3. Auth crea usuario en `auth.users`
4. **Trigger `on_auth_user_created` se activa automáticamente**
5. **Política permite la inserción del perfil**
6. Se crea perfil en `public.profiles` con los datos del metadata
7. Usuario registrado exitosamente ✅

---

## 🎯 Resultado Final

- ✅ Usuarios pueden registrarse
- ✅ Perfil se crea automáticamente
- ✅ Nickname se genera si no se proporciona
- ✅ Todos los campos se guardan correctamente
