package main

import (
	"fmt"
	"log"
	"strings"
	"syscall"
	"unsafe"

	winprinter "github.com/alexbrainman/printer"
)

// ListPrinters returns the names of all installed printers
func ListPrinters() ([]string, error) {
	printers, err := winprinter.ReadNames()
	if err != nil {
		return nil, fmt.Errorf("listing printers: %w", err)
	}
	// Add test/file option at the end
	printers = append(printers, "Archivo (prueba)")
	return printers, nil
}

// GetDefaultPrinter returns the OS default printer name
func GetDefaultPrinter() string {
	winspool := syscall.NewLazyDLL("winspool.drv")
	proc := winspool.NewProc("GetDefaultPrinterW")

	var bufSize uint32 = 256
	buf := make([]uint16, bufSize)
	ret, _, _ := proc.Call(
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(unsafe.Pointer(&bufSize)),
	)
	if ret == 0 {
		return ""
	}
	return syscall.UTF16ToString(buf)
}

// PrintRaw sends raw ESC/POS bytes to a named printer
// isTestPrinter checks if the printer name is the test/file mode
func isTestPrinter(name string) bool {
	lower := strings.ToLower(name)
	return lower == "archivo (prueba)" || lower == "file (test)"
}

// stripESCPOS removes ESC/POS control codes and returns readable text
func stripESCPOS(data []byte) string {
	var result []byte
	i := 0
	for i < len(data) {
		b := data[i]
		if b == 0x1B { // ESC sequence
			i++ // skip ESC
			if i < len(data) {
				cmd := data[i]
				i++
				switch cmd {
				case '@', 'E', 'a', 'd', 'i', 'p': // 1-byte commands
				case '!', 'J', 'V': // 2-byte commands (ESC + cmd + param)
					if i < len(data) {
						i++
					}
				case 'G': // ESC G n
					if i < len(data) {
						i++
					}
				default:
				}
			}
			continue
		}
		if b == 0x1D { // GS sequence
			i++
			if i < len(data) {
				i++ // skip cmd
				if i < len(data) {
					i++ // skip param
				}
			}
			continue
		}
		if b == 0x07 || b == 0x00 { // BEL, NUL
			i++
			continue
		}
		if b == '\n' || b == '\r' || (b >= 0x20 && b <= 0x7E) || b >= 0xC0 {
			result = append(result, b)
		}
		i++
	}
	return string(result)
}

// saveToFile saves ticket as a PDF that mimics thermal printer output
func saveToFile(data []byte, docType string, paperWidthMM int) error {
	_, err := saveTicketPDF(data, docType, paperWidthMM)
	return err
}

func PrintRaw(printerName string, data []byte, paperWidthMM ...int) error {
	// Test mode: save PDF to file instead of printing
	if isTestPrinter(printerName) {
		pw := 80
		if len(paperWidthMM) > 0 && paperWidthMM[0] > 0 {
			pw = paperWidthMM[0]
		}
		return saveToFile(data, "ticket", pw)
	}

	p, err := winprinter.Open(printerName)
	if err != nil {
		return fmt.Errorf("opening printer %q: %w", printerName, err)
	}
	defer p.Close()

	err = p.StartRawDocument("MenuBy Ticket")
	if err != nil {
		return fmt.Errorf("starting document: %w", err)
	}

	err = p.StartPage()
	if err != nil {
		return fmt.Errorf("starting page: %w", err)
	}

	_, err = p.Write(data)
	if err != nil {
		return fmt.Errorf("writing data: %w", err)
	}

	err = p.EndPage()
	if err != nil {
		return fmt.Errorf("ending page: %w", err)
	}

	err = p.EndDocument()
	if err != nil {
		return fmt.Errorf("ending document: %w", err)
	}

	return nil
}

// FindPrinter checks if a printer name exists (case-insensitive partial match)
func FindPrinter(name string) (string, error) {
	if isTestPrinter(name) {
		return "Archivo (prueba)", nil
	}

	printers, err := ListPrinters()
	if err != nil {
		return "", err
	}

	nameLower := strings.ToLower(name)

	// Exact match first
	for _, p := range printers {
		if strings.ToLower(p) == nameLower {
			return p, nil
		}
	}

	// Partial match
	for _, p := range printers {
		if strings.Contains(strings.ToLower(p), nameLower) {
			return p, nil
		}
	}

	return "", fmt.Errorf("printer %q not found. Available: %s", name, strings.Join(printers, ", "))
}

// ResolvePrinter finds the best printer based on config
func ResolvePrinter(cfg *Config) (string, error) {
	if cfg.PrinterName != "" {
		return FindPrinter(cfg.PrinterName)
	}

	// Fall back to the system default
	def := GetDefaultPrinter()
	if def != "" {
		log.Printf("[Printer] Using default: %s", def)
		return def, nil
	}

	return "", fmt.Errorf("no printer configured and no default printer found")
}

// Printer status constants
const (
	printerStatusPaused    = 0x00000001
	printerStatusError     = 0x00000002
	printerStatusPaperJam  = 0x00000008
	printerStatusPaperOut  = 0x00000010
	printerStatusOffline   = 0x00000080
)

// GetPrinterStatus returns the status of a named printer via winspool.drv
func GetPrinterStatus(printerName string) map[string]interface{} {
	if isTestPrinter(printerName) {
		return map[string]interface{}{
			"status": "ready",
			"label":  "Archivo (prueba)",
			"online": true,
		}
	}

	winspool := syscall.NewLazyDLL("winspool.drv")
	openPrinter := winspool.NewProc("OpenPrinterW")
	closePrinter := winspool.NewProc("ClosePrinter")
	getPrinter := winspool.NewProc("GetPrinterW")

	nameW, _ := syscall.UTF16PtrFromString(printerName)
	var handle uintptr
	ret, _, _ := openPrinter.Call(uintptr(unsafe.Pointer(nameW)), uintptr(unsafe.Pointer(&handle)), 0)
	if ret == 0 {
		return map[string]interface{}{
			"status": "error",
			"label":  "No disponible",
			"online": false,
		}
	}
	defer closePrinter.Call(handle)

	// PRINTER_INFO_6 = { DWORD dwStatus; } — the simplest level
	var needed uint32
	getPrinter.Call(handle, 6, 0, 0, uintptr(unsafe.Pointer(&needed)))
	if needed == 0 {
		needed = 4
	}

	buf := make([]byte, needed)
	ret, _, _ = getPrinter.Call(handle, 6,
		uintptr(unsafe.Pointer(&buf[0])), uintptr(needed),
		uintptr(unsafe.Pointer(&needed)))
	if ret == 0 {
		return map[string]interface{}{
			"status": "unknown",
			"label":  "Desconocido",
			"online": true,
		}
	}

	status := *(*uint32)(unsafe.Pointer(&buf[0]))

	if status == 0 {
		return map[string]interface{}{"status": "ready", "label": "Lista", "online": true}
	}
	if status&printerStatusOffline != 0 {
		return map[string]interface{}{"status": "offline", "label": "Fuera de linea", "online": false}
	}
	if status&printerStatusPaperOut != 0 {
		return map[string]interface{}{"status": "paper_out", "label": "Sin papel", "online": false}
	}
	if status&printerStatusPaperJam != 0 {
		return map[string]interface{}{"status": "paper_jam", "label": "Papel atascado", "online": false}
	}
	if status&printerStatusError != 0 {
		return map[string]interface{}{"status": "error", "label": "Error", "online": false}
	}
	if status&printerStatusPaused != 0 {
		return map[string]interface{}{"status": "paused", "label": "Pausada", "online": true}
	}

	return map[string]interface{}{"status": "ready", "label": "Lista", "online": true}
}
