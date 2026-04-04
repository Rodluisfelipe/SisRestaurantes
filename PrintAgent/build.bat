@echo off
echo ==============================
echo  MenuBy Print Agent — Build
echo ==============================
echo.

:: Check Go
where go >nul 2>&1
if errorlevel 1 (
    echo ERROR: Go no esta instalado.
    echo Descarga Go de: https://go.dev/dl/
    echo Instala y reinicia esta terminal.
    pause
    exit /b 1
)

echo Go encontrado:
go version
echo.

:: Download dependencies
echo Descargando dependencias...
go mod tidy
if errorlevel 1 (
    echo ERROR descargando dependencias
    pause
    exit /b 1
)
echo.

:: Build
echo Compilando...
go build -ldflags="-s -w -H windowsgui" -o menuby-print.exe .
if errorlevel 1 (
    echo ERROR compilando
    pause
    exit /b 1
)

echo.
echo ========================================
echo  Build exitoso: menuby-print.exe
echo  Tamano:
for %%I in (menuby-print.exe) do echo   %%~zI bytes (%%~zI)
echo ========================================
echo.
echo Para ejecutar: menuby-print.exe
echo Asegurate de tener config.json configurado.
pause
