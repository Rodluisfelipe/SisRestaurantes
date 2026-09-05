package main

import (
	"strings"
	"testing"
)

/*
El generador de PDF es lo que ve un negocio que todavia no tiene impresora
conectada ("Archivo (prueba)"). Si el parser no entiende el comando de imagen,
los miles de bytes del QR se leen como texto y el PDF sale con basura — que es
justo el bug que se reporto. Estas pruebas fijan ese comportamiento.
*/

func ticketConQR(t *testing.T, modo string) []byte {
	t.Helper()
	buf := []byte("ANTES\n")
	buf = AppendQR(buf, "https://menuby.tech/vital-bakery", 80, modo)
	buf = append(buf, []byte("DESPUES\n")...)
	return buf
}

func TestPDFNoConvierteElRasterEnBasura(t *testing.T) {
	lines := parseESCPOS(ticketConQR(t, QRModeRaster))

	var texto strings.Builder
	imagenes := 0
	for _, l := range lines {
		if l.png != nil {
			imagenes++
			continue
		}
		texto.WriteString(l.text)
		texto.WriteString("\n")
	}

	if imagenes != 1 {
		t.Fatalf("se esperaba 1 imagen de QR en el PDF, hubo %d", imagenes)
	}

	got := texto.String()
	if !strings.Contains(got, "ANTES") {
		t.Fatalf("se perdio el texto anterior al QR:\n%s", got)
	}
	// Lo esencial: el texto que sigue al QR debe sobrevivir. Si el parser se
	// desalinea leyendo la imagen, se lo come o lo corrompe.
	if !strings.Contains(got, "DESPUES") {
		t.Fatalf("el texto posterior al QR se perdio (el parser se desalineo):\n%s", got)
	}

	// Y no debe aparecer nada mas: cualquier caracter extra es raster leido
	// como texto.
	limpio := strings.TrimSpace(strings.ReplaceAll(got, "\n", ""))
	if limpio != "ANTESDESPUES" {
		t.Fatalf("se colo basura del raster en el texto del PDF: %q", limpio)
	}
}

func TestPDFDibujaElQRNativo(t *testing.T) {
	lines := parseESCPOS(ticketConQR(t, QRModeNative))

	imagenes := 0
	var texto strings.Builder
	for _, l := range lines {
		if l.png != nil {
			imagenes++
			continue
		}
		texto.WriteString(l.text)
	}

	if imagenes != 1 {
		t.Fatalf("el QR nativo deberia regenerarse para la vista previa, hubo %d imagenes", imagenes)
	}
	// La URL viaja dentro del comando; no puede terminar impresa como texto.
	if strings.Contains(texto.String(), "menuby.tech/vital-bakery") {
		t.Fatalf("la URL del comando nativo se filtro como texto: %q", texto.String())
	}
	if !strings.Contains(texto.String(), "DESPUES") {
		t.Fatalf("el texto posterior al QR nativo se perdio: %q", texto.String())
	}
}

func TestPDFSinQRSigueIgual(t *testing.T) {
	lines := parseESCPOS([]byte("SOLO\nTEXTO\n"))
	for _, l := range lines {
		if l.png != nil {
			t.Fatal("un ticket sin QR no deberia producir imagenes")
		}
	}
	if len(lines) != 2 {
		t.Fatalf("se esperaban 2 lineas, hubo %d", len(lines))
	}
}

func TestPDFSeGeneraElArchivoConQR(t *testing.T) {
	// Prueba de extremo a extremo: que fpdf acepte la imagen y escriba el
	// archivo. Un PNG mal formado explotaria aca y no en la maquina del cliente.
	ruta, err := saveTicketPDF(ticketConQR(t, QRModeRaster), "test", 80)
	if err != nil {
		t.Fatalf("no se pudo generar el PDF: %v", err)
	}
	if ruta == "" {
		t.Fatal("no se devolvio la ruta del PDF")
	}
	t.Logf("PDF de prueba generado en %s", ruta)
}
