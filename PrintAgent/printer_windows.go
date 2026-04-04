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
	return printers, nil
}

// GetDefaultPrinter returns the OS default printer name
func GetDefaultPrinter() string {
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	proc := kernel32.NewProc("GetDefaultPrinterW")

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
func PrintRaw(printerName string, data []byte) error {
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
