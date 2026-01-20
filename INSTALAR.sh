#!/bin/bash
# ============================================
# INSTALACIÓN RÁPIDA - Sistema de Pagos y Notificaciones
# ============================================
# Este script guía la instalación paso a paso

echo "🎯 INSTALACIÓN DEL SISTEMA DE PAGOS Y NOTIFICACIONES"
echo "======================================================"
echo ""

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Paso 1: Verificar archivos
echo "📦 Paso 1: Verificando archivos necesarios..."
echo ""

files=(
    "supabase/APLICAR_TODO.sql"
    "src/services/debtsService.js"
    "src/services/notificationsService.js"
    "src/pages/Debts/Debts.jsx"
    "src/pages/Debts/Debts.module.css"
)

all_exist=true
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file ${RED}NO ENCONTRADO${NC}"
        all_exist=false
    fi
done

echo ""

if [ "$all_exist" = false ]; then
    echo -e "${RED}ERROR: Faltan archivos necesarios${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Todos los archivos están presentes${NC}"
echo ""

# Paso 2: Instrucciones para Supabase
echo "🗄️  Paso 2: Aplicar cambios en Supabase"
echo "========================================"
echo ""
echo "IMPORTANTE: Debes ejecutar manualmente el siguiente archivo en Supabase:"
echo ""
echo -e "${YELLOW}   supabase/APLICAR_TODO.sql${NC}"
echo ""
echo "Pasos:"
echo "  1. Ir a: https://supabase.com/dashboard"
echo "  2. Seleccionar tu proyecto"
echo "  3. Ir a: SQL Editor"
echo "  4. Crear una nueva query"
echo "  5. Copiar y pegar el contenido de: supabase/APLICAR_TODO.sql"
echo "  6. Ejecutar (botón RUN o Ctrl+Enter)"
echo "  7. Verificar mensaje: '✅ APLICACIÓN COMPLETADA'"
echo ""

read -p "¿Has aplicado el script SQL en Supabase? (s/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[SsYy]$ ]]; then
    echo -e "${RED}Por favor, aplica el script SQL primero y vuelve a ejecutar este instalador.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Script SQL aplicado${NC}"
echo ""

# Paso 3: Frontend
echo "💻 Paso 3: Preparar Frontend"
echo "=============================="
echo ""

# Verificar si node_modules existe
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}ERROR: Falló la instalación de dependencias${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Dependencias instaladas${NC}"
else
    echo -e "${GREEN}✓ Dependencias ya instaladas${NC}"
fi

echo ""

# Paso 4: Iniciar aplicación
echo "🚀 Paso 4: Iniciar Aplicación"
echo "=============================="
echo ""
echo "Para iniciar el servidor de desarrollo:"
echo ""
echo -e "${YELLOW}   npm run dev${NC}"
echo ""

read -p "¿Quieres iniciar el servidor ahora? (s/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[SsYy]$ ]]; then
    echo ""
    echo "🚀 Iniciando servidor..."
    echo ""
    echo -e "${GREEN}La aplicación se abrirá en tu navegador${NC}"
    echo -e "Si no se abre automáticamente, visita: ${YELLOW}http://localhost:5173${NC}"
    echo ""
    npm run dev
else
    echo ""
    echo "Para iniciar manualmente más tarde, ejecuta:"
    echo -e "${YELLOW}   npm run dev${NC}"
fi

echo ""
echo "======================================================"
echo -e "${GREEN}✨ INSTALACIÓN COMPLETADA${NC}"
echo "======================================================"
echo ""
echo "Funcionalidades implementadas:"
echo "  ✅ Botones de pago funcionando"
echo "  ✅ Reversión de pagos de cuotas"
echo "  ✅ Diseño mejorado del panel"
echo "  ✅ Círculos de notificaciones en pestañas"
echo ""
echo "📖 Para más detalles, consulta:"
echo "   - RESUMEN_IMPLEMENTACION.md"
echo "   - GUIA_IMPLEMENTACION_PAGOS_Y_NOTIFICACIONES.md"
echo ""
echo "¡Disfruta de las nuevas funcionalidades! 🎉"
echo ""
