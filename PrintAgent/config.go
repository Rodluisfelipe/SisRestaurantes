package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// Config holds all Print Agent settings
type Config struct {
	APIUrl      string `json:"apiUrl"`
	PrintKey    string `json:"printKey"`
	PrinterName string `json:"printerName"`
	PaperWidth  int    `json:"paperWidth"` // 80, 76, 58 or 44 mm
	AutoCut     bool   `json:"autoCut"`
	TestMode    bool   `json:"testMode"`
}

// CurrentAPIUrl es el endpoint actual de producción. Si cambia el server,
// se actualiza acá y la migración en LoadConfig se encarga de los clientes viejos.
const CurrentAPIUrl = "https://159-203-136-199.nip.io"

// LegacyAPIUrls contiene URLs antiguas que deben migrarse automáticamente
// al CurrentAPIUrl al cargar el config.
var LegacyAPIUrls = []string{
	"https://157-245-125-216.nip.io",
}

// DefaultConfig returns factory defaults
func DefaultConfig() *Config {
	return &Config{
		APIUrl:      CurrentAPIUrl,
		PrintKey:    "",
		PrinterName: "",
		PaperWidth:  80,
		AutoCut:     true,
		TestMode:    false,
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

	// Apply defaults for missing fields
	if cfg.PaperWidth == 0 {
		cfg.PaperWidth = 80
	}

	// Auto-migración: si el apiUrl apunta a un server retirado, actualizarlo
	// transparentemente al actual. El cliente conserva su printKey/printerName.
	migrated := false
	for _, legacy := range LegacyAPIUrls {
		if cfg.APIUrl == legacy {
			cfg.APIUrl = CurrentAPIUrl
			migrated = true
			break
		}
	}
	if migrated {
		_ = cfg.Save()
	}

	return &cfg, nil
}

// Save writes configuration to disk
func (c *Config) Save() error {
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(configPath(), data, 0600)
}

// IsConfigured returns true if the agent has a valid print key
func (c *Config) IsConfigured() bool {
	return c.PrintKey != "" && len(c.PrintKey) == 64
}
