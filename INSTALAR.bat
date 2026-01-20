@echo off
REM ============================================
REM INSTALACIÓN RÁPIDA - Sistema de Pagos y Notificaciones
REM ============================================
REM Este script guía la instalación paso a paso

echo.
echo ====================================================
echo     INSTALACION DEL SISTEMA DE PAGOS Y NOTIFICACIONES
echo ====================================================
echo.

REM Paso 1: Verificar archivos
echo [Paso 1] Verificando archivos necesarios...
echo.

set all_exist=true

if exist "supabase\APLICAR_TODO.sql" (
    echo [OK] supabase\APLICAR_TODO.sql
) else (
    echo [ERROR] supabase\APLICAR_TODO.sql NO ENCONTRADO
    set all_exist=false
)

if exist "src\services\debtsService.js" (
    echo [OK] src\services\debtsService.js
) else (
    echo [ERROR] src\services\debtsService.js NO ENCONTRADO
    set all_exist=false
)

if exist "src\services\notificationsService.js" (
    echo [OK] src\services\notificationsService.js
) else (
    echo [ERROR] src\services\notificationsService.js NO ENCONTRADO
    set all_exist=false
)

if exist "src\pages\Debts\Debts.jsx" (
    echo [OK] src\pages\Debts\Debts.jsx
) else (
    echo [ERROR] src\pages\Debts\Debts.jsx NO ENCONTRADO
    set all_exist=false
)

if exist "src\pages\Debts\Debts.module.css" (
    echo [OK] src\pages\Debts\Debts.module.css
) else (
    echo [ERROR] src\pages\Debts\Debts.module.css NO ENCONTRADO
    set all_exist=false
)

echo.

if "%all_exist%"=="false" (
    echo [ERROR] Faltan archivos necesarios
    pause
    exit /b 1
)

echo [OK] Todos los archivos estan presentes
echo.

REM Paso 2: Instrucciones para Supabase
echo [Paso 2] Aplicar cambios en Supabase
echo ========================================
echo.
echo IMPORTANTE: Debes ejecutar manualmente el siguiente archivo en Supabase:
echo.
echo    supabase\APLICAR_TODO.sql
echo.
echo Pasos:
echo   1. Ir a: https://supabase.com/dashboard
echo   2. Seleccionar tu proyecto
echo   3. Ir a: SQL Editor
echo   4. Crear una nueva query
echo   5. Copiar y pegar el contenido de: supabase\APLICAR_TODO.sql
echo   6. Ejecutar (boton RUN o Ctrl+Enter)
echo   7. Verificar mensaje: '✓ APLICACION COMPLETADA'
echo.

set /p response="¿Has aplicado el script SQL en Supabase? (s/n) "

if /i not "%response%"=="s" if /i not "%response%"=="S" (
    echo.
    echo Por favor, aplica el script SQL primero y vuelve a ejecutar este instalador.
    pause
    exit /b 1
)

echo [OK] Script SQL aplicado
echo.

REM Paso 3: Frontend
echo [Paso 3] Preparar Frontend
echo ==============================
echo.

if not exist "node_modules" (
    echo Instalando dependencias...
    call npm install
    
    if errorlevel 1 (
        echo [ERROR] Fallo la instalacion de dependencias
        pause
        exit /b 1
    )
    
    echo [OK] Dependencias instaladas
) else (
    echo [OK] Dependencias ya instaladas
)

echo.

REM Paso 4: Iniciar aplicación
echo [Paso 4] Iniciar Aplicacion
echo ==============================
echo.
echo Para iniciar el servidor de desarrollo:
echo.
echo    npm run dev
echo.

set /p start="¿Quieres iniciar el servidor ahora? (s/n) "

if /i "%start%"=="s" (
    echo.
    echo Iniciando servidor...
    echo.
    echo La aplicacion se abrira en tu navegador
    echo Si no se abre automaticamente, visita: http://localhost:5173
    echo.
    call npm run dev
) else (
    echo.
    echo Para iniciar manualmente mas tarde, ejecuta:
    echo    npm run dev
)

echo.
echo ====================================================
echo      INSTALACION COMPLETADA
echo ====================================================
echo.
echo Funcionalidades implementadas:
echo   [OK] Botones de pago funcionando
echo   [OK] Reversion de pagos de cuotas
echo   [OK] Diseño mejorado del panel
echo   [OK] Circulos de notificaciones en pestañas
echo.
echo Para mas detalles, consulta:
echo    - RESUMEN_IMPLEMENTACION.md
echo    - GUIA_IMPLEMENTACION_PAGOS_Y_NOTIFICACIONES.md
echo.
echo ¡Disfruta de las nuevas funcionalidades!
echo.
pause
