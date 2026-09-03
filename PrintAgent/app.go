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
const AppVersion = "2.3.0"

// App struct — the Wails application bridge
type App struct {
	ctx     context.Context
	cfg     *Config
	history *PrintHistory
	tray    *trayIcon

	// cfgMu protege la configuración. La UI puede estar agregando una impresora
	// en el mismo instante en que entra un pedido y una goroutine de impresión
	// lee la lista: sin este candado eso es una carrera de datos que puede
	// tumbar el agente, justo mientras alguien lo está configurando.
	cfgMu sync.RWMutex

	// Una conexión por cuenta, indexada por su llave de impresión.
	clients map[string]*SSEClient

	// printMu serializa TODA impresión. Dos marcas pueden compartir la misma
	// impresora física; sin este candado, dos tickets que llegan al mismo
	// tiempo intercalan sus bytes ESC/POS y sale un papel corrupto.
	printMu sync.Mutex

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

	a.clients = make(map[string]*SSEClient)

	// Initialize system tray
	a.tray = newTrayIcon(a)
	a.tray.start()

	// Conectar todas las cuentas activas
	go a.syncAccounts()
}

// shutdown is called when the app is closing
func (a *App) shutdown(ctx context.Context) {
	a.stopAllClients()
	if a.tray != nil {
		a.tray.remove()
	}
}

// ── Exposed methods for frontend ──────────────────────────────────

// GetConfig returns the current config
func (a *App) GetConfig() *Config {
	a.cfgMu.RLock()
	defer a.cfgMu.RUnlock()
	// Copia superficial con las listas duplicadas: lo que se entrega a la UI no
	// puede ser la misma memoria que leen las goroutines de impresión.
	c := *a.cfg
	c.Printers = append([]Printer(nil), a.cfg.Printers...)
	c.Accounts = append([]Account(nil), a.cfg.Accounts...)
	return &c
}

// IsConfigured returns whether the agent has a valid print key
func (a *App) IsConfigured() bool {
	a.cfgMu.RLock()
	defer a.cfgMu.RUnlock()
	return a.cfg.IsConfigured()
}

// SetAPIUrl cambia el servidor (uso excepcional; normalmente se migra solo).
func (a *App) SetAPIUrl(apiUrl string) error {
	a.cfgMu.Lock()
	defer a.cfgMu.Unlock()
	a.cfg.APIUrl = apiUrl
	return a.cfg.Save()
}

// ── Impresoras ────────────────────────────────────────────────────

// GetPrintersConfig devuelve las impresoras configuradas en el agente.
func (a *App) GetPrintersConfig() []Printer {
	a.cfgMu.RLock()
	defer a.cfgMu.RUnlock()
	return append([]Printer(nil), a.cfg.Printers...)
}

// printerParaDoc devuelve una COPIA de la impresora que debe atender un
// documento. Se devuelve copia y no puntero a propósito: el llamador imprime
// sin sostener el candado, y para entonces la configuración pudo cambiar.
func (a *App) printerParaDoc(acct *Account, docType string) *Printer {
	a.cfgMu.RLock()
	defer a.cfgMu.RUnlock()
	p := a.cfg.PrinterForDoc(acct, docType)
	if p == nil {
		return nil
	}
	copia := *p
	return &copia
}

// primeraImpresora devuelve una copia de la impresora indicada, o de la primera
// configurada si el id no existe.
func (a *App) primeraImpresora(id string) *Printer {
	a.cfgMu.RLock()
	defer a.cfgMu.RUnlock()
	if p := a.cfg.GetPrinter(id); p != nil {
		copia := *p
		return &copia
	}
	if len(a.cfg.Printers) > 0 {
		copia := a.cfg.Printers[0]
		return &copia
	}
	return nil
}

// SavePrinter agrega o actualiza una impresora. Si id viene vacío, crea una nueva
// y devuelve su id.
func (a *App) SavePrinter(id, name string, paperWidth int, autoCut bool, qrMode string) (string, error) {
	if name == "" {
		return "", fmt.Errorf("selecciona una impresora")
	}
	if paperWidth == 0 {
		paperWidth = 80
	}
	if qrMode == "" {
		qrMode = QRModeRaster
	}

	a.cfgMu.Lock()
	defer a.cfgMu.Unlock()

	if id != "" {
		if p := a.cfg.GetPrinter(id); p != nil {
			p.Name = name
			p.PaperWidth = paperWidth
			p.AutoCut = autoCut
			p.QRMode = qrMode
			return id, a.cfg.Save()
		}
	}

	p := Printer{ID: NewPrinterID(), Name: name, PaperWidth: paperWidth, AutoCut: autoCut, QRMode: qrMode}
	a.cfg.Printers = append(a.cfg.Printers, p)
	return p.ID, a.cfg.Save()
}

// RemovePrinter elimina una impresora. Las cuentas que la usaban quedan
// apuntando a la primera disponible (PrinterForDoc hace ese respaldo).
func (a *App) RemovePrinter(id string) error {
	a.cfgMu.Lock()
	defer a.cfgMu.Unlock()

	out := a.cfg.Printers[:0]
	for _, p := range a.cfg.Printers {
		if p.ID != id {
			out = append(out, p)
		}
	}
	a.cfg.Printers = out
	return a.cfg.Save()
}

// ── Cuentas ───────────────────────────────────────────────────────

// GetAccounts devuelve las cuentas configuradas.
func (a *App) GetAccounts() []Account {
	a.cfgMu.RLock()
	defer a.cfgMu.RUnlock()
	return append([]Account(nil), a.cfg.Accounts...)
}

// SaveAccount agrega o actualiza una cuenta identificada por su llave.
// Valida la llave contra el servidor antes de guardarla: es mejor rechazarla
// acá que descubrir que no sirve cuando entre el primer pedido.
func (a *App) SaveAccount(printKey, alias, comandaPrinter, reciboPrinter string, enabled bool) error {
	if len(printKey) != 64 {
		return fmt.Errorf("la clave debe tener 64 caracteres")
	}

	// La validación va ANTES de tomar el candado, y a propósito:
	//   1. es una llamada de red, y sostener el candado durante un viaje al
	//      servidor bloquearía toda impresión mientras tanto;
	//   2. si fallaba dentro del bloque, el `return` se llevaba el candado
	//      puesto y dejaba el agente congelado para siempre.
	a.cfgMu.RLock()
	yaExiste := a.cfg.FindAccount(printKey) != nil
	apiURL := a.cfg.APIUrl
	a.cfgMu.RUnlock()

	if !yaExiste {
		name, err := validateKey(apiURL, printKey)
		if err != nil {
			return err
		}
		if alias == "" {
			alias = name
		}
	}

	a.cfgMu.Lock()
	existing := a.cfg.FindAccount(printKey)
	if existing == nil {
		a.cfg.Accounts = append(a.cfg.Accounts, Account{
			Alias:          alias,
			PrintKey:       printKey,
			ComandaPrinter: comandaPrinter,
			ReciboPrinter:  reciboPrinter,
			Enabled:        enabled,
		})
	} else {
		existing.Alias = alias
		existing.ComandaPrinter = comandaPrinter
		existing.ReciboPrinter = reciboPrinter
		existing.Enabled = enabled
	}

	err := a.cfg.Save()
	a.cfgMu.Unlock()
	if err != nil {
		return err
	}
	go a.syncAccounts()
	return nil
}

// RemoveAccount desconecta y elimina una cuenta.
func (a *App) RemoveAccount(printKey string) error {
	a.cfgMu.Lock()
	out := a.cfg.Accounts[:0]
	for _, acc := range a.cfg.Accounts {
		if acc.PrintKey != printKey {
			out = append(out, acc)
		}
	}
	a.cfg.Accounts = out
	err := a.cfg.Save()
	a.cfgMu.Unlock()
	if err != nil {
		return err
	}
	go a.syncAccounts()
	return nil
}

// ValidateKey tests a print key against the server
func (a *App) ValidateKey(key string) (string, error) {
	a.cfgMu.RLock()
	apiURL := a.cfg.APIUrl
	a.cfgMu.RUnlock()
	return validateKey(apiURL, key)
}

// GetPrinters returns list of available printers
func (a *App) GetPrinters() ([]string, error) {
	return ListPrinters()
}

// GetDefaultPrinterName returns the OS default printer
func (a *App) GetDefaultPrinterName() string {
	return GetDefaultPrinter()
}

// Connect conecta todas las cuentas activas
func (a *App) Connect() {
	go a.syncAccounts()
}

// Disconnect corta todas las conexiones
func (a *App) Disconnect() {
	a.stopAllClients()
}

// Reconnect fuerza una reconexión de todas las cuentas
func (a *App) Reconnect() {
	a.stopAllClients()
	time.Sleep(300 * time.Millisecond)
	go a.syncAccounts()
}

// GetStatus returns the current agent status.
// `accounts` trae el estado de cada cuenta por separado; `connected` es un
// resumen (true si al menos una está conectada) para el icono de la bandeja.
func (a *App) GetStatus() map[string]interface{} {
	a.mu.Lock()
	clients := make(map[string]*SSEClient, len(a.clients))
	for k, v := range a.clients {
		clients[k] = v
	}
	printCount := a.printCount
	lastError := a.lastError
	a.mu.Unlock()

	// Instantánea de la configuración: la UI pide el estado cada pocos segundos
	// y podría estar leyendo mientras alguien agrega un negocio.
	a.cfgMu.RLock()
	cuentas := append([]Account(nil), a.cfg.Accounts...)
	impresoraRecibo := make(map[string]string, len(cuentas))
	impresoraComanda := make(map[string]string, len(cuentas))
	for i := range cuentas {
		if p := a.cfg.PrinterForDoc(&cuentas[i], "recibo"); p != nil {
			impresoraRecibo[cuentas[i].PrintKey] = p.Name
		}
		if p := a.cfg.PrinterForDoc(&cuentas[i], "comanda"); p != nil {
			impresoraComanda[cuentas[i].PrintKey] = p.Name
		}
	}
	a.cfgMu.RUnlock()

	anyConnected := false
	accounts := make([]map[string]interface{}, 0, len(cuentas))

	for i := range cuentas {
		acc := cuentas[i]
		entry := map[string]interface{}{
			"printKey":  acc.PrintKey,
			"alias":     AccountLabel(&acc),
			"enabled":   acc.Enabled,
			"connected": false,
			"business":  "",
			"printMode": "",
			"showQR":    false,
			"lastError": "",
		}

		if c, ok := clients[acc.PrintKey]; ok && c != nil {
			connected := c.IsConnected()
			entry["connected"] = connected
			entry["lastError"] = c.LastError()
			if connected {
				anyConnected = true
			}
			if b := c.GetBusiness(); b != nil {
				entry["business"] = b.BusinessName
				entry["printMode"] = b.PrintMode
				entry["showQR"] = b.ShowQR
			}
		}

		entry["reciboPrinterName"] = impresoraRecibo[acc.PrintKey]
		entry["comandaPrinterName"] = impresoraComanda[acc.PrintKey]

		accounts = append(accounts, entry)
	}

	return map[string]interface{}{
		"connected":  anyConnected,
		"accounts":   accounts,
		"printCount": printCount,
		"lastError":  lastError,
	}
}

// TestPrint imprime un ticket de prueba en una impresora concreta.
// Si printerID viene vacío usa la primera configurada.
func (a *App) TestPrint(printerID string) error {
	printer := a.primeraImpresora(printerID)
	if printer == nil {
		return fmt.Errorf("no hay ninguna impresora configurada")
	}

	// Se usan los datos de la primera cuenta conectada para que la prueba se
	// parezca a un ticket real (incluido el QR si el negocio lo tiene activo).
	business := &BusinessInfo{BusinessName: "Test Business", Phone: "0000000000"}
	a.mu.Lock()
	for _, c := range a.clients {
		if b := c.GetBusiness(); b != nil {
			business = b
			break
		}
	}
	a.mu.Unlock()

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

	printerName, err := ResolvePrinterName(printer.Name)
	if err != nil {
		return err
	}

	a.printMu.Lock()
	defer a.printMu.Unlock()

	comanda := GenerateComanda(testOrder, business, printer.PaperWidth, printer.AutoCut)
	if err := PrintRaw(printerName, comanda, printer.PaperWidth); err != nil {
		return fmt.Errorf("error imprimiendo comanda: %w", err)
	}

	time.Sleep(300 * time.Millisecond)

	recibo := GenerateRecibo(testOrder, business, printer.PaperWidth, printer.AutoCut, printer.QRMode)
	if err := PrintRaw(printerName, recibo, printer.PaperWidth); err != nil {
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

// ReprintJob reprints a specific job from history by ID.
// Se reimprime en la MISMA impresora donde salió originalmente: con varias
// marcas y varias impresoras, mandarlo a otra sería un ticket perdido.
func (a *App) ReprintJob(id string) error {
	rawData, err := a.history.GetRawData(id)
	if err != nil {
		return err
	}

	var printer *Printer
	for _, e := range a.history.GetEntries() {
		if e["id"] == id {
			if pid, ok := e["printerId"].(string); ok && pid != "" {
				printer = a.primeraImpresora(pid)
			}
			break
		}
	}
	if printer == nil {
		printer = a.primeraImpresora("")
	}
	if printer == nil {
		return fmt.Errorf("no hay ninguna impresora configurada")
	}

	printerName, err := ResolvePrinterName(printer.Name)
	if err != nil {
		return err
	}

	a.printMu.Lock()
	defer a.printMu.Unlock()
	return PrintRaw(printerName, rawData, printer.PaperWidth)
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

// GetPrinterStatusInfo returns the status of every configured printer
func (a *App) GetPrinterStatusInfo() []map[string]interface{} {
	impresoras := a.GetPrintersConfig()
	out := make([]map[string]interface{}, 0, len(impresoras))
	for _, p := range impresoras {
		var st map[string]interface{}
		if p.Name == "" {
			st = map[string]interface{}{"status": "none", "label": "Sin impresora", "online": false}
		} else {
			st = GetPrinterStatus(p.Name)
		}
		st["id"] = p.ID
		st["name"] = p.Name
		st["paperWidth"] = p.PaperWidth
		out = append(out, st)
	}
	return out
}

// ── Auto-update ───────────────────────────────────────────────────

// GetVersion returns the current app version
func (a *App) GetVersion() string {
	return AppVersion
}

// CheckForUpdate checks the server for a newer version
func (a *App) CheckForUpdate() map[string]interface{} {
	a.cfgMu.RLock()
	apiURL := a.cfg.APIUrl
	a.cfgMu.RUnlock()

	url := apiURL + "/uploads/print-agent/version.json"
	log.Printf("[update] Checking for updates at: %s (current: %s)", url, AppVersion)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		log.Printf("[update] HTTP error: %v", err)
		return map[string]interface{}{"available": false}
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		log.Printf("[update] Non-200 status: %d", resp.StatusCode)
		return map[string]interface{}{"available": false}
	}

	var info struct {
		Version     string `json:"version"`
		DownloadURL string `json:"downloadUrl"`
		Notes       string `json:"notes"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		log.Printf("[update] JSON decode error: %v", err)
		return map[string]interface{}{"available": false}
	}

	ver := strings.TrimPrefix(info.Version, "v")
	log.Printf("[update] Server version: %s, local: %s", ver, AppVersion)
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

// ── Internal methods ──────────────────────────────────────────────

// stopAllClients corta y olvida todas las conexiones.
func (a *App) stopAllClients() {
	a.mu.Lock()
	clients := a.clients
	a.clients = make(map[string]*SSEClient)
	a.mu.Unlock()

	for _, c := range clients {
		c.Stop()
	}
}

// syncAccounts pone las conexiones al día con la configuración: levanta las
// cuentas activas que aún no están conectadas y baja las que se desactivaron
// o se borraron. Es idempotente, así que se puede llamar cada vez que cambie
// algo sin miedo a duplicar conexiones.
func (a *App) syncAccounts() {
	a.cfgMu.RLock()
	apiURL := a.cfg.APIUrl
	wanted := make(map[string]Account)
	for _, acc := range a.cfg.EnabledAccounts() {
		wanted[acc.PrintKey] = acc
	}
	a.cfgMu.RUnlock()

	a.mu.Lock()
	if a.clients == nil {
		a.clients = make(map[string]*SSEClient)
	}
	// Bajar lo que sobra
	var toStop []*SSEClient
	for key, c := range a.clients {
		if _, ok := wanted[key]; !ok {
			toStop = append(toStop, c)
			delete(a.clients, key)
		}
	}
	// Levantar lo que falta
	var toStart []*SSEClient
	for key, acc := range wanted {
		if _, ok := a.clients[key]; ok {
			continue
		}
		acc := acc
		c := NewSSEClient(apiURL, acc.PrintKey)
		c.onConnect = func(info *BusinessInfo) {
			log.Printf("[%s] Conectado a: %s", AccountLabel(&acc), info.BusinessName)
			a.emit("connected", info.BusinessName)
		}
		c.onDisconnect = func() {
			log.Printf("[%s] Desconectado", AccountLabel(&acc))
			a.emit("disconnected", nil)
		}
		c.onOrder = func(order map[string]interface{}) {
			mode := "both"
			if b := c.GetBusiness(); b != nil && b.PrintMode != "" {
				mode = b.PrintMode
			}
			if mode == "comanda" || mode == "both" {
				a.handlePrint(&acc, c, order, "comanda")
			}
			if mode == "recibo" || mode == "both" {
				a.handlePrint(&acc, c, order, "recibo")
			}
		}
		c.onReceipt = func(order map[string]interface{}) {
			// Impresión manual desde el panel: sale siempre, sin importar el modo.
			a.handlePrint(&acc, c, order, "recibo")
		}
		a.clients[key] = c
		toStart = append(toStart, c)
	}
	a.mu.Unlock()

	for _, c := range toStop {
		c.Stop()
	}
	for _, c := range toStart {
		c.Start()
	}
}

// emit manda un evento a la interfaz solo si ya hay contexto de Wails.
// Durante el arranque las cuentas pueden conectarse antes de que la ventana
// exista, y emitir sin contexto revienta.
func (a *App) emit(name string, data interface{}) {
	if a.ctx == nil {
		return
	}
	runtime.EventsEmit(a.ctx, name, data)
}

func (a *App) handlePrint(acct *Account, client *SSEClient, order map[string]interface{}, docType string) {
	business := client.GetBusiness()
	if business == nil {
		log.Printf("[Print] Sin datos del negocio para %s, se omite", AccountLabel(acct))
		return
	}

	label := AccountLabel(acct)
	orderNum := getString(order, "orderNumber")

	printer := a.printerParaDoc(acct, docType)
	if printer == nil {
		msg := "no hay ninguna impresora configurada"
		a.recordFailure(label, "", orderNum, docType, msg, nil)
		return
	}

	var data []byte
	if docType == "comanda" {
		data = GenerateComanda(order, business, printer.PaperWidth, printer.AutoCut)
	} else {
		data = GenerateRecibo(order, business, printer.PaperWidth, printer.AutoCut, printer.QRMode)
	}

	printerName, err := ResolvePrinterName(printer.Name)
	if err != nil {
		a.recordFailure(label, printer.ID, orderNum, docType, err.Error(), data)
		return
	}

	// Un ticket entero por vez. Dos marcas pueden compartir impresora, y sin
	// este candado sus bytes se intercalarían a mitad de papel.
	a.printMu.Lock()
	err = PrintRaw(printerName, data, printer.PaperWidth)
	a.printMu.Unlock()

	if err != nil {
		a.recordFailure(label, printer.ID, orderNum, docType, err.Error(), data)
		return
	}

	a.history.AddEntry(orderNum, docType, "ok", "", data, label, printer.ID)

	a.mu.Lock()
	a.printCount++
	count := a.printCount
	a.lastError = ""
	a.mu.Unlock()

	log.Printf("[Print][%s] %s #%s impreso en %q (total: %d)", label, docType, orderNum, printer.Name, count)

	a.emit("printed", map[string]interface{}{
		"account":     label,
		"docType":     docType,
		"orderNumber": orderNum,
		"printer":     printer.Name,
		"count":       count,
		"timestamp":   time.Now().Format("15:04:05"),
	})
}

// recordFailure deja constancia de una impresión fallida en el log, el
// historial y la interfaz. El ticket queda guardado en el historial aunque no
// haya salido, para poder reimprimirlo cuando se resuelva el problema.
func (a *App) recordFailure(accountLabel, printerID, orderNum, docType, msg string, data []byte) {
	a.mu.Lock()
	a.lastError = msg
	a.mu.Unlock()

	log.Printf("[Print][%s] error imprimiendo %s #%s: %s", accountLabel, docType, orderNum, msg)
	a.history.AddEntry(orderNum, docType, "error", msg, data, accountLabel, printerID)
	a.emit("printError", msg)
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
