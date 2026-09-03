package main

import (
	"log"

	qrcode "github.com/skip2/go-qrcode"
)

/*
Impresión de códigos QR en impresoras térmicas ESC/POS.

Hay dos formas de lograrlo y ninguna sirve para todas las impresoras:

  - "raster" (por defecto): se genera la imagen del QR acá y se manda como
    mapa de bits con GS v 0. Es el camino más compatible —prácticamente toda
    impresora ESC/POS, incluidas las clones baratas, entiende GS v 0— a costa
    de mandar más bytes.

  - "native": se delega el dibujo a la impresora con GS ( k. Sale más nítido y
    más rápido, pero el soporte varía bastante entre modelos; en una impresora
    que no lo entienda salen caracteres basura en vez del código.

Por eso el modo es configurable por impresora: si a alguien le sale basura,
cambia el modo en el agente sin necesidad de recompilar ni de que le mandemos
una versión nueva.
*/

// dotsPerMM es la densidad estándar de las térmicas ESC/POS: 8 puntos por mm.
const dotsPerMM = 8

// printableDots devuelve el ancho imprimible en puntos para un ancho de papel.
// No es el ancho del papel completo: siempre hay margen físico a los lados.
func printableDots(paperWidthMM int) int {
	switch paperWidthMM {
	case 80:
		return 576
	case 76:
		return 512
	case 58:
		return 384
	case 44:
		return 288
	default:
		return 576
	}
}

// AppendQR agrega un código QR centrado al buffer.
// Si algo falla (URL vacía, error generando la imagen), no agrega nada y deja
// el ticket intacto: un recibo sin QR es mucho mejor que un recibo corrupto.
func AppendQR(buf []byte, url string, paperWidthMM int, mode string) []byte {
	if url == "" || mode == QRModeOff {
		return buf
	}

	if mode == QRModeNative {
		return appendQRNative(buf, url)
	}
	return appendQRRaster(buf, url, paperWidthMM)
}

// appendQRRaster genera la imagen del QR y la manda como mapa de bits (GS v 0).
func appendQRRaster(buf []byte, url string, paperWidthMM int) []byte {
	// Nivel de corrección medio: un ticket térmico se arruga y se destiñe, y M
	// tolera daño en ~15% del código sin dejar de leerse.
	qr, err := qrcode.New(url, qrcode.Medium)
	if err != nil {
		log.Printf("[QR] no se pudo generar el código: %v", err)
		return buf
	}
	qr.DisableBorder = true
	matrix := qr.Bitmap() // [fila][columna], true = módulo negro

	size := len(matrix)
	if size == 0 {
		return buf
	}

	maxDots := printableDots(paperWidthMM)

	// Se escala el QR a un múltiplo entero del módulo. Escalar a un número
	// fraccionario deforma los módulos y hace que algunos lectores fallen.
	// Se apunta a ocupar cerca de la mitad del ancho del papel, con un mínimo
	// legible: por debajo de ~2 puntos por módulo, un celular sufre para leerlo.
	scale := (maxDots / 2) / size
	if scale < 3 {
		scale = 3
	}
	if scale > 8 {
		scale = 8
	}
	// Un borde blanco (quiet zone) de 2 módulos: sin él muchos lectores no
	// encuentran el código contra el texto de alrededor.
	const quiet = 2
	totalModules := size + quiet*2
	for totalModules*scale > maxDots && scale > 1 {
		scale--
	}

	widthDots := totalModules * scale
	if widthDots > maxDots {
		widthDots = maxDots
	}
	// GS v 0 recibe el ancho en bytes: cada byte son 8 puntos horizontales.
	widthBytes := (widthDots + 7) / 8
	heightDots := widthDots

	// Centrado horizontal: se calcula el desplazamiento en puntos y se rellena
	// con blanco a la izquierda, porque el alineado ESC/POS no aplica a raster.
	offsetDots := (printableDots(paperWidthMM) - widthDots) / 2
	if offsetDots < 0 {
		offsetDots = 0
	}
	offsetBytes := offsetDots / 8
	totalWidthBytes := widthBytes + offsetBytes

	raster := make([]byte, 0, totalWidthBytes*heightDots)
	for y := 0; y < heightDots; y++ {
		row := make([]byte, totalWidthBytes)
		moduleY := y/scale - quiet
		for x := 0; x < widthDots; x++ {
			moduleX := x/scale - quiet
			black := moduleY >= 0 && moduleY < size && moduleX >= 0 && moduleX < size && matrix[moduleY][moduleX]
			if black {
				bitIndex := offsetDots + x
				row[bitIndex/8] |= 0x80 >> (bitIndex % 8)
			}
		}
		raster = append(raster, row...)
	}

	// GS v 0: m=0 (normal), xL/xH = ancho en bytes, yL/yH = alto en puntos.
	buf = append(buf, 0x1D, 0x76, 0x30, 0x00)
	buf = append(buf, byte(totalWidthBytes&0xFF), byte((totalWidthBytes>>8)&0xFF))
	buf = append(buf, byte(heightDots&0xFF), byte((heightDots>>8)&0xFF))
	buf = append(buf, raster...)

	return buf
}

// appendQRNative usa los comandos GS ( k que dibuja la propia impresora.
func appendQRNative(buf []byte, url string) []byte {
	data := []byte(url)
	// El largo incluye los 3 bytes de cabecera del comando de datos.
	length := len(data) + 3
	pL := byte(length & 0xFF)
	pH := byte((length >> 8) & 0xFF)

	// Modelo 2 (el estándar actual)
	buf = append(buf, 0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00)
	// Tamaño del módulo: 6 puntos. Más pequeño se vuelve difícil de leer en papel térmico.
	buf = append(buf, 0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06)
	// Corrección de errores nivel M (49='L', 50='M', 51='Q', 52='H')
	buf = append(buf, 0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31)
	// Cargar los datos en el buffer del símbolo
	buf = append(buf, 0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30)
	buf = append(buf, data...)
	// Imprimir el símbolo
	buf = append(buf, 0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30)

	return buf
}
