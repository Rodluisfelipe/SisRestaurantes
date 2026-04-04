# MenuBy Print Agent

Agente de impresión automática de tiquetes para MenuBy. Se conecta al backend via SSE (Server-Sent Events) y envía comandos ESC/POS directamente a la impresora térmica cuando llega un nuevo pedido.

## Requisitos

- **Windows 10/11**
- **Go 1.21+** → [Descargar Go](https://go.dev/dl/)
- **Impresora térmica** (80mm o 58mm) con driver instalado

## Compilar

```bat
cd PrintAgent
build.bat
```

Genera `menuby-print.exe` (~5 MB).

## Configuración

### 1. Generar API Key en MenuBy

Desde el panel de MenuBy (admin):
1. Ve a **Configuración → Print Agent**
2. Click **"Generar Key"**
3. Copia la key generada (64 caracteres hex)

### 2. Configurar el agente

Edita `config.json` (se crea automáticamente al primer inicio):

```json
{
  "apiUrl": "https://157-245-125-216.nip.io",
  "printKey": "PEGAR_KEY_AQUI",
  "printerName": "POS-58",
  "paperWidth": 80,
  "autoCut": true,
  "testMode": false
}
```

| Campo | Descripción |
|-------|-------------|
| `apiUrl` | URL del backend MenuBy |
| `printKey` | Key de 64 caracteres generada en el paso 1 |
| `printerName` | Nombre de la impresora (parcial OK, ej: "POS", "Epson") |
| `paperWidth` | Ancho del papel: `80` (48 chars/línea) o `58` (32 chars/línea) |
| `autoCut` | Cortar papel automáticamente después de cada ticket |
| `testMode` | Si es `true`, solo imprime en consola sin enviar a impresora |

## Uso

1. Ejecutar `menuby-print.exe`
2. Aparece un ícono de impresora en la bandeja del sistema (junto al reloj)
3. **Click derecho** en el ícono para ver opciones:
   - ✅ Estado de conexión (nombre del negocio)
   - 🖨 Impresora seleccionada
   - 📄 Contador de tickets impresos
   - 🔄 Reconectar al servidor
   - 🧪 Imprimir ticket de prueba
   - ❌ Salir

## Flujo

```
┌─ MenuBy Backend ─┐     SSE      ┌─ Print Agent ─┐     ESC/POS    ┌─ Impresora ─┐
│  Nuevo pedido     │ ──────────►  │  Recibe orden  │ ──────────►   │  Tiquete     │
│  order_created    │  (internet)  │  Genera ticket │  (USB/red)    │  impreso     │
└───────────────────┘              └────────────────┘               └──────────────┘
```

## Troubleshooting

### "Impresora no encontrada"
- Verifica que la impresora aparece en **Panel de Control → Dispositivos e Impresoras**
- Usa el nombre exacto o parcial en `printerName`
- Si dejas `printerName` vacío, usa la impresora por defecto del sistema

### "Invalid API key (401)"
- Verifica que `printKey` en `config.json` tiene exactamente 64 caracteres
- Regenera la key desde el panel de MenuBy si fue revocada

### No imprime al llegar pedido
- Verifica el log en `menuby-print.log`
- Click derecho en el ícono → el estado debe decir "✅ Conectado"
- Prueba con "🧪 Imprimir prueba" para verificar la impresora

### Reconexión automática
El agente se reconecta automáticamente si pierde conexión (backoff exponencial: 1s, 2s, 4s, 8s, hasta 30s).

## Arquitectura

- **Lenguaje:** Go 1.21
- **System Tray:** `getlantern/systray`
- **Impresión:** `alexbrainman/printer` (Windows RAW printing API)
- **Protocolo:** SSE (Server-Sent Events) — No Socket.IO
- **Formato:** ESC/POS (compatible con Epson, Star, POS-58, POS-80, y la mayoría de térmicas)
