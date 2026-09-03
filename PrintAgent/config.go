package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Printer es una impresora física. El ancho de papel y el autocorte viven acá
// —no en la cuenta— porque son propiedades del aparato: si dos marcas comparten
// la misma impresora, comparten forzosamente su ancho de papel.
type Printer struct {
	ID         string `json:"id"`
	Name       string `json:"name"`       // nombre de la impresora en Windows
	PaperWidth int    `json:"paperWidth"` // 80, 76, 58 o 44 mm
	AutoCut    bool   `json:"autoCut"`
	// Cómo imprimir el QR: "raster" (imagen, compatible con casi todas),
	// "native" (comando GS ( k, más nítido pero no todas lo soportan)
	// u "off" (nunca imprimir QR en esta impresora).
	QRMode string `json:"qrMode,omitempty"`
}

// Account es un negocio de MenuBy conectado a este agente. Cada uno mantiene su
// propia conexión y sus propios datos (nombre, NIT, dirección) porque el ticket
// de la Marca B no puede salir con el encabezado de la Marca A.
type Account struct {
	Alias          string `json:"alias"`
	PrintKey       string `json:"printKey"`
	ComandaPrinter string `json:"comandaPrinter"` // Printer.ID
	ReciboPrinter  string `json:"reciboPrinter"`  // Printer.ID
	Enabled        bool   `json:"enabled"`
}

// Config holds all Print Agent settings
type Config struct {
	APIUrl   string    `json:"apiUrl"`
	Printers []Printer `json:"printers"`
	Accounts []Account `json:"accounts"`

	// ── Campos del formato viejo (v1: una sola cuenta, una sola impresora) ──
	// Solo se leen para migrar. LoadConfig los convierte en una impresora y una
	// cuenta, y los deja vacíos: con `omitempty` desaparecen del archivo.
	PrintKey    string `json:"printKey,omitempty"`
	PrinterName string `json:"printerName,omitempty"`
	PaperWidth  int    `json:"paperWidth,omitempty"`
	AutoCut     bool   `json:"autoCut,omitempty"`
	TestMode    bool   `json:"testMode,omitempty"`
}

// CurrentAPIUrl es el endpoint actual de producción. Si cambia el server,
// se actualiza acá y la migración en LoadConfig se encarga de los clientes viejos.
const CurrentAPIUrl = "https://159-203-136-199.nip.io"

// LegacyAPIUrls contiene URLs antiguas que deben migrarse automáticamente
// al CurrentAPIUrl al cargar el config.
var LegacyAPIUrls = []string{
	"https://157-245-125-216.nip.io",
}

// QR modes
const (
	QRModeRaster = "raster"
	QRModeNative = "native"
	QRModeOff    = "off"
)

// DefaultConfig returns factory defaults
func DefaultConfig() *Config {
	return &Config{
		APIUrl:   CurrentAPIUrl,
		Printers: []Printer{},
		Accounts: []Account{},
	}
}

// configPath returns the path to config.json next to the executable
func configPath() string {
	exe, err := os.Executable()
	if err != nil {
		return "config.json"
	}
	return filepath.Join(filepath.Dir(exe), "config.json")
}

// NewPrinterID genera un id corto y único para una impresora nueva.
func NewPrinterID() string {
	return fmt.Sprintf("p%d", time.Now().UnixNano()%1000000)
}

// LoadConfig loads configuration from disk or creates defaults
func LoadConfig() (*Config, error) {
	path := configPath()
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			cfg := DefaultConfig()
			_ = cfg.Save()
			return cfg, nil
		}
		return nil, fmt.Errorf("error reading config: %w", err)
	}

	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("error parsing config: %w", err)
	}

	if cfg.migrate() {
		_ = cfg.Save()
	}

	return &cfg, nil
}

// migrate normaliza un config recién leído y devuelve true si hubo cambios que
// valga la pena persistir. Está separado de LoadConfig para poder probarlo sin
// tocar disco: si esta migración falla, un negocio que actualiza el agente se
// queda sin imprimir, y eso no se puede descubrir en producción.
func (c *Config) migrate() bool {
	changed := false

	if c.APIUrl == "" {
		c.APIUrl = CurrentAPIUrl
		changed = true
	}

	// Si el apiUrl apunta a un server retirado, actualizarlo transparentemente.
	for _, legacy := range LegacyAPIUrls {
		if c.APIUrl == legacy {
			c.APIUrl = CurrentAPIUrl
			changed = true
			break
		}
	}

	// Formato v1 → v2. Un agente que venía funcionando con una sola llave y una
	// sola impresora queda exactamente igual de funcional: se convierte en una
	// impresora y una cuenta, sin que el usuario toque nada.
	if len(c.Accounts) == 0 && c.PrintKey != "" {
		width := c.PaperWidth
		if width == 0 {
			width = 80
		}
		p := Printer{
			ID:         "principal",
			Name:       c.PrinterName,
			PaperWidth: width,
			AutoCut:    c.AutoCut,
			QRMode:     QRModeRaster,
		}
		c.Printers = append(c.Printers, p)
		c.Accounts = append(c.Accounts, Account{
			Alias:          "Mi negocio",
			PrintKey:       c.PrintKey,
			ComandaPrinter: p.ID,
			ReciboPrinter:  p.ID,
			Enabled:        true,
		})
		c.PrintKey = ""
		c.PrinterName = ""
		c.PaperWidth = 0
		c.AutoCut = false
		changed = true
	}

	// Sanear datos: anchos en cero, ids faltantes y modos de QR vacíos.
	for i := range c.Printers {
		if c.Printers[i].PaperWidth == 0 {
			c.Printers[i].PaperWidth = 80
			changed = true
		}
		if c.Printers[i].QRMode == "" {
			c.Printers[i].QRMode = QRModeRaster
			changed = true
		}
		if c.Printers[i].ID == "" {
			c.Printers[i].ID = NewPrinterID()
			changed = true
		}
	}

	return changed
}

// Save writes configuration to disk
func (c *Config) Save() error {
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(configPath(), data, 0600)
}

// IsConfigured returns true if at least one enabled account has a valid key
func (c *Config) IsConfigured() bool {
	return len(c.EnabledAccounts()) > 0
}

// EnabledAccounts devuelve las cuentas activas con llave válida.
func (c *Config) EnabledAccounts() []Account {
	var out []Account
	for _, a := range c.Accounts {
		if a.Enabled && len(a.PrintKey) == 64 {
			out = append(out, a)
		}
	}
	return out
}

// GetPrinter busca una impresora por id.
func (c *Config) GetPrinter(id string) *Printer {
	for i := range c.Printers {
		if c.Printers[i].ID == id {
			return &c.Printers[i]
		}
	}
	return nil
}

// PrinterForDoc resuelve a qué impresora va un documento de una cuenta.
// Si la cuenta no tiene impresora asignada (o apunta a una que ya no existe),
// cae a la primera configurada: es preferible imprimir en la impresora
// equivocada que perder el pedido en silencio.
func (c *Config) PrinterForDoc(acct *Account, docType string) *Printer {
	id := acct.ReciboPrinter
	if docType == "comanda" {
		id = acct.ComandaPrinter
	}
	if p := c.GetPrinter(id); p != nil {
		return p
	}
	if len(c.Printers) > 0 {
		return &c.Printers[0]
	}
	return nil
}

// FindAccount busca una cuenta por su llave.
func (c *Config) FindAccount(printKey string) *Account {
	for i := range c.Accounts {
		if c.Accounts[i].PrintKey == printKey {
			return &c.Accounts[i]
		}
	}
	return nil
}

// AccountLabel devuelve un nombre legible para logs e historial.
func AccountLabel(a *Account) string {
	if a == nil {
		return ""
	}
	if strings.TrimSpace(a.Alias) != "" {
		return a.Alias
	}
	if len(a.PrintKey) >= 8 {
		return "cuenta " + a.PrintKey[:8]
	}
	return "cuenta"
}
