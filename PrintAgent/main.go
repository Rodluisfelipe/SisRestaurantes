package main

import (
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"github.com/getlantern/systray"
)

var (
	cfg           *Config
	sseClient     *SSEClient
	printCount    int
	lastError     string
	mu            sync.Mutex
	statusItem    *systray.MenuItem
	printerItem   *systray.MenuItem
	counterItem   *systray.MenuItem
	reconnectItem *systray.MenuItem
)

func main() {
	// Setup logging to file
	logFile, err := os.OpenFile("menuby-print.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err == nil {
		log.SetOutput(logFile)
	}
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("=== MenuBy Print Agent starting ===")

	// Load config
	cfg, err = LoadConfig()
	if err != nil {
		log.Fatalf("Error loading config: %v", err)
	}

	// If not configured, run interactive setup wizard
	if !cfg.IsConfigured() {
		runSetupWizard(cfg)
	}

	// Verify printer exists
	printerName, err := ResolvePrinter(cfg)
	if err != nil {
		log.Printf("WARNING: %v", err)
		// If no printer configured, run printer selection
		selectPrinterWizard(cfg)
	} else {
		log.Printf("Using printer: %s", printerName)
		cfg.PrinterName = printerName
	}

	// Start system tray
	systray.Run(onReady, onExit)
}

func onReady() {
	systray.SetIcon(PrinterIcon)
	systray.SetTitle("MenuBy Print")
	systray.SetTooltip("MenuBy Print Agent — Conectando...")

	// Menu items
	statusItem = systray.AddMenuItem("⏳ Conectando...", "Estado de conexión")
	statusItem.Disable()

	printerItem = systray.AddMenuItem("🖨 "+safeStr(cfg.PrinterName, "Sin impresora"), "Impresora seleccionada")
	printerItem.Disable()

	counterItem = systray.AddMenuItem("📄 Tickets: 0", "Tickets impresos en esta sesión")
	counterItem.Disable()

	systray.AddSeparator()

	// Printer selection submenu
	selectPrinterItem := systray.AddMenuItem("Cambiar impresora", "Seleccionar otra impresora")

	systray.AddSeparator()

	reconnectItem = systray.AddMenuItem("🔄 Reconectar", "Forzar reconexión al servidor")
	testItem := systray.AddMenuItem("🧪 Imprimir prueba", "Imprimir ticket de prueba")

	systray.AddSeparator()

	quitItem := systray.AddMenuItem("❌ Salir", "Cerrar MenuBy Print Agent")

	// Start SSE client
	sseClient = NewSSEClient(cfg)
	sseClient.onConnect = onSSEConnect
	sseClient.onDisconnect = onSSEDisconnect
	sseClient.onOrder = onNewOrder
	sseClient.onReceipt = onPrintReceipt
	sseClient.Start()

	// Handle menu clicks
	go func() {
		for {
			select {
			case <-selectPrinterItem.ClickedCh:
				handleSelectPrinter()
			case <-reconnectItem.ClickedCh:
				handleReconnect()
			case <-testItem.ClickedCh:
				handleTestPrint()
			case <-quitItem.ClickedCh:
				systray.Quit()
			}
		}
	}()
}

func onExit() {
	log.Println("=== MenuBy Print Agent shutting down ===")
	if sseClient != nil {
		sseClient.Stop()
	}
}

func onSSEConnect(info *BusinessInfo) {
	log.Printf("Connected to: %s", info.BusinessName)
	systray.SetTooltip(fmt.Sprintf("MenuBy Print — %s", info.BusinessName))
	statusItem.SetTitle(fmt.Sprintf("✅ Conectado: %s", info.BusinessName))
}

func onSSEDisconnect() {
	log.Println("Disconnected from server")
	systray.SetTooltip("MenuBy Print Agent — Desconectado")
	statusItem.SetTitle("❌ Desconectado — reconectando...")
}

func onNewOrder(order map[string]interface{}) {
	business := sseClient.GetBusiness()
	if business == nil {
		log.Println("[Print] No business info, skipping print")
		return
	}

	// Auto-print COMANDA (kitchen ticket, no prices)
	comanda := GenerateComanda(order, business, cfg.PaperWidth, cfg.AutoCut)
	printDocument(comanda, order, "Comanda")
}

func onPrintReceipt(order map[string]interface{}) {
	business := sseClient.GetBusiness()
	if business == nil {
		log.Println("[Print] No business info, skipping print")
		return
	}

	// Print RECIBO (receipt with prices, for customer)
	recibo := GenerateRecibo(order, business, cfg.PaperWidth, cfg.AutoCut)
	printDocument(recibo, order, "Recibo")
}

func printDocument(data []byte, order map[string]interface{}, docType string) {
	printerName, err := ResolvePrinter(cfg)
	if err != nil {
		mu.Lock()
		lastError = err.Error()
		mu.Unlock()
		log.Printf("[Print] ERROR resolving printer: %v", err)
		return
	}

	err = PrintRaw(printerName, data)
	if err != nil {
		mu.Lock()
		lastError = err.Error()
		mu.Unlock()
		log.Printf("[Print] ERROR printing: %v", err)
		return
	}

	mu.Lock()
	printCount++
	count := printCount
	lastError = ""
	mu.Unlock()

	orderNum := getString(order, "orderNumber")
	log.Printf("[Print] ✓ %s #%s printed (total: %d)", docType, orderNum, count)
	counterItem.SetTitle(fmt.Sprintf("📄 Tickets: %d", count))
}

func handleSelectPrinter() {
	printers, err := ListPrinters()
	if err != nil {
		log.Printf("[Printer] Error listing: %v", err)
		return
	}

	if len(printers) == 0 {
		log.Println("[Printer] No printers found")
		printerItem.SetTitle("🖨 Sin impresoras")
		return
	}

	// Cycle through printers on each click
	mu.Lock()
	currentIdx := 0
	for i, p := range printers {
		if p == cfg.PrinterName {
			currentIdx = (i + 1) % len(printers)
			break
		}
	}
	cfg.PrinterName = printers[currentIdx]
	_ = cfg.Save()
	mu.Unlock()

	printerItem.SetTitle("🖨 " + cfg.PrinterName)
	log.Printf("[Printer] Selected: %s", cfg.PrinterName)
}

func handleReconnect() {
	log.Println("[SSE] Manual reconnect requested")
	if sseClient != nil {
		sseClient.Stop()
	}
	time.Sleep(500 * time.Millisecond)
	sseClient = NewSSEClient(cfg)
	sseClient.onConnect = onSSEConnect
	sseClient.onDisconnect = onSSEDisconnect
	sseClient.onOrder = onNewOrder
	sseClient.onReceipt = onPrintReceipt
	sseClient.Start()
	statusItem.SetTitle("⏳ Reconectando...")
}

func handleTestPrint() {
	business := sseClient.GetBusiness()
	if business == nil {
		business = &BusinessInfo{BusinessName: "Test Business", Phone: "0000000000"}
	}

	testOrder := map[string]interface{}{
		"orderNumber":  "TEST",
		"customerName": "Pedido de Prueba",
		"phone":        "3001234567",
		"orderType":    "inSite",
		"tableNumber":  "1",
		"paymentMethod": "cash",
		"items": []interface{}{
			map[string]interface{}{
				"name":             "Producto de Prueba",
				"price":            float64(15000),
				"quantity":         float64(2),
				"selectedToppings": []interface{}{},
			},
			map[string]interface{}{
				"name":     "Otro Producto",
				"price":    float64(8000),
				"quantity": float64(1),
				"selectedToppings": []interface{}{
					map[string]interface{}{
						"groupName":  "Extras",
						"optionName": "Queso Extra",
						"price":      float64(3000),
					},
				},
			},
		},
		"totalAmount":    float64(41000),
		"deliveryFee":    float64(0),
		"discountAmount": float64(0),
		"finalAmount":    float64(41000),
		"createdAt":      time.Now().Format(time.RFC3339),
	}

	// Print both comanda and receipt as test
	onNewOrder(testOrder)
	time.Sleep(500 * time.Millisecond)
	onPrintReceipt(testOrder)
}
