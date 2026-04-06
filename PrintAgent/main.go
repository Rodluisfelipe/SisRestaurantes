package main

import (
	"context"
	"embed"
	"fmt"
	"log"
	"os"
	"syscall"
	"unsafe"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed frontend/dist
var assets embed.FS

// ensureSingleInstance creates a named mutex so only one copy can run.
// Returns a handle that must be kept alive for the process lifetime.
func ensureSingleInstance() (uintptr, error) {
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	createMutex := kernel32.NewProc("CreateMutexW")
	name, _ := syscall.UTF16PtrFromString("Global\\MenuByPrintAgent_SingleInstance")
	handle, _, err := createMutex.Call(0, 1, uintptr(unsafe.Pointer(name)))
	if handle == 0 {
		return 0, fmt.Errorf("CreateMutex failed: %v", err)
	}
	// ERROR_ALREADY_EXISTS = 183
	if err.(syscall.Errno) == 183 {
		syscall.CloseHandle(syscall.Handle(handle))
		return 0, fmt.Errorf("already running")
	}
	return handle, nil
}

func main() {
	// Single instance guard — exit immediately if another copy is running
	mutexHandle, err := ensureSingleInstance()
	if err != nil {
		// Show a brief message box and exit
		user32 := syscall.NewLazyDLL("user32.dll")
		msgBox := user32.NewProc("MessageBoxW")
		title, _ := syscall.UTF16PtrFromString("MenuBy Print Agent")
		msg, _ := syscall.UTF16PtrFromString("El agente ya está en ejecución.\nRevisa el icono en la barra de tareas.")
		msgBox.Call(0, uintptr(unsafe.Pointer(msg)), uintptr(unsafe.Pointer(title)), 0x40) // MB_ICONINFORMATION
		os.Exit(0)
	}
	_ = mutexHandle // keep alive for process lifetime

	// Setup logging
	logFile, err := os.OpenFile("menuby-print.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err == nil {
		log.SetOutput(logFile)
	}
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("=== MenuBy Print Agent v2 starting ===")

	app := NewApp()

	err = wails.Run(&options.App{
		Title:     "MenuBy Print Agent",
		Width:     460,
		Height:    640,
		MinWidth:  400,
		MinHeight: 500,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 247, G: 247, B: 248, A: 255},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		OnBeforeClose: func(ctx context.Context) (prevent bool) {
			app.mu.Lock()
			quit := app.forceQuit
			app.mu.Unlock()
			if quit {
				return false // allow close
			}
			// Minimize to system tray instead of closing
			runtime.WindowHide(ctx)
			return true
		},
		Bind: []interface{}{
			app,
		},
		Windows: &windows.Options{
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
			Theme:                windows.Light,
		},
	})

	if err != nil {
		log.Fatalf("Error starting app: %v", err)
	}
}
