# Script de prueba simple para ToppingGroups
Write-Host "=== PRUEBA SIMPLE TOPPING GROUPS ===" -ForegroundColor Green

# Probar endpoint de test
Write-Host "Probando endpoint de test..." -ForegroundColor Yellow
try {
    $testResponse = Invoke-WebRequest -Uri "https://157-245-125-216.nip.io/api/topping-groups/test" -Method GET
    Write-Host "✓ Endpoint funcionando: $($testResponse.StatusCode)" -ForegroundColor Green
    Write-Host "Respuesta: $($testResponse.Content)" -ForegroundColor Cyan
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "=== PRUEBA COMPLETADA ===" -ForegroundColor Green
