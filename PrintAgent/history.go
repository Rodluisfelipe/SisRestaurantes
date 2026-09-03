package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const maxHistoryEntries = 100

// HistoryEntry represents a single print job
type HistoryEntry struct {
	ID          string `json:"id"`
	Timestamp   string `json:"timestamp"`
	OrderNumber string `json:"orderNumber"`
	DocType     string `json:"docType"` // "comanda" or "recibo"
	Status      string `json:"status"`  // "ok" or "error"
	Error       string `json:"error,omitempty"`
	RawData     string `json:"rawData"` // base64-encoded ESC/POS
	Preview     string `json:"preview"` // plain text preview (truncated)
	// Con varias marcas en un mismo agente, un historial sin dueño no sirve
	// para nada: hay que poder ver de qué negocio salió cada ticket y por
	// cuál impresora, sobre todo para reimprimir por la correcta.
	Account   string `json:"account,omitempty"`
	PrinterID string `json:"printerId,omitempty"`
}

// PrintHistory manages persistent print job history
type PrintHistory struct {
	Entries []HistoryEntry `json:"entries"`
	mu      sync.Mutex
	path    string
}

// NewPrintHistory creates and loads history from disk
func NewPrintHistory() *PrintHistory {
	h := &PrintHistory{
		Entries: []HistoryEntry{},
		path:    historyPath(),
	}
	h.load()
	return h
}

func historyPath() string {
	exe, err := os.Executable()
	if err != nil {
		return "print-history.json"
	}
	return filepath.Join(filepath.Dir(exe), "print-history.json")
}

func (h *PrintHistory) load() {
	data, err := os.ReadFile(h.path)
	if err != nil {
		return
	}
	_ = json.Unmarshal(data, h)
}

func (h *PrintHistory) save() {
	data, err := json.Marshal(h)
	if err != nil {
		return
	}
	_ = os.WriteFile(h.path, data, 0600)
}

// AddEntry adds a new entry to history (most recent first)
func (h *PrintHistory) AddEntry(orderNumber, docType, status, errMsg string, rawData []byte, account, printerID string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	entry := HistoryEntry{
		ID:          fmt.Sprintf("%d", time.Now().UnixMilli()),
		Timestamp:   time.Now().Format(time.RFC3339),
		OrderNumber: orderNumber,
		DocType:     docType,
		Status:      status,
		Error:       errMsg,
		RawData:     base64.StdEncoding.EncodeToString(rawData),
		Preview:     truncate(stripESCPOS(rawData), 200),
		Account:     account,
		PrinterID:   printerID,
	}

	h.Entries = append([]HistoryEntry{entry}, h.Entries...)
	if len(h.Entries) > maxHistoryEntries {
		h.Entries = h.Entries[:maxHistoryEntries]
	}
	h.save()
}

// GetEntries returns history entries (without raw data for lighter payloads)
func (h *PrintHistory) GetEntries() []map[string]interface{} {
	h.mu.Lock()
	defer h.mu.Unlock()

	result := make([]map[string]interface{}, len(h.Entries))
	for i, e := range h.Entries {
		result[i] = map[string]interface{}{
			"id":          e.ID,
			"timestamp":   e.Timestamp,
			"orderNumber": e.OrderNumber,
			"docType":     e.DocType,
			"status":      e.Status,
			"error":       e.Error,
			"preview":     e.Preview,
			"account":     e.Account,
			"printerId":   e.PrinterID,
		}
	}
	return result
}

// GetRawData returns the raw ESC/POS data for a specific entry
func (h *PrintHistory) GetRawData(id string) ([]byte, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	for _, e := range h.Entries {
		if e.ID == id {
			return base64.StdEncoding.DecodeString(e.RawData)
		}
	}
	return nil, fmt.Errorf("entry not found")
}

// GetFullPreview returns the full plain-text preview for a specific entry
func (h *PrintHistory) GetFullPreview(id string) (string, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	for _, e := range h.Entries {
		if e.ID == id {
			raw, err := base64.StdEncoding.DecodeString(e.RawData)
			if err != nil {
				return "", err
			}
			return stripESCPOS(raw), nil
		}
	}
	return "", fmt.Errorf("entry not found")
}

// GetLastEntry returns the ID of the most recent entry, or empty string
func (h *PrintHistory) GetLastEntry() string {
	h.mu.Lock()
	defer h.mu.Unlock()

	if len(h.Entries) == 0 {
		return ""
	}
	return h.Entries[0].ID
}

// Clear removes all history entries
func (h *PrintHistory) Clear() {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.Entries = []HistoryEntry{}
	h.save()
}
