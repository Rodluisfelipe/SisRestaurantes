package main

import (
	"log"
	"os"
	"syscall"
	"unsafe"

	wailsrt "github.com/wailsapp/wails/v2/pkg/runtime"
)

// Windows constants for system tray
const (
	NIM_ADD    = 0x00000000
	NIM_DELETE = 0x00000002

	NIF_MESSAGE = 0x00000001
	NIF_ICON    = 0x00000002
	NIF_TIP     = 0x00000004

	wmUser         = 0x0400
	wmTrayCallback = wmUser + 1
	wmLButtonUp    = 0x0202
	wmLButtonDblClk = 0x0203
	wmRButtonUp    = 0x0205
	wmDestroy      = 0x0002
	wmCommand      = 0x0111

	idiApplication = 32512

	tpmBottomAlign = 0x0020
	tpmLeftAlign   = 0x0000
	mfString       = 0x00000000
	mfSeparator    = 0x00000800

	idmShow = 1001
	idmQuit = 1002
)

// notifyIconDataW — Shell_NotifyIconW input struct (basic V1 fields)
type notifyIconDataW struct {
	CbSize           uint32
	HWnd             uintptr
	UID              uint32
	UFlags           uint32
	UCallbackMessage uint32
	HIcon            uintptr
	SzTip            [128]uint16
}

type trayPoint struct{ X, Y int32 }

type trayMsg struct {
	HWnd    uintptr
	Message uint32
	WParam  uintptr
	LParam  uintptr
	Time    uint32
	Pt      trayPoint
}

type wndClassExW struct {
	CbSize        uint32
	Style         uint32
	LpfnWndProc   uintptr
	CbClsExtra    int32
	CbWndExtra    int32
	HInstance     uintptr
	HIcon         uintptr
	HCursor       uintptr
	HbrBackground uintptr
	LpszMenuName  uintptr
	LpszClassName uintptr
	HIconSm       uintptr
}

// Lazy DLL procs for tray
var (
	shell32Dll           = syscall.NewLazyDLL("shell32.dll")
	user32Dll            = syscall.NewLazyDLL("user32.dll")
	kernel32Dll          = syscall.NewLazyDLL("kernel32.dll")

	procShellNotifyIcon  = shell32Dll.NewProc("Shell_NotifyIconW")
	procExtractIcon      = shell32Dll.NewProc("ExtractIconW")
	procRegisterClassEx  = user32Dll.NewProc("RegisterClassExW")
	procCreateWindowEx   = user32Dll.NewProc("CreateWindowExW")
	procDefWindowProc    = user32Dll.NewProc("DefWindowProcW")
	procGetMessage       = user32Dll.NewProc("GetMessageW")
	procTranslateMessage = user32Dll.NewProc("TranslateMessage")
	procDispatchMessage  = user32Dll.NewProc("DispatchMessageW")
	procDestroyWindow    = user32Dll.NewProc("DestroyWindow")
	procPostQuitMessage  = user32Dll.NewProc("PostQuitMessage")
	procLoadIcon         = user32Dll.NewProc("LoadIconW")
	procGetModuleHandle  = kernel32Dll.NewProc("GetModuleHandleW")
	procCreatePopupMenu  = user32Dll.NewProc("CreatePopupMenu")
	procAppendMenu       = user32Dll.NewProc("AppendMenuW")
	procTrackPopupMenu   = user32Dll.NewProc("TrackPopupMenu")
	procDestroyMenu      = user32Dll.NewProc("DestroyMenu")
	procSetForeground    = user32Dll.NewProc("SetForegroundWindow")
	procGetCursorPos     = user32Dll.NewProc("GetCursorPos")
	procPostMessage      = user32Dll.NewProc("PostMessageW")
)

// trayIcon manages the system tray icon lifecycle
type trayIcon struct {
	app  *App
	hwnd uintptr
	nid  notifyIconDataW
}

// activeTray is the global reference for the Windows callback
var activeTray *trayIcon

// trayWndProc handles messages for the hidden tray window
func trayWndProc(hwnd, uMsg, wParam, lParam uintptr) uintptr {
	switch uMsg {
	case wmTrayCallback:
		switch lParam {
		case wmLButtonUp, wmLButtonDblClk:
			if activeTray != nil && activeTray.app != nil {
				wailsrt.WindowShow(activeTray.app.ctx)
			}
		case wmRButtonUp:
			if activeTray != nil {
				activeTray.showContextMenu()
			}
		}
		return 0
	case wmCommand:
		cmdID := int(wParam & 0xFFFF)
		switch cmdID {
		case idmShow:
			if activeTray != nil && activeTray.app != nil {
				wailsrt.WindowShow(activeTray.app.ctx)
			}
		case idmQuit:
			if activeTray != nil && activeTray.app != nil {
				activeTray.app.QuitApp()
			}
		}
		return 0
	case wmDestroy:
		procPostQuitMessage.Call(0)
		return 0
	}
	ret, _, _ := procDefWindowProc.Call(hwnd, uMsg, wParam, lParam)
	return ret
}

// newTrayIcon creates a system tray controller
func newTrayIcon(app *App) *trayIcon {
	t := &trayIcon{app: app}
	activeTray = t
	return t
}

// start launches the tray icon in a background goroutine
func (t *trayIcon) start() {
	go t.run()
}

func (t *trayIcon) run() {
	hInstance, _, _ := procGetModuleHandle.Call(0)

	className, _ := syscall.UTF16PtrFromString("MenuByTrayWndClass")

	wc := wndClassExW{
		LpfnWndProc:   syscall.NewCallback(trayWndProc),
		HInstance:     hInstance,
		LpszClassName: uintptr(unsafe.Pointer(className)),
	}
	wc.CbSize = uint32(unsafe.Sizeof(wc))

	procRegisterClassEx.Call(uintptr(unsafe.Pointer(&wc)))

	// Create a message-only window (HWND_MESSAGE = (HWND)-3)
	hwndMessage := uintptr(^uintptr(2))
	hwnd, _, _ := procCreateWindowEx.Call(
		0,
		uintptr(unsafe.Pointer(className)),
		0,
		0,
		0, 0, 0, 0,
		hwndMessage,
		0, hInstance, 0,
	)
	if hwnd == 0 {
		log.Println("[Tray] Failed to create message window")
		return
	}
	t.hwnd = hwnd

	// Try to get the exe's icon; fall back to default app icon
	var hIcon uintptr
	if exePath, err := os.Executable(); err == nil {
		exePathW, _ := syscall.UTF16PtrFromString(exePath)
		hIcon, _, _ = procExtractIcon.Call(hInstance, uintptr(unsafe.Pointer(exePathW)), 0)
	}
	if hIcon == 0 || hIcon == 1 {
		hIcon, _, _ = procLoadIcon.Call(0, uintptr(idiApplication))
	}

	// Build NOTIFYICONDATAW
	t.nid = notifyIconDataW{
		HWnd:             hwnd,
		UID:              1,
		UFlags:           NIF_MESSAGE | NIF_ICON | NIF_TIP,
		UCallbackMessage: wmTrayCallback,
		HIcon:            hIcon,
	}
	t.nid.CbSize = uint32(unsafe.Sizeof(t.nid))

	tip, _ := syscall.UTF16FromString("MenuBy Print Agent")
	copy(t.nid.SzTip[:], tip)

	ret, _, _ := procShellNotifyIcon.Call(NIM_ADD, uintptr(unsafe.Pointer(&t.nid)))
	if ret == 0 {
		log.Println("[Tray] Failed to add tray icon")
		return
	}
	log.Println("[Tray] System tray icon added")

	// Message pump
	var m trayMsg
	for {
		ret, _, _ := procGetMessage.Call(uintptr(unsafe.Pointer(&m)), 0, 0, 0)
		if ret == 0 || ret == ^uintptr(0) {
			break
		}
		procTranslateMessage.Call(uintptr(unsafe.Pointer(&m)))
		procDispatchMessage.Call(uintptr(unsafe.Pointer(&m)))
	}
}

// showContextMenu displays a right-click popup menu at the cursor
func (t *trayIcon) showContextMenu() {
	hMenu, _, _ := procCreatePopupMenu.Call()
	if hMenu == 0 {
		return
	}

	showText, _ := syscall.UTF16PtrFromString("Mostrar")
	quitText, _ := syscall.UTF16PtrFromString("Salir")

	procAppendMenu.Call(hMenu, mfString, uintptr(idmShow), uintptr(unsafe.Pointer(showText)))
	procAppendMenu.Call(hMenu, mfSeparator, 0, 0)
	procAppendMenu.Call(hMenu, mfString, uintptr(idmQuit), uintptr(unsafe.Pointer(quitText)))

	var pt trayPoint
	procGetCursorPos.Call(uintptr(unsafe.Pointer(&pt)))

	procSetForeground.Call(t.hwnd)
	procTrackPopupMenu.Call(hMenu, tpmBottomAlign|tpmLeftAlign,
		uintptr(pt.X), uintptr(pt.Y), 0, t.hwnd, 0)
	procDestroyMenu.Call(hMenu)

	// Dismiss fix: post a null message
	procPostMessage.Call(t.hwnd, 0, 0, 0)
}

// remove removes the tray icon and destroys the hidden window
func (t *trayIcon) remove() {
	procShellNotifyIcon.Call(NIM_DELETE, uintptr(unsafe.Pointer(&t.nid)))
	if t.hwnd != 0 {
		procDestroyWindow.Call(t.hwnd)
	}
	log.Println("[Tray] System tray icon removed")
}
