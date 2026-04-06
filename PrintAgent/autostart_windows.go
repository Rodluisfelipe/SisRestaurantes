package main

import (
	"fmt"
	"os"
	"path/filepath"

	"golang.org/x/sys/windows/registry"
)

const autoStartKey = `SOFTWARE\Microsoft\Windows\CurrentVersion\Run`
const autoStartValueName = "MenuByPrintAgent"

// isAutoStartEnabled checks if the app is registered to start on Windows login
func isAutoStartEnabled() bool {
	k, err := registry.OpenKey(registry.CURRENT_USER, autoStartKey, registry.QUERY_VALUE)
	if err != nil {
		return false
	}
	defer k.Close()

	_, _, err = k.GetStringValue(autoStartValueName)
	return err == nil
}

// enableAutoStart registers the current exe to run on Windows login
func enableAutoStart() error {
	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("cannot determine exe path: %w", err)
	}
	exePath, _ = filepath.Abs(exePath)

	k, err := registry.OpenKey(registry.CURRENT_USER, autoStartKey, registry.SET_VALUE)
	if err != nil {
		return fmt.Errorf("cannot open registry key: %w", err)
	}
	defer k.Close()

	err = k.SetStringValue(autoStartValueName, fmt.Sprintf(`"%s"`, exePath))
	if err != nil {
		return fmt.Errorf("cannot set registry value: %w", err)
	}

	return nil
}

// disableAutoStart removes the auto-start registry entry
func disableAutoStart() error {
	k, err := registry.OpenKey(registry.CURRENT_USER, autoStartKey, registry.SET_VALUE)
	if err != nil {
		return fmt.Errorf("cannot open registry key: %w", err)
	}
	defer k.Close()

	err = k.DeleteValue(autoStartValueName)
	if err != nil {
		return fmt.Errorf("cannot delete registry value: %w", err)
	}

	return nil
}
