# 🧪 Guía de Testing Mobile - Paso a Paso

## 📱 Cómo Probar el Diseño Responsive

### Opción 1: Chrome DevTools (Recomendado para desarrollo)

#### Paso 1: Abrir DevTools
1. Presiona `F12` o `Ctrl + Shift + I` (Windows)
2. Click en el icono de dispositivo móvil (Toggle Device Toolbar) o `Ctrl + Shift + M`

#### Paso 2: Seleccionar Dispositivos
Prueba estos dispositivos en orden:

**📱 Móviles Pequeños**
- iPhone SE (375x667) - Para verificar diseño compacto
- Galaxy S8+ (360x740) - Android pequeño

**📱 Móviles Grandes**
- iPhone 12 Pro (390x844) - Estándar actual
- Pixel 5 (393x851) - Android moderno

**📱 Tablets**
- iPad Air (820x1180) - Tablet mediano
- iPad Pro 11" (834x1194) - Tablet profesional
- Surface Pro 7 (912x1368) - Tablet Windows

**💻 Desktop**
- 1920x1080 - Full HD estándar
- 1366x768 - Laptop común

#### Paso 3: Testing Checklist por Página

### 🏠 Página de INICIO
```
Responsive Mode: ON
Dispositivo: iPhone 12 Pro (390x844)

✓ Verificar:
  [ ] Header se muestra completo
  [ ] Logo y navegación legibles
  [ ] Botones táctiles (min 44px)
  [ ] Sin scroll horizontal
  [ ] Imágenes se adaptan
```

### 💰 Página de DEUDAS

#### Test 1: Summary Cards (Tarjetas Resumen)
```
Dispositivo: iPhone SE (375x667)

✓ Acciones:
1. Hacer click en "Debo" → Debe mostrar efecto ripple
2. Hacer click en "Me Deben" → Debe animar suavemente
3. Hacer click en "Total" → Debe responder al toque

✓ Verificar:
  [ ] Tarjetas se apilan verticalmente (1 columna)
  [ ] Efecto ripple visible al presionar
  [ ] Animación scale(0.97) en :active
  [ ] Iconos y números legibles
  [ ] Sin superposición de elementos
```

#### Test 2: Tabs (Pestañas)
```
Dispositivo: Galaxy S21 (360x800)

✓ Acciones:
1. Presionar cada tab (Todas, Virtuales, Físicas, YoDebo)
2. Mantener presionado 1 segundo
3. Cambiar rápidamente entre tabs

✓ Verificar:
  [ ] Tabs en diseño vertical (640px)
  [ ] Iconos arriba de texto
  [ ] Área táctil mínima 44px
  [ ] Transición suave entre tabs
  [ ] Color activo visible
```

#### Test 3: Lista de Deudas
```
Dispositivo: iPhone 12 Pro (390x844)

✓ Acciones:
1. Scroll vertical por la lista
2. Presionar botón "Marcar como Pagado"
3. Presionar botón "Editar"
4. Presionar botón "Eliminar"

✓ Verificar:
  [ ] Scroll fluido sin lag
  [ ] Botones táctiles separados
  [ ] Feedback visual al presionar
  [ ] Modales se abren correctamente
  [ ] Sin elementos cortados
```

#### Test 4: Formulario de Deuda
```
Dispositivo: iPhone SE (375x667)

✓ Acciones:
1. Abrir "Nueva Deuda"
2. Hacer focus en cada input
3. Llenar formulario completo
4. Presionar "Guardar"

✓ Verificar:
  [ ] Inputs no causan zoom (iOS)
  [ ] Keyboard no oculta campos
  [ ] Botones en column-reverse
  [ ] "Cancelar" abajo, "Guardar" arriba
  [ ] Validación visible
```

### 💸 Página de GASTOS

#### Test 1: Tabs de Gastos
```
Dispositivo: Pixel 5 (393x851)

✓ Acciones:
1. Cambiar a "Gastos del Mes"
2. Cambiar a "Gastos Fijos"
3. Observar animación

✓ Verificar:
  [ ] Efecto ripple en tabs
  [ ] Icono + texto verticales (768px)
  [ ] Active state claramente visible
  [ ] Transición cubic-bezier suave
```

#### Test 2: Filtros y Ordenamiento
```
Dispositivo: iPhone 12 Pro (390x844)

✓ Acciones:
1. Abrir filtros de fecha
2. Cambiar ordenamiento
3. Aplicar filtros

✓ Verificar:
  [ ] Filtros full-width en móvil
  [ ] Dropdowns táctiles
  [ ] Resultados se actualizan
  [ ] Loading states visibles
```

### 🔄 Gastos Recurrentes

#### Test 1: Formulario de Gastos Fijos
```
Dispositivo: iPhone SE (375x667)

✓ Acciones:
1. Click "Agregar Gasto Fijo"
2. Seleccionar categoría (Grid de 10)
3. Elegir frecuencia
4. Seleccionar banco
5. Guardar

✓ Verificar:
  [ ] Grid 1 columna (768px)
  [ ] Categorías táctiles (44px min)
  [ ] Inputs font-size 16px
  [ ] No zoom al hacer focus
  [ ] Botones full-width
  [ ] Actions en column-reverse
```

#### Test 2: Panel de Gestión
```
Dispositivo: iPad Air (820x1180)

✓ Acciones:
1. Ver tarjetas de estadísticas
2. Presionar "Generar Ahora"
3. Editar un gasto
4. Pausar un gasto
5. Eliminar un gasto

✓ Verificar:
  [ ] Stats en 2 columnas (tablet)
  [ ] Cards con efecto hover
  [ ] Botones separados (column)
  [ ] Iconos legibles
  [ ] Confirmaciones modales
```

### 📊 Estadísticas Cards

#### Test Universal
```
Todos los dispositivos

✓ Acciones:
1. Presionar cada stat card
2. Mantener presionado
3. Observar animaciones

✓ Verificar:
  [ ] Scale(0.98) en :active
  [ ] Opacity 0.9 feedback
  [ ] Sin hover en táctiles
  [ ] Gradientes visibles
  [ ] Iconos alineados
```

---

## 🎨 Testing Visual Específico

### Efecto Ripple
```css
✓ Debe verse:
- Círculo que crece desde el centro
- Color rgba(102, 126, 234, 0.2)
- Animación de 0.6s
- Sin cortes o overflows

❌ No debe verse:
- Cuadrados o formas irregulares
- Ripple fuera del elemento
- Lag o stuttering
```

### Animaciones Scale
```css
✓ Debe verse:
- Transform scale(0.97) instantáneo
- Retorno suave al soltar
- Sin saltos o jumps

❌ No debe verse:
- Scale en desktop hover
- Elementos que se achican permanentemente
```

---

## 🔍 Testing de Accesibilidad

### Touch Targets (Objetivos Táctiles)
```
Herramienta: Chrome DevTools > More Tools > CSS Overview

✓ Verificar:
1. Todos los botones ≥ 44x44px
2. Links ≥ 44x44px
3. Inputs ≥ 44px altura
4. Checkboxes/Radios ≥ 44x44px

⚠️ Excepciones permitidas:
- Iconos en grupos (con spacing 8px+)
- Elementos en toolbars (si hay spacing)
```

### Contraste de Color
```
Herramienta: Lighthouse > Accessibility

✓ Verificar:
[ ] Ratio contraste texto ≥ 4.5:1
[ ] Ratio contraste UI ≥ 3:1
[ ] Texto sobre gradientes legible
[ ] Estados disabled visibles
```

---

## 🚨 Problemas Comunes y Soluciones

### ❌ Problema 1: Zoom en iOS
```
Síntoma: Input hace zoom al hacer focus

Test:
1. iPhone con Safari
2. Focus en cualquier input
3. Si hace zoom → Problema

Solución Ya Implementada:
input { font-size: 16px !important; }
```

### ❌ Problema 2: Hover Permanente en Táctiles
```
Síntoma: Elemento queda con estilo hover después de tap

Test:
1. Dispositivo táctil
2. Tap en botón
3. Si queda azul/resaltado → Problema

Solución Ya Implementada:
@media (hover: none) and (pointer: coarse) {
  .elemento:hover { transform: none; }
}
```

### ❌ Problema 3: Scroll Horizontal
```
Síntoma: Se puede hacer scroll horizontal

Test:
1. Cualquier dispositivo móvil
2. Swipe horizontal
3. Si se desplaza → Problema

Verificar:
body { overflow-x: hidden; }
.container { max-width: 100%; }
```

---

## 📸 Screenshots Sugeridos

Tomar capturas en estos breakpoints:

### Mobile Small (500px)
- Debts: Lista + Formulario
- Expenses: Tabs verticales
- Recurring: Grid 1 columna

### Mobile Large (768px)
- Debts: Summary cards apiladas
- Expenses: Filtros full-width
- Recurring: Panel completo

### Tablet (1024px)
- Debts: Grid 2 columnas
- Expenses: Tabs horizontales compactos
- Recurring: Stats grid

### Desktop (1920px)
- Todas las páginas en layout completo

---

## ⚡ Performance Testing

### FPS (Frames Per Second)
```
Herramienta: Chrome DevTools > Performance

1. Iniciar grabación
2. Hacer scroll rápido
3. Cambiar tabs múltiples veces
4. Abrir/cerrar modales
5. Detener grabación

✓ Verificar:
[ ] FPS ≥ 55 constantemente
[ ] Sin drops a < 30 FPS
[ ] Layout shifts mínimos
```

### Network Throttling
```
Herramienta: Chrome DevTools > Network > Throttling

Test con:
- Fast 3G
- Slow 3G

✓ Verificar:
[ ] App carga en < 5s
[ ] Imágenes lazy load
[ ] Sin timeout errors
[ ] Loading states visibles
```

---

## 📋 Checklist Final Pre-Deploy

### Testing Mínimo
- [ ] Chrome Desktop (1920x1080)
- [ ] Chrome Mobile (iPhone 12 Pro)
- [ ] Chrome Mobile (Pixel 5)
- [ ] Chrome Tablet (iPad Air)
- [ ] Safari iOS (iPhone real)
- [ ] Chrome Android (Teléfono real)

### Testing Completo
- [ ] Todos los navegadores (Chrome, Safari, Firefox, Edge)
- [ ] Todos los dispositivos (iOS, Android, Tablets)
- [ ] Modo landscape y portrait
- [ ] Modo oscuro (si aplica)
- [ ] Con/sin internet
- [ ] Performance audit 90+

### Funcionalidad
- [ ] Todos los botones responden
- [ ] Todos los forms se pueden llenar
- [ ] Todos los modales se abren/cierran
- [ ] Todas las animaciones fluidas
- [ ] Sin errores en consola

---

## 🎯 Criterios de Aceptación

### ✅ PASA si:
- Efecto ripple se ve en todos los elementos
- Touch targets ≥ 44px
- No hay zoom en iOS inputs
- Animaciones fluidas 60fps
- Layouts se adaptan correctamente
- Sin scroll horizontal
- Todos los textos legibles
- Botones fáciles de presionar

### ❌ FALLA si:
- Elementos cortados en móvil
- Botones muy pequeños (< 44px)
- Inputs causan zoom en iOS
- Hover permanente en táctiles
- Animaciones con lag
- Scroll horizontal no deseado
- Texto muy pequeño
- Elementos superpuestos

---

## 📱 Testing en Dispositivo Real

### iOS (Safari)
```bash
1. Conectar iPhone a Mac
2. Safari > Develop > [Tu iPhone]
3. Abrir app en iPhone
4. Inspeccionar remotamente

Verificar específicamente:
- Font-size mínimo 16px
- Touch callout
- Scroll momentum
- Keyboard behavior
```

### Android (Chrome)
```bash
1. Conectar Android a PC
2. Habilitar USB Debugging
3. chrome://inspect en Chrome
4. Seleccionar dispositivo

Verificar específicamente:
- Material animations
- Overflow scrolling
- Touch feedback
- System gestures
```

---

## 🔗 Recursos Útiles

### Herramientas Online
- [Responsive Design Checker](https://responsivedesignchecker.com/)
- [BrowserStack](https://www.browserstack.com/) - Testing real
- [LambdaTest](https://www.lambdatest.com/) - Cross-browser

### Extensiones Chrome
- [Mobile Simulator](https://chrome.google.com/webstore/detail/mobile-simulator)
- [Responsive Viewer](https://chrome.google.com/webstore/detail/responsive-viewer)
- [Accessibility Insights](https://accessibilityinsights.io/)

### Lighthouse Audits
```bash
# Desde CLI
npm install -g lighthouse
lighthouse http://localhost:5175 --view --preset=desktop
lighthouse http://localhost:5175 --view --preset=mobile
```

---

**Happy Testing! 🧪✨**

Si encuentras algún problema, documéntalo con:
1. Screenshot/Video
2. Dispositivo y navegador
3. Pasos para reproducir
4. Comportamiento esperado vs actual
