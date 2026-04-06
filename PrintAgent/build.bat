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
    pause
    exit /b 1
)

:: Check Wails
where wails >nul 2>&1
if errorlevel 1 (
    echo Instalando Wails CLI...
    go install github.com/wailsapp/wails/v2/cmd/wails@latest
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

:: Build with Wails
echo Compilando con Wails...
wails build
if errorlevel 1 (
    echo ERROR compilando
    pause
    exit /b 1
)

:: Sign with MenuBy certificate
echo.
echo Firmando ejecutable...
powershell -Command "$cert = Get-ChildItem 'Cert:\CurrentUser\My\E9EAB4D81F044ECA06B9A0EF1316E5270560DABF' -ErrorAction SilentlyContinue; if ($cert) { Set-AuthenticodeSignature -FilePath 'build\bin\menuby-print.exe' -Certificate $cert -HashAlgorithm SHA256 | Out-Null; Write-Host 'Firma aplicada correctamente' } else { Write-Host 'ADVERTENCIA: Certificado no encontrado, exe sin firmar' }"

echo.
echo ========================================
echo  Build exitoso: build\bin\menuby-print.exe
echo  Tamano:
for %%I in (build\bin\menuby-print.exe) do echo   %%~zI bytes
echo ========================================
echo.
pause
