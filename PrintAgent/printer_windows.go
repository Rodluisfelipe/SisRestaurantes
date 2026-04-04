package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"time"
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

// saveToFile saves ticket as readable text file
func saveToFile(data []byte, docType string) error {
	exe, _ := os.Executable()
	dir := filepath.Dir(exe)
	ticketsDir := filepath.Join(dir, "tickets")
	os.MkdirAll(ticketsDir, 0755)

	timestamp := time.Now().Format("2006-01-02_15-04-05")
	filename := filepath.Join(ticketsDir, fmt.Sprintf("%s_%s.txt", docType, timestamp))

	text := stripESCPOS(data)
	err := os.WriteFile(filename, []byte(text), 0644)
	if err != nil {
		return err
	}
	log.Printf("[Print] Saved to file: %s", filename)
	return nil
}

func PrintRaw(printerName string, data []byte) error {
	// Test mode: save to file instead of printing
	if isTestPrinter(printerName) {
		return saveToFile(data, "ticket")
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
