package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// AppVersion is the current application version (semver)
const AppVersion = "2.1.0"

// App struct — the Wails application bridge
type App struct {
	ctx        context.Context
	cfg        *Config
	sseClient  *SSEClient
	history    *PrintHistory
	tray       *trayIcon
	printCount int
	lastError  string
	forceQuit  bool
	mu         sync.Mutex
}

// NewApp creates a new App
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	var err error
	a.cfg, err = LoadConfig()
	if err != nil {
		log.Printf("Error loading config: %v", err)
		a.cfg = DefaultConfig()
	}

	// Initialize print history
	a.history = NewPrintHistory()

	// Initialize system tray
	a.tray = newTrayIcon(a)
	a.tray.start()

	// If already configured, auto-connect
	if a.cfg.IsConfigured() {
		go a.startSSE()
	}
}

// shutdown is called when the app is closing
func (a *App) shutdown(ctx context.Context) {
	if a.sseClient != nil {
		a.sseClient.Stop()
	}
	if a.tray != nil {
		a.tray.remove()
	}
}

// ── Exposed methods for frontend ──────────────────────────────────

// GetConfig returns the current config
func (a *App) GetConfig() *Config {
	return a.cfg
}

// IsConfigured returns whether the agent has a valid print key
func (a *App) IsConfigured() bool {
	return a.cfg.IsConfigured()
}

// SaveConfig saves the config with new values
func (a *App) SaveConfig(apiUrl, printKey, printerName string, paperWidth int, autoCut bool) error {
	a.cfg.APIUrl = apiUrl
	a.cfg.PrintKey = printKey
	a.cfg.PrinterName = printerName
	a.cfg.PaperWidth = paperWidth
	a.cfg.AutoCut = autoCut
	return a.cfg.Save()
}

// ValidateKey tests a print key against the server
func (a *App) ValidateKey(key string) (string, error) {
	return validateKey(a.cfg.APIUrl, key)
}

// GetPrinters returns list of available printers
func (a *App) GetPrinters() ([]string, error) {
	return ListPrinters()
}

// GetDefaultPrinterName returns the OS default printer
func (a *App) GetDefaultPrinterName() string {
	return GetDefaultPrinter()
}

// Connect starts the SSE connection
func (a *App) Connect() {
	go a.startSSE()
}

// Disconnect stops the SSE connection
func (a *App) Disconnect() {
	if a.sseClient != nil {
		a.sseClient.Stop()
		a.sseClient = nil
	}
}

// Reconnect forces a reconnect
func (a *App) Reconnect() {
	a.Disconnect()
	time.Sleep(300 * time.Millisecond)
	go a.startSSE()
}

// GetStatus returns the current agent status
func (a *App) GetStatus() map[string]interface{} {
	a.mu.Lock()
	defer a.mu.Unlock()

	connected := false
	businessName := ""
	if a.sseClient != nil {
		connected = a.sseClient.IsConnected()
		if b := a.sseClient.GetBusiness(); b != nil {
			businessName = b.BusinessName
		}
	}

	return map[string]interface{}{
		"connected":    connected,
		"businessName": businessName,
		"printCount":   a.printCount,
		"lastError":    a.lastError,
		"printerName":  a.cfg.PrinterName,
		"paperWidth":   a.cfg.PaperWidth,
	}
}

// TestPrint prints a test ticket
func (a *App) TestPrint() error {
	business := &BusinessInfo{BusinessName: "Test Business", Phone: "0000000000"}
	if a.sseClient != nil {
		if b := a.sseClient.GetBusiness(); b != nil {
			business = b
		}
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

	comanda := GenerateComanda(testOrder, business, a.cfg.PaperWidth, a.cfg.AutoCut)
	printerName, err := ResolvePrinter(a.cfg)
	if err != nil {
		return err
	}
	err = PrintRaw(printerName, comanda, a.cfg.PaperWidth)
	if err != nil {
		return fmt.Errorf("error imprimiendo comanda: %w", err)
	}

	time.Sleep(300 * time.Millisecond)

	recibo := GenerateRecibo(testOrder, business, a.cfg.PaperWidth, a.cfg.AutoCut)
	err = PrintRaw(printerName, recibo, a.cfg.PaperWidth)
	if err != nil {
		return fmt.Errorf("error imprimiendo recibo: %w", err)
	}

	a.mu.Lock()
	a.printCount += 2
	a.mu.Unlock()

	runtime.EventsEmit(a.ctx, "printCount", a.printCount)
	return nil
}

// IsAutoStartEnabled checks if the app is set to run at Windows startup
func (a *App) IsAutoStartEnabled() bool {
	return isAutoStartEnabled()
}

// SetAutoStart enables/disables auto-start at Windows login
func (a *App) SetAutoStart(enabled bool) error {
	if enabled {
		return enableAutoStart()
	}
	return disableAutoStart()
}

// OpenAppFolder opens the folder where the exe is located
func (a *App) OpenAppFolder() error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	dir := filepath.Dir(exe)
	return exec.Command("explorer", dir).Start()
}

// OpenTicketsFolder opens the tickets subfolder (test print output)
func (a *App) OpenTicketsFolder() error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	dir := filepath.Join(filepath.Dir(exe), "tickets")
	_ = os.MkdirAll(dir, 0755)
	return exec.Command("explorer", dir).Start()
}

// ── History methods ───────────────────────────────────────────────

// GetHistory returns the print history (without raw data)
func (a *App) GetHistory() []map[string]interface{} {
	return a.history.GetEntries()
}

// ReprintJob reprints a specific job from history by ID
func (a *App) ReprintJob(id string) error {
	rawData, err := a.history.GetRawData(id)
	if err != nil {
		return err
	}
	printerName, err := ResolvePrinter(a.cfg)
	if err != nil {
		return err
	}
	return PrintRaw(printerName, rawData, a.cfg.PaperWidth)
}

// ReprintLast reprints the most recent print job
func (a *App) ReprintLast() error {
	lastID := a.history.GetLastEntry()
	if lastID == "" {
		return fmt.Errorf("no hay impresiones en el historial")
	}
	return a.ReprintJob(lastID)
}

// ClearHistory removes all print history
func (a *App) ClearHistory() {
	a.history.Clear()
}

// GetTicketPreview returns a plain-text preview of a historic ticket
func (a *App) GetTicketPreview(id string) (string, error) {
	return a.history.GetFullPreview(id)
}

// ── Printer status ────────────────────────────────────────────────

// GetPrinterStatusInfo returns the current printer status
func (a *App) GetPrinterStatusInfo() map[string]interface{} {
	if a.cfg.PrinterName == "" {
		return map[string]interface{}{
			"status": "none",
			"label":  "Sin impresora",
			"online": false,
		}
	}
	return GetPrinterStatus(a.cfg.PrinterName)
}

// ── Auto-update ───────────────────────────────────────────────────

// GetVersion returns the current app version
func (a *App) GetVersion() string {
	return AppVersion
}

// CheckForUpdate checks the server for a newer version
func (a *App) CheckForUpdate() map[string]interface{} {
	url := a.cfg.APIUrl + "/uploads/print-agent/version.json"

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return map[string]interface{}{"available": false}
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return map[string]interface{}{"available": false}
	}

	var info struct {
		Version     string `json:"version"`
		DownloadURL string `json:"downloadUrl"`
		Notes       string `json:"notes"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return map[string]interface{}{"available": false}
	}

	ver := strings.TrimPrefix(info.Version, "v")
	if ver != AppVersion && ver > AppVersion {
		return map[string]interface{}{
			"available": true,
			"version":   ver,
			"url":       info.DownloadURL,
			"notes":     info.Notes,
		}
	}

	return map[string]interface{}{"available": false}
}

// ── Quit ──────────────────────────────────────────────────────────

// QuitApp sets forceQuit and triggers Wails shutdown (bypasses minimize-to-tray)
func (a *App) QuitApp() {
	a.mu.Lock()
	a.forceQuit = true
	a.mu.Unlock()

	if a.tray != nil {
		a.tray.remove()
	}
	runtime.Quit(a.ctx)
}

// GetPrintMode returns the current print mode from the connected business
func (a *App) GetPrintMode() string {
	return a.getPrintMode()
}

// ── Internal methods ──────────────────────────────────────────────

// getPrintMode returns the print mode from the connected business info
func (a *App) getPrintMode() string {
	if a.sseClient != nil {
		if b := a.sseClient.GetBusiness(); b != nil && b.PrintMode != "" {
			return b.PrintMode
		}
	}
	return "both"
}

func (a *App) startSSE() {
	a.sseClient = NewSSEClient(a.cfg)
	a.sseClient.onConnect = func(info *BusinessInfo) {
		log.Printf("Connected to: %s", info.BusinessName)
		runtime.EventsEmit(a.ctx, "connected", info.BusinessName)
	}
	a.sseClient.onDisconnect = func() {
		log.Println("Disconnected from server")
		runtime.EventsEmit(a.ctx, "disconnected", nil)
	}
	a.sseClient.onOrder = func(order map[string]interface{}) {
		mode := a.getPrintMode()
		if mode == "comanda" || mode == "both" {
			a.handlePrint(order, "comanda")
		}
		if mode == "recibo" || mode == "both" {
			a.handlePrint(order, "recibo")
		}
	}
	a.sseClient.onReceipt = func(order map[string]interface{}) {
		// Manual receipt print from admin panel — always print regardless of mode
		a.handlePrint(order, "recibo")
	}
	a.sseClient.Start()
}

func (a *App) handlePrint(order map[string]interface{}, docType string) {
	business := a.sseClient.GetBusiness()
	if business == nil {
		log.Println("[Print] No business info, skipping")
		return
	}

	var data []byte
	if docType == "comanda" {
		data = GenerateComanda(order, business, a.cfg.PaperWidth, a.cfg.AutoCut)
	} else {
		data = GenerateRecibo(order, business, a.cfg.PaperWidth, a.cfg.AutoCut)
	}

	orderNum := getString(order, "orderNumber")

	printerName, err := ResolvePrinter(a.cfg)
	if err != nil {
		a.mu.Lock()
		a.lastError = err.Error()
		a.mu.Unlock()
		a.history.AddEntry(orderNum, docType, "error", err.Error(), data)
		runtime.EventsEmit(a.ctx, "printError", err.Error())
		return
	}

	err = PrintRaw(printerName, data, a.cfg.PaperWidth)
	if err != nil {
		a.mu.Lock()
		a.lastError = err.Error()
		a.mu.Unlock()
		a.history.AddEntry(orderNum, docType, "error", err.Error(), data)
		runtime.EventsEmit(a.ctx, "printError", err.Error())
		return
	}

	a.history.AddEntry(orderNum, docType, "ok", "", data)

	a.mu.Lock()
	a.printCount++
	count := a.printCount
	a.lastError = ""
	a.mu.Unlock()

	log.Printf("[Print] %s #%s printed (total: %d)", docType, orderNum, count)

	runtime.EventsEmit(a.ctx, "printed", map[string]interface{}{
		"docType":     docType,
		"orderNumber": orderNum,
		"count":       count,
		"timestamp":   time.Now().Format("15:04:05"),
	})
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
