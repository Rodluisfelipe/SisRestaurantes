package main

import (
	"testing"

	qrcode "github.com/skip2/go-qrcode"
)

// El empaquetado de bits de un raster ESC/POS no se puede revisar a ojo y no
// tengo una impresora térmica para probar. Estas pruebas reconstruyen la matriz
// del QR a partir de los bytes generados y la comparan contra el original: si
// el desplazamiento, la escala o el orden de bits estuvieran mal, el QR saldría
// impreso pero ilegible, y eso no se descubriría hasta que un cliente lo intente.

// parseRaster interpreta la salida de AppendQR en modo raster y devuelve la
// cabecera GS v 0 más una función para consultar si un punto está en negro.
func parseRaster(t *testing.T, buf []byte) (widthBytes, height int, pixel func(x, y int) bool) {
	t.Helper()

	if len(buf) < 8 {
		t.Fatalf("buffer demasiado corto: %d bytes", len(buf))
	}
	if buf[0] != 0x1D || buf[1] != 0x76 || buf[2] != 0x30 || buf[3] != 0x00 {
		t.Fatalf("cabecera GS v 0 inválida: % X", buf[:4])
	}

	widthBytes = int(buf[4]) | int(buf[5])<<8
	height = int(buf[6]) | int(buf[7])<<8
	raster := buf[8:]

	expected := widthBytes * height
	if len(raster) != expected {
		t.Fatalf("tamaño del raster incorrecto: %d bytes, se esperaban %d (%d x %d)",
			len(raster), expected, widthBytes, height)
	}

	pixel = func(x, y int) bool {
		if x < 0 || y < 0 || y >= height || x >= widthBytes*8 {
			return false
		}
		return raster[y*widthBytes+x/8]&(0x80>>(x%8)) != 0
	}
	return widthBytes, height, pixel
}

func TestQRRasterReconstruyeLaMatriz(t *testing.T) {
	const url = "https://menuby.tech/vital-bakery"

	for _, paper := range []int{80, 58, 44} {
		buf := AppendQR(nil, url, paper, QRModeRaster)
		widthBytes, height, pixel := parseRaster(t, buf)

		if widthBytes*8 > printableDots(paper) {
			t.Fatalf("papel %dmm: el QR ocupa %d puntos, más que el ancho imprimible (%d)",
				paper, widthBytes*8, printableDots(paper))
		}

		// La referencia: la misma matriz que debería haberse dibujado.
		qr, err := qrcode.New(url, qrcode.Medium)
		if err != nil {
			t.Fatalf("papel %dmm: no se pudo generar el QR de referencia: %v", paper, err)
		}
		qr.DisableBorder = true
		matrix := qr.Bitmap()
		size := len(matrix)

		// Deducir escala y desplazamiento a partir del primer punto negro:
		// el módulo (0,0) de un QR siempre es negro (esquina del patrón de
		// búsqueda), así que ahí empieza el dibujo.
		firstX, firstY := -1, -1
		for y := 0; y < height && firstY < 0; y++ {
			for x := 0; x < widthBytes*8; x++ {
				if pixel(x, y) {
					firstX, firstY = x, y
					break
				}
			}
		}
		if firstX < 0 {
			t.Fatalf("papel %dmm: el raster salió completamente en blanco", paper)
		}

		scale := (height - 2*2*0) // placeholder, se calcula abajo
		// El alto total son (size + 2*quiet) módulos escalados; de ahí sale la escala.
		const quiet = 2
		scale = height / (size + quiet*2)
		if scale < 1 {
			t.Fatalf("papel %dmm: escala calculada inválida (%d)", paper, scale)
		}

		offsetX := firstX - quiet*scale
		offsetY := firstY - quiet*scale
		if offsetY != 0 {
			t.Fatalf("papel %dmm: el QR no arranca en la fila esperada (offsetY=%d)", paper, offsetY)
		}

		// Comparar cada módulo contra el centro de su bloque escalado.
		for my := 0; my < size; my++ {
			for mx := 0; mx < size; mx++ {
				px := offsetX + (quiet+mx)*scale + scale/2
				py := offsetY + (quiet+my)*scale + scale/2
				if got := pixel(px, py); got != matrix[my][mx] {
					t.Fatalf("papel %dmm: módulo (%d,%d) salió %v y debía ser %v",
						paper, mx, my, got, matrix[my][mx])
				}
			}
		}

		// La zona de silencio debe estar limpia: sin ella muchos lectores no
		// encuentran el código contra el texto de alrededor.
		for y := 0; y < quiet*scale; y++ {
			for x := offsetX; x < offsetX+(size+quiet*2)*scale; x++ {
				if pixel(x, y) {
					t.Fatalf("papel %dmm: hay tinta en la zona de silencio superior (%d,%d)", paper, x, y)
				}
			}
		}
	}
}

func TestQRRasterVaCentradoEnElPapel(t *testing.T) {
	// El raster NO abarca todo el ancho del papel: empieza en el margen
	// izquierdo y termina donde acaba el QR. Por eso el centrado se mide
	// contra el ancho imprimible del papel, no contra el propio raster.
	for _, paper := range []int{80, 58, 44} {
		buf := AppendQR(nil, "https://menuby.tech/go-burger", paper, QRModeRaster)
		widthBytes, height, pixel := parseRaster(t, buf)

		minX, maxX := widthBytes*8, -1
		for y := 0; y < height; y++ {
			for x := 0; x < widthBytes*8; x++ {
				if pixel(x, y) {
					if x < minX {
						minX = x
					}
					if x > maxX {
						maxX = x
					}
				}
			}
		}
		if maxX < 0 {
			t.Fatalf("papel %dmm: raster vacío", paper)
		}

		ancho := printableDots(paper)
		izquierda := minX
		derecha := ancho - 1 - maxX
		if derecha < 0 {
			t.Fatalf("papel %dmm: el QR se sale del área imprimible (termina en %d de %d)", paper, maxX, ancho)
		}

		// Tolerancia de un byte a cada lado: el desplazamiento se redondea a
		// múltiplos de 8 puntos, así que el centrado exacto no siempre existe.
		if diff := izquierda - derecha; diff > 16 || diff < -16 {
			t.Fatalf("papel %dmm: el QR no quedó centrado (%d puntos a la izquierda, %d a la derecha)",
				paper, izquierda, derecha)
		}
	}
}

func TestQRNoImprimeNadaSinURLoApagado(t *testing.T) {
	if got := AppendQR(nil, "", 80, QRModeRaster); len(got) != 0 {
		t.Fatalf("sin URL no debería generar bytes, generó %d", len(got))
	}
	if got := AppendQR(nil, "https://menuby.tech/x", 80, QRModeOff); len(got) != 0 {
		t.Fatalf("con el QR apagado no debería generar bytes, generó %d", len(got))
	}
}

func TestQRNativoLlevaLosComandosYLaURL(t *testing.T) {
	const url = "https://menuby.tech/fraise"
	buf := AppendQR(nil, url, 80, QRModeNative)

	if len(buf) == 0 {
		t.Fatal("el modo nativo no generó bytes")
	}
	// La URL debe viajar tal cual dentro del comando de datos.
	if !contieneSub(buf, []byte(url)) {
		t.Fatal("la URL no aparece en los bytes del comando nativo")
	}
	// Debe terminar con el comando de impresión del símbolo (fn 81 / 0x51).
	fin := []byte{0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30}
	if !contieneSub(buf, fin) {
		t.Fatal("falta el comando de imprimir el símbolo QR")
	}
}

func contieneSub(haystack, needle []byte) bool {
	if len(needle) > len(haystack) {
		return false
	}
	for i := 0; i <= len(haystack)-len(needle); i++ {
		ok := true
		for j := range needle {
			if haystack[i+j] != needle[j] {
				ok = false
				break
			}
		}
		if ok {
			return true
		}
	}
	return false
}
