/**
 * DIAGNÓSTICO - Sistema Multi-Moneda
 * 
 * Copia y pega este código en la consola del navegador (F12 → Console)
 * Te dirá exactamente qué está fallando
 */

console.clear();
console.log('%c🔍 INICIANDO DIAGNÓSTICO...', 'background: #0066ff; color: white; padding: 10px; font-size: 16px; font-weight: bold;');
console.log('');

// 1. Verificar que estamos en la página correcta
console.log('%c1. VERIFICANDO UBICACIÓN', 'background: #333; color: #fff; padding: 5px;');
console.log('URL actual:', window.location.href);
console.log('Pathname:', window.location.pathname);
console.log('');

// 2. Verificar que React está montado
console.log('%c2. VERIFICANDO REACT', 'background: #333; color: #fff; padding: 5px;');
const reactRoot = document.getElementById('root');
if (reactRoot) {
  console.log('✅ React root encontrado');
  console.log('Contenido HTML:', reactRoot.innerHTML.substring(0, 200) + '...');
} else {
  console.log('❌ React root NO encontrado');
}
console.log('');

// 3. Verificar CurrencyTabs en el DOM
console.log('%c3. BUSCANDO COMPONENTES DE MONEDA', 'background: #333; color: #fff; padding: 5px;');

// Buscar por clases CSS comunes
const currencyElements = document.querySelectorAll('[class*="currency"]');
console.log(`Encontrados ${currencyElements.length} elementos con "currency" en className`);
currencyElements.forEach((el, i) => {
  console.log(`  ${i + 1}. ${el.tagName} - ${el.className}`);
});
console.log('');

// Buscar botones con emojis de moneda
const buttons = Array.from(document.querySelectorAll('button'));
const currencyButtons = buttons.filter(btn => 
  /💰|💵|💶/.test(btn.textContent)
);
if (currencyButtons.length > 0) {
  console.log(`✅ Encontrados ${currencyButtons.length} botones de moneda:`);
  currencyButtons.forEach((btn, i) => {
    console.log(`  ${i + 1}. ${btn.textContent} - ${btn.className}`);
  });
} else {
  console.log('❌ NO se encontraron botones de moneda (💰, 💵, 💶)');
}
console.log('');

// 4. Verificar errores en consola
console.log('%c4. ERRORES RECIENTES', 'background: #333; color: #fff; padding: 5px;');
console.log('⚠️ Revisa arriba si hay errores en rojo');
console.log('Los errores más comunes son:');
console.log('  • "column currency does not exist" → No ejecutaste add_multi_currency.sql');
console.log('  • "Cannot read property of undefined" → Problema de importación');
console.log('  • "Module not found" → Falta un archivo');
console.log('');

// 5. Verificar imports de componentes
console.log('%c5. VERIFICANDO MÓDULOS', 'background: #333; color: #fff; padding: 5px;');
if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
  console.log('✅ React DevTools detectado');
} else {
  console.log('⚠️ React DevTools no detectado (instala la extensión para mejor diagnóstico)');
}
console.log('');

// 6. Test de Supabase
console.log('%c6. VERIFICANDO BASE DE DATOS', 'background: #333; color: #fff; padding: 5px;');
console.log('Ejecuta esta query en Supabase SQL Editor:');
console.log('%cSELECT column_name FROM information_schema.columns WHERE table_name = \'expenses\' AND column_name IN (\'currency\', \'currency_symbol\');', 'background: #f0f0f0; color: #000; padding: 5px; font-family: monospace;');
console.log('');
console.log('Deberías ver:');
console.log('  currency');
console.log('  currency_symbol');
console.log('');
console.log('Si NO aparecen → No ejecutaste add_multi_currency.sql');
console.log('');

// 7. Resumen
console.log('%c📊 RESUMEN DEL DIAGNÓSTICO', 'background: #0066ff; color: white; padding: 10px; font-size: 14px; font-weight: bold;');
console.log('');

if (currencyButtons.length > 0) {
  console.log('%c✅ SISTEMA MULTI-MONEDA FUNCIONANDO', 'background: #00aa00; color: white; padding: 8px; font-weight: bold;');
  console.log('Los botones de moneda están visibles en el DOM');
} else if (currencyElements.length > 0) {
  console.log('%c⚠️ COMPONENTES PARCIALMENTE CARGADOS', 'background: #ff9900; color: white; padding: 8px; font-weight: bold;');
  console.log(`Se encontraron ${currencyElements.length} elementos relacionados con moneda`);
  console.log('Posibles causas:');
  console.log('  1. El componente CurrencyTabs no se está renderizando');
  console.log('  2. Los datos de monedas están vacíos (availableCurrencies = [])');
  console.log('  3. El CSS está ocultando los elementos');
} else {
  console.log('%c❌ SISTEMA MULTI-MONEDA NO VISIBLE', 'background: #cc0000; color: white; padding: 8px; font-weight: bold;');
  console.log('');
  console.log('PASOS PARA SOLUCIONAR:');
  console.log('');
  console.log('1️⃣ Ejecutar el script SQL:');
  console.log('   • Abre Supabase → SQL Editor');
  console.log('   • Ejecuta: supabase/migrations/add_multi_currency.sql');
  console.log('');
  console.log('2️⃣ Recargar sin caché:');
  console.log('   • Windows: Ctrl + Shift + R');
  console.log('   • Mac: Cmd + Shift + R');
  console.log('');
  console.log('3️⃣ Verificar errores:');
  console.log('   • Busca errores en ROJO en esta consola');
  console.log('   • Si dice "column currency does not exist" → Paso 1');
  console.log('');
  console.log('4️⃣ Reiniciar servidor:');
  console.log('   • Terminal: Ctrl + C');
  console.log('   • Ejecuta: npm run dev');
}

console.log('');
console.log('%c💡 TIP:', 'background: #333; color: #fff; padding: 5px; font-weight: bold;');
console.log('Si ves un error específico en ROJO arriba, cópialo y compártelo');
console.log('Eso ayudará a identificar el problema exacto');
console.log('');
console.log('%c🏁 FIN DEL DIAGNÓSTICO', 'background: #0066ff; color: white; padding: 10px; font-size: 14px;');
