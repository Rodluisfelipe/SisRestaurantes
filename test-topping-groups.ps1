# Script de prueba para verificar la funcionalidad de ToppingGroups
Write-Host "=== PRUEBA DE FUNCIONALIDAD TOPPING GROUPS ===" -ForegroundColor Green

# Probar endpoint de test
Write-Host "1. Probando endpoint de test..." -ForegroundColor Yellow
try {
    $testResponse = Invoke-WebRequest -Uri "https://157-245-125-216.nip.io/api/topping-groups/test" -Method GET
    Write-Host "✓ Endpoint de test funcionando: $($testResponse.StatusCode)" -ForegroundColor Green
    Write-Host "Respuesta: $($testResponse.Content)" -ForegroundColor Cyan
} catch {
    Write-Host "✗ Error en endpoint de test: $($_.Exception.Message)" -ForegroundColor Red
}

# Probar obtener grupos existentes
Write-Host "`n2. Probando obtener grupos existentes..." -ForegroundColor Yellow
try {
    $getResponse = Invoke-WebRequest -Uri "https://157-245-125-216.nip.io/api/topping-groups?businessId=68d86ada90b1fb556405f5ad" -Method GET
    Write-Host "✓ GET grupos funcionando: $($getResponse.StatusCode)" -ForegroundColor Green
    $groups = $getResponse.Content | ConvertFrom-Json
    Write-Host "Grupos encontrados: $($groups.Count)" -ForegroundColor Cyan
    
    if ($groups.Count -gt 0) {
        $firstGroup = $groups[0]
        Write-Host "Primer grupo: $($firstGroup.name) (ID: $($firstGroup._id))" -ForegroundColor Cyan
        
        # Probar actualización del primer grupo
        Write-Host "`n3. Probando actualización de grupo..." -ForegroundColor Yellow
        $updateData = @{
            name = $firstGroup.name
            description = $firstGroup.description + " - Actualizado"
            basePrice = $firstGroup.basePrice
            isMultipleChoice = $firstGroup.isMultipleChoice
            isRequired = $firstGroup.isRequired
            options = $firstGroup.options
            subGroups = $firstGroup.subGroups
            businessId = $firstGroup.businessId
        } | ConvertTo-Json -Depth 10
        
        $updateResponse = Invoke-WebRequest -Uri "https://157-245-125-216.nip.io/api/topping-groups/$($firstGroup._id)" -Method PUT -Body $updateData -ContentType "application/json"
        Write-Host "✓ PUT grupo funcionando: $($updateResponse.StatusCode)" -ForegroundColor Green
        Write-Host "Grupo actualizado exitosamente" -ForegroundColor Cyan
    }
} catch {
    Write-Host "✗ Error en operación: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $errorContent = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorContent)
        $errorText = $reader.ReadToEnd()
        Write-Host "Detalles del error: $errorText" -ForegroundColor Red
    }
}

Write-Host "`n=== PRUEBA COMPLETADA ===" -ForegroundColor Green
