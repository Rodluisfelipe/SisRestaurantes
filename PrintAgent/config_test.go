package main

import (
	"encoding/json"
	"testing"
)

// Estas pruebas cubren el momento más delicado de la actualización: los agentes
// que ya están instalados y funcionando abren su config viejo por primera vez
// con la versión nueva. Si la conversión pierde la llave, el nombre de la
// impresora o el ancho de papel, ese negocio deja de imprimir sin avisar.

const configV1 = `{
  "apiUrl": "https://159-203-136-199.nip.io",
  "printKey": "a0a179659e167744f5cfcf2ad8968592119f3b7f6047a730bf129e2fb0ec2324",
  "printerName": "EPSON TM-T20III",
  "paperWidth": 58,
  "autoCut": true,
  "testMode": false
}`

func cargarDesdeJSON(t *testing.T, raw string) *Config {
	t.Helper()
	var cfg Config
	if err := json.Unmarshal([]byte(raw), &cfg); err != nil {
		t.Fatalf("no se pudo leer el config: %v", err)
	}
	cfg.migrate()
	return &cfg
}

func TestMigracionV1ConservaLaConfiguracion(t *testing.T) {
	cfg := cargarDesdeJSON(t, configV1)

	if len(cfg.Accounts) != 1 {
		t.Fatalf("se esperaba 1 cuenta tras migrar, hay %d", len(cfg.Accounts))
	}
	if len(cfg.Printers) != 1 {
		t.Fatalf("se esperaba 1 impresora tras migrar, hay %d", len(cfg.Printers))
	}

	acc := cfg.Accounts[0]
	if acc.PrintKey != "a0a179659e167744f5cfcf2ad8968592119f3b7f6047a730bf129e2fb0ec2324" {
		t.Fatalf("se perdió la llave de impresión: %q", acc.PrintKey)
	}
	if !acc.Enabled {
		t.Fatal("la cuenta migrada quedó desactivada: el negocio dejaría de imprimir")
	}

	p := cfg.Printers[0]
	if p.Name != "EPSON TM-T20III" {
		t.Fatalf("se perdió el nombre de la impresora: %q", p.Name)
	}
	if p.PaperWidth != 58 {
		t.Fatalf("se perdió el ancho de papel: %d", p.PaperWidth)
	}
	if !p.AutoCut {
		t.Fatal("se perdió el autocorte")
	}
	if p.QRMode != QRModeRaster {
		t.Fatalf("el modo de QR por defecto debería ser raster, es %q", p.QRMode)
	}

	// Ambos documentos deben resolver a la impresora migrada.
	for _, doc := range []string{"comanda", "recibo"} {
		got := cfg.PrinterForDoc(&acc, doc)
		if got == nil || got.ID != p.ID {
			t.Fatalf("%s no resuelve a la impresora migrada", doc)
		}
	}

	if !cfg.IsConfigured() {
		t.Fatal("tras migrar, el agente debería considerarse configurado")
	}
}

func TestMigracionEsIdempotente(t *testing.T) {
	cfg := cargarDesdeJSON(t, configV1)

	// Segunda pasada: no debe duplicar nada ni volver a marcar cambios.
	if cfg.migrate() {
		t.Fatal("una segunda migración no debería reportar cambios")
	}
	if len(cfg.Accounts) != 1 || len(cfg.Printers) != 1 {
		t.Fatalf("la segunda migración duplicó datos: %d cuentas, %d impresoras",
			len(cfg.Accounts), len(cfg.Printers))
	}

	// Y los campos viejos deben desaparecer del archivo guardado.
	data, err := json.Marshal(cfg)
	if err != nil {
		t.Fatalf("no se pudo serializar: %v", err)
	}
	var comoMapa map[string]interface{}
	_ = json.Unmarshal(data, &comoMapa)
	for _, viejo := range []string{"printKey", "printerName", "paperWidth"} {
		if _, existe := comoMapa[viejo]; existe {
			t.Fatalf("el campo viejo %q sigue en el archivo tras migrar", viejo)
		}
	}
}

func TestMigracionDeServidorRetirado(t *testing.T) {
	cfg := cargarDesdeJSON(t, `{
      "apiUrl": "https://157-245-125-216.nip.io",
      "printKey": "a0a179659e167744f5cfcf2ad8968592119f3b7f6047a730bf129e2fb0ec2324",
      "printerName": "POS-58",
      "paperWidth": 58,
      "autoCut": true
    }`)

	if cfg.APIUrl != CurrentAPIUrl {
		t.Fatalf("el servidor retirado no se actualizó: %q", cfg.APIUrl)
	}
	if len(cfg.Accounts) != 1 || cfg.Accounts[0].PrintKey == "" {
		t.Fatal("la migración de servidor no debe perder la cuenta")
	}
}

func TestConfigNuevoNoSeConsideraConfigurado(t *testing.T) {
	cfg := DefaultConfig()
	if cfg.IsConfigured() {
		t.Fatal("un agente recién instalado no debería considerarse configurado")
	}
	cfg.migrate()
	if len(cfg.Accounts) != 0 || len(cfg.Printers) != 0 {
		t.Fatal("un config vacío no debería inventar cuentas ni impresoras")
	}
}

func TestSoloCuentasActivasConLlaveValida(t *testing.T) {
	cfg := &Config{
		APIUrl: CurrentAPIUrl,
		Accounts: []Account{
			{Alias: "Buena", PrintKey: repetir("a", 64), Enabled: true},
			{Alias: "Apagada", PrintKey: repetir("b", 64), Enabled: false},
			{Alias: "Llave corta", PrintKey: "123", Enabled: true},
		},
	}

	activas := cfg.EnabledAccounts()
	if len(activas) != 1 {
		t.Fatalf("se esperaba 1 cuenta activa válida, hay %d", len(activas))
	}
	if activas[0].Alias != "Buena" {
		t.Fatalf("se activó la cuenta equivocada: %q", activas[0].Alias)
	}
}

func TestPrinterForDocEnrutaPorTipoDeDocumento(t *testing.T) {
	cfg := &Config{
		Printers: []Printer{
			{ID: "caja", Name: "POS-58", PaperWidth: 58},
			{ID: "cocina", Name: "TM-T20", PaperWidth: 80},
		},
	}
	acc := Account{ComandaPrinter: "cocina", ReciboPrinter: "caja"}

	if p := cfg.PrinterForDoc(&acc, "comanda"); p == nil || p.ID != "cocina" {
		t.Fatal("la comanda debería ir a la impresora de cocina")
	}
	if p := cfg.PrinterForDoc(&acc, "recibo"); p == nil || p.ID != "caja" {
		t.Fatal("el recibo debería ir a la impresora de caja")
	}

	// Si la impresora asignada ya no existe, cae a la primera: es preferible
	// imprimir en la equivocada que perder el pedido en silencio.
	huerfana := Account{ComandaPrinter: "borrada", ReciboPrinter: "borrada"}
	if p := cfg.PrinterForDoc(&huerfana, "comanda"); p == nil || p.ID != "caja" {
		t.Fatal("con impresora inexistente debería caer a la primera configurada")
	}

	sinImpresoras := &Config{}
	if p := sinImpresoras.PrinterForDoc(&acc, "recibo"); p != nil {
		t.Fatal("sin impresoras configuradas debe devolver nil")
	}
}

func TestDosMarcasCompartiendoUnaImpresora(t *testing.T) {
	// El caso real que motivó todo esto: dos marcas, un PC, una impresora.
	compartida := Printer{ID: "unica", Name: "POS-58", PaperWidth: 58, AutoCut: true, QRMode: QRModeRaster}
	cfg := &Config{
		APIUrl:   CurrentAPIUrl,
		Printers: []Printer{compartida},
		Accounts: []Account{
			{Alias: "Marca A", PrintKey: repetir("a", 64), ComandaPrinter: "unica", ReciboPrinter: "unica", Enabled: true},
			{Alias: "Marca B", PrintKey: repetir("b", 64), ComandaPrinter: "unica", ReciboPrinter: "unica", Enabled: true},
		},
	}

	if len(cfg.EnabledAccounts()) != 2 {
		t.Fatal("las dos marcas deberían quedar activas")
	}
	for _, acc := range cfg.Accounts {
		acc := acc
		for _, doc := range []string{"comanda", "recibo"} {
			p := cfg.PrinterForDoc(&acc, doc)
			if p == nil || p.ID != "unica" {
				t.Fatalf("%s de %s no resuelve a la impresora compartida", doc, acc.Alias)
			}
		}
	}
}

func repetir(s string, n int) string {
	out := make([]byte, 0, n)
	for i := 0; i < n; i++ {
		out = append(out, s[0])
	}
	return string(out)
}
