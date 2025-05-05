@echo off
echo === INICIANDO MODO DESARROLLO ===

echo === Iniciando Backend ===
start cmd /k "cd Backend && npm run dev"

echo === Iniciando Frontend ===
start cmd /k "cd Frontend && npm run dev"

echo === Servidor Backend: http://localhost:5000 ===
echo === Servidor Frontend: http://localhost:5173 ===
echo === Presiona Ctrl+C en cada ventana para detener los servidores ===
