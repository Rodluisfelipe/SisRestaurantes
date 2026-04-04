package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

func clearScreen() {
	fmt.Print("\033[H\033[2J")
}

func runSetupWizard(cfg *Config) {
	reader := bufio.NewReader(os.Stdin)

	clearScreen()
	fmt.Println()
	fmt.Println("  ╔═══════════════════════════════════════════╗")
	fmt.Println("  ║                                           ║")
	fmt.Println("  ║     🖨  MenuBy Print Agent  🖨            ║")
	fmt.Println("  ║        Configuración Inicial              ║")
	fmt.Println("  ║                                           ║")
	fmt.Println("  ╚═══════════════════════════════════════════╝")
	fmt.Println()
	fmt.Println("  Este programa imprime tiquetes automáticamente")
	fmt.Println("  cada vez que llega un pedido nuevo a tu negocio.")
	fmt.Println()
	fmt.Println("  ─────────────────────────────────────────────")
	fmt.Println("  PASO 1: Obtener tu clave de conexión")
	fmt.Println("  ─────────────────────────────────────────────")
	fmt.Println()
	fmt.Println("  1. Abre tu panel de MenuBy en el navegador")
	fmt.Println("  2. Ve a Configuración → Print Agent")
	fmt.Println("  3. Haz clic en \"Generar Clave\"")
	fmt.Println("  4. Copia la clave que aparece")
	fmt.Println()

	for {
		fmt.Print("  Pega tu clave aquí y presiona Enter: ")
		input, _ := reader.ReadString('\n')
		key := strings.TrimSpace(input)

		if key == "" {
			fmt.Println("  ⚠ No ingresaste nada. Inténtalo de nuevo.")
			fmt.Println()
			continue
		}

		if len(key) != 64 {
			fmt.Printf("  ⚠ La clave debe tener 64 caracteres (ingresaste %d).\n", len(key))
			fmt.Println("    Copia la clave completa desde el panel de MenuBy.")
			fmt.Println()
			continue
		}

		// Validate key against the server
		fmt.Println()
		fmt.Println("  ⏳ Verificando clave...")

		businessName, err := validateKey(cfg.APIUrl, key)
		if err != nil {
			fmt.Printf("  ❌ Clave inválida: %v\n", err)
			fmt.Println("     Verifica que copiaste la clave correcta.")
			fmt.Println()
			continue
		}

		// Save the key
		cfg.PrintKey = key
		if err := cfg.Save(); err != nil {
			fmt.Printf("  ❌ Error guardando configuración: %v\n", err)
			os.Exit(1)
		}

		fmt.Println()
		fmt.Printf("  ✅ ¡Conectado a: %s!\n", businessName)
		fmt.Println()
		break
	}

	// Step 2: Select printer
	selectPrinterWizard(cfg)

	// Step 3: Paper width
	fmt.Println("  ─────────────────────────────────────────────")
	fmt.Println("  PASO 3: Tamaño del papel")
	fmt.Println("  ─────────────────────────────────────────────")
	fmt.Println()
	fmt.Println("  1) 80 mm — Estándar (la mayoría de impresoras POS)")
	fmt.Println("             48 caracteres por línea")
	fmt.Println()
	fmt.Println("  2) 76 mm — Cocina / Facturación")
	fmt.Println("             42 caracteres por línea")
	fmt.Println()
	fmt.Println("  3) 58 mm — Compacto / Portátil")
	fmt.Println("             32 caracteres por línea")
	fmt.Println()
	fmt.Println("  4) 44 mm — Mini / Bluetooth")
	fmt.Println("             22 caracteres por línea")
	fmt.Println()
	fmt.Print("  Elige [1-4] (Enter = 80mm): ")
	input, _ := reader.ReadString('\n')
	choice := strings.TrimSpace(input)

	paperSizes := map[string]int{"1": 80, "2": 76, "3": 58, "4": 44}
	paperLabels := map[string]string{"1": "80mm Estándar", "2": "76mm Cocina", "3": "58mm Compacto", "4": "44mm Mini"}

	if size, ok := paperSizes[choice]; ok {
		cfg.PaperWidth = size
		fmt.Printf("  → Papel: %s\n", paperLabels[choice])
	} else {
		cfg.PaperWidth = 80
		fmt.Println("  → Papel: 80mm Estándar")
	}

	cfg.AutoCut = true
	_ = cfg.Save()

	fmt.Println()
	fmt.Println("  ═══════════════════════════════════════════")
	fmt.Println("  ✅ ¡Configuración completa!")
	fmt.Println()
	fmt.Println("  El agente se minimizará a la bandeja del")
	fmt.Println("  sistema (junto al reloj). Click derecho")
	fmt.Println("  en el ícono 🖨 para ver opciones.")
	fmt.Println("  ═══════════════════════════════════════════")
	fmt.Println()
	fmt.Println("  Iniciando en 3 segundos...")
	time.Sleep(3 * time.Second)
}

func selectPrinterWizard(cfg *Config) {
	reader := bufio.NewReader(os.Stdin)

	fmt.Println("  ─────────────────────────────────────────────")
	fmt.Println("  PASO 2: Seleccionar impresora")
	fmt.Println("  ─────────────────────────────────────────────")
	fmt.Println()

	printers, err := ListPrinters()
	if err != nil || len(printers) == 0 {
		fmt.Println("  ⚠ No se encontraron impresoras instaladas.")
		fmt.Println("    Conecta tu impresora térmica e instala el driver.")
		fmt.Println("    Puedes cambiar la impresora después desde el menú.")
		fmt.Println()
		return
	}

	fmt.Println("  Impresoras encontradas:")
	fmt.Println()
	for i, p := range printers {
		defaultTag := ""
		if p == GetDefaultPrinter() {
			defaultTag = " ← predeterminada"
		}
		fmt.Printf("    %d) %s%s\n", i+1, p, defaultTag)
	}
	fmt.Println()

	for {
		fmt.Printf("  Elige un número [1-%d]: ", len(printers))
		input, _ := reader.ReadString('\n')
		choice := strings.TrimSpace(input)

		if choice == "" {
			// Use default printer
			def := GetDefaultPrinter()
			if def != "" {
				cfg.PrinterName = def
				fmt.Printf("  → Usando: %s\n", def)
				_ = cfg.Save()
				fmt.Println()
				return
			}
		}

		var idx int
		_, err := fmt.Sscanf(choice, "%d", &idx)
		if err != nil || idx < 1 || idx > len(printers) {
			fmt.Println("  ⚠ Número inválido. Inténtalo de nuevo.")
			continue
		}

		cfg.PrinterName = printers[idx-1]
		_ = cfg.Save()
		fmt.Printf("  → Impresora: %s\n", cfg.PrinterName)
		fmt.Println()
		return
	}
}

// validateKey checks the key against the server and returns the business name
func validateKey(apiURL, key string) (string, error) {
	url := fmt.Sprintf("%s/api/print-agent/stream?key=%s", apiURL, key)

	client := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("Cache-Control", "no-cache")

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("no se pudo conectar al servidor")
	}
	defer resp.Body.Close()

	if resp.StatusCode == 401 {
		return "", fmt.Errorf("clave no válida o revocada")
	}
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("error del servidor (%d)", resp.StatusCode)
	}

	// Read SSE lines until we find the "connected" event with business info
	scanner := bufio.NewScanner(resp.Body)
	deadline := time.After(12 * time.Second)
	dataCh := make(chan string, 1)

	go func() {
		for scanner.Scan() {
			line := scanner.Text()
			if strings.HasPrefix(line, "data: ") {
				dataCh <- strings.TrimPrefix(line, "data: ")
				return
			}
		}
		dataCh <- ""
	}()

	select {
	case jsonData := <-dataCh:
		if jsonData == "" {
			return "Negocio", nil
		}
		var info struct {
			BusinessName string `json:"businessName"`
		}
		if err := json.Unmarshal([]byte(jsonData), &info); err == nil && info.BusinessName != "" {
			return info.BusinessName, nil
		}
		return "Negocio", nil
	case <-deadline:
		return "", fmt.Errorf("timeout esperando respuesta del servidor")
	}
}
