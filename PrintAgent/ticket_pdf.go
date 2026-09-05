package main

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-pdf/fpdf"
	qrcode "github.com/skip2/go-qrcode"
)

// previewQRPNG genera la imagen de un QR para la vista previa en PDF, cuando la
// impresora lo iba a dibujar por su cuenta (modo nativo) y por lo tanto no
// viaja ningun mapa de bits que podamos mostrar.
func previewQRPNG(url string) []byte {
	if url == "" {
		return nil
	}
	data, err := qrcode.Encode(url, qrcode.Medium, 200)
	if err != nil {
		log.Printf("[PDF] no se pudo generar el QR de vista previa: %v", err)
		return nil
	}
	return data
}

// ticketState tracks ESC/POS state while parsing for PDF rendering
type ticketState struct {
	bold       bool
	doubleW    bool
	doubleH    bool
	fontB      bool
	underline  bool
	align      string // "L", "C", "R"
}

// saveTicketPDF parses raw ESC/POS data and renders a PDF that mimics a thermal ticket
func saveTicketPDF(data []byte, docType string, paperWidthMM int) (string, error) {
	exe, _ := os.Executable()
	dir := filepath.Dir(exe)
	ticketsDir := filepath.Join(dir, "tickets")
	os.MkdirAll(ticketsDir, 0755)

	timestamp := time.Now().Format("2006-01-02_15-04-05")
	filename := filepath.Join(ticketsDir, fmt.Sprintf("%s_%s.pdf", docType, timestamp))

	// Paper dimensions in mm — continuous roll, we'll compute height after parsing
	pageW := float64(paperWidthMM)
	if pageW == 0 {
		pageW = 80
	}
	margin := 2.0

	// First pass: parse ESC/POS into lines with formatting
	lines := parseESCPOS(data)

	// Compute total height needed
	lineH := 3.8  // normal line height in mm
	bigH := 7.0   // double-size line height
	totalH := 6.0 // top+bottom margin
	for _, l := range lines {
		switch {
		case l.png != nil:
			// 8 puntos por mm, mas un respiro arriba y abajo.
			totalH += float64(l.imgDots)/8.0 + 3
		case l.doubleH:
			totalH += bigH
		default:
			totalH += lineH
		}
	}
	if totalH < 40 {
		totalH = 40
	}

	// Create PDF with custom ticket size
	pdf := fpdf.NewCustom(&fpdf.InitType{
		OrientationStr: "P",
		UnitStr:        "mm",
		Size:           fpdf.SizeType{Wd: pageW, Ht: totalH},
	})
	pdf.SetMargins(margin, 3, margin)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	// White background
	pdf.SetFillColor(255, 255, 255)
	pdf.Rect(0, 0, pageW, totalH, "F")

	// Use Courier (built-in monospace)
	usableW := pageW - 2*margin
	normalSize := 7.0   // pt for normal text
	smallSize := 6.0    // pt for Font B
	bigSize := 13.0     // pt for double-size text

	y := 3.0
	for idx, l := range lines {
		// Imagenes (el QR): se dibujan centradas y se sigue con la linea siguiente.
		if l.png != nil {
			ladoMM := float64(l.imgDots) / 8.0
			if ladoMM > usableW {
				ladoMM = usableW
			}
			nombre := fmt.Sprintf("qr%d", idx)
			pdf.RegisterImageOptionsReader(nombre, fpdf.ImageOptions{ImageType: "PNG"}, bytes.NewReader(l.png))
			pdf.ImageOptions(nombre, (pageW-ladoMM)/2, y+1.5, ladoMM, ladoMM, false, fpdf.ImageOptions{ImageType: "PNG"}, 0, "")
			y += ladoMM + 3
			continue
		}

		text := l.text

		// Determine font size
		fontSize := normalSize
		lh := lineH
		if l.doubleH && l.doubleW {
			fontSize = bigSize
			lh = bigH
		} else if l.doubleW {
			fontSize = 10.0
			lh = 5.0
		} else if l.fontB {
			fontSize = smallSize
		}

		style := ""
		if l.bold {
			style = "B"
		}
		if l.underline {
			style += "U"
		}

		pdf.SetFont("Courier", style, fontSize)
		pdf.SetTextColor(0, 0, 0)

		// Alignment
		alignStr := "L"
		x := margin
		if l.align == "C" {
			alignStr = "C"
		} else if l.align == "R" {
			alignStr = "R"
		}

		pdf.SetXY(x, y)
		pdf.CellFormat(usableW, lh, text, "", 0, alignStr, false, 0, "")
		y += lh
	}

	err := pdf.OutputFileAndClose(filename)
	if err != nil {
		return "", fmt.Errorf("saving PDF: %w", err)
	}
	log.Printf("[Print] Saved PDF ticket: %s", filename)
	return filename, nil
}

// pdfLine represents a single rendered line with its formatting state.
// Si `png` no es nil, la linea es una imagen (el QR) y no texto.
type pdfLine struct {
	text      string
	bold      bool
	doubleW   bool
	doubleH   bool
	fontB     bool
	underline bool
	align     string

	png     []byte // imagen ya codificada, lista para incrustar
	imgDots int    // ancho/alto en puntos de impresora (la imagen es cuadrada)
}

/*
rasterAPNG convierte un mapa de bits ESC/POS (GS v 0) en un PNG.

El formato es 1 bit por punto, empaquetado de 8 en 8 de izquierda a derecha,
y el bit en 1 significa NEGRO (tinta), al reves de lo que uno esperaria de una
imagen en escala de grises.
*/
func rasterAPNG(raster []byte, widthBytes, height int) ([]byte, int) {
	widthDots := widthBytes * 8
	if widthDots == 0 || height == 0 {
		return nil, 0
	}

	img := image.NewGray(image.Rect(0, 0, widthDots, height))
	for y := 0; y < height; y++ {
		for x := 0; x < widthDots; x++ {
			idx := y*widthBytes + x/8
			if idx >= len(raster) {
				continue
			}
			negro := raster[idx]&(0x80>>(x%8)) != 0
			v := uint8(255)
			if negro {
				v = 0
			}
			img.SetGray(x, y, color.Gray{Y: v})
		}
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		log.Printf("[PDF] no se pudo codificar el QR: %v", err)
		return nil, 0
	}
	return buf.Bytes(), widthDots
}

// parseESCPOS walks through raw ESC/POS bytes and extracts text lines with formatting
func parseESCPOS(data []byte) []pdfLine {
	var lines []pdfLine
	var currentLine strings.Builder

	st := ticketState{align: "L"}
	i := 0

	flush := func() {
		text := currentLine.String()
		lines = append(lines, pdfLine{
			text:      text,
			bold:      st.bold,
			doubleW:   st.doubleW,
			doubleH:   st.doubleH,
			fontB:     st.fontB,
			underline: st.underline,
			align:     st.align,
		})
		currentLine.Reset()
	}

	for i < len(data) {
		b := data[i]

		// Line feed — flush current line
		if b == 0x0A {
			flush()
			i++
			continue
		}

		// ESC sequences (0x1B)
		if b == 0x1B && i+1 < len(data) {
			cmd := data[i+1]
			switch cmd {
			case 0x40: // ESC @ — Initialize
				i += 2
				continue
			case 0x74: // ESC t n — code page
				i += 3
				continue
			case 0x61: // ESC a n — alignment
				if i+2 < len(data) {
					switch data[i+2] {
					case 0x00:
						st.align = "L"
					case 0x01:
						st.align = "C"
					case 0x02:
						st.align = "R"
					}
					i += 3
				} else {
					i += 2
				}
				continue
			case 0x45: // ESC E n — bold on/off
				if i+2 < len(data) {
					st.bold = data[i+2] != 0
					i += 3
				} else {
					i += 2
				}
				continue
			case 0x4D: // ESC M n — font selection
				if i+2 < len(data) {
					st.fontB = data[i+2] == 0x01
					i += 3
				} else {
					i += 2
				}
				continue
			case 0x2D: // ESC - n — underline
				if i+2 < len(data) {
					st.underline = data[i+2] != 0
					i += 3
				} else {
					i += 2
				}
				continue
			case 0x42: // ESC B n1 n2 — beep
				i += 4
				continue
			default:
				i += 2
				continue
			}
		}

		// GS sequences (0x1D)
		if b == 0x1D && i+1 < len(data) {
			cmd := data[i+1]
			switch cmd {
			case 0x21: // GS ! n — character size
				if i+2 < len(data) {
					n := data[i+2]
					st.doubleW = (n & 0x10) != 0
					st.doubleH = (n & 0x01) != 0
					i += 3
				} else {
					i += 2
				}
				continue
			case 0x56: // GS V — cut
				i += 4 // GS V m n
				continue

			case 0x76: // GS v 0 — mapa de bits raster (el QR del menu)
				/* Antes este comando caia en el `default` de abajo, que salta
				   3 bytes: los miles de bytes de la imagen se seguian leyendo
				   como si fueran texto y ensuciaban el PDF. Ahora se decodifica
				   y se dibuja, que es el punto de la vista previa. */
				if i+7 < len(data) {
					widthBytes := int(data[i+4]) | int(data[i+5])<<8
					height := int(data[i+6]) | int(data[i+7])<<8
					inicio := i + 8
					largo := widthBytes * height
					if largo > 0 && inicio+largo <= len(data) {
						flush()
						if pngData, dots := rasterAPNG(data[inicio:inicio+largo], widthBytes, height); pngData != nil {
							lines = append(lines, pdfLine{png: pngData, imgDots: dots, align: "C"})
						}
						i = inicio + largo
						continue
					}
				}
				i += 3
				continue

			case 0x28: // GS ( k — comandos de QR nativo
				/* Aca el codigo lo dibuja la impresora, no nosotros, asi que
				   para la vista previa se regenera a partir de la URL que
				   viaja en el comando de datos (fn = 0x50). */
				if i+4 < len(data) {
					pL := int(data[i+3])
					pH := int(data[i+4])
					payload := pL + pH<<8
					fin := i + 5 + payload
					if payload > 0 && fin <= len(data) {
						// fn 0x50 = almacenar datos del simbolo; la URL empieza tras 3 bytes
						if payload > 3 && data[i+6] == 0x50 {
							url := string(data[i+8 : fin])
							flush()
							if qr := previewQRPNG(url); qr != nil {
								lines = append(lines, pdfLine{png: qr, imgDots: 200, align: "C"})
							}
						}
						i = fin
						continue
					}
				}
				i += 3
				continue

			default:
				i += 3
				continue
			}
		}

		// Skip BEL, NUL
		if b == 0x07 || b == 0x00 {
			i++
			continue
		}

		// Carriage return — skip
		if b == 0x0D {
			i++
			continue
		}

		// Printable ASCII or CP850 high byte → convert to UTF-8 for PDF
		if b >= 0x20 && b <= 0x7E {
			currentLine.WriteByte(b)
		} else if b >= 0x80 {
			if r, ok := cp850ToUTF8[b]; ok {
				currentLine.WriteRune(r)
			} else {
				currentLine.WriteByte('?')
			}
		}
		i++
	}

	// Flush any remaining text
	if currentLine.Len() > 0 {
		flush()
	}

	return lines
}

// cp850ToUTF8 maps CP850 byte values back to Unicode runes for PDF text
var cp850ToUTF8 = map[byte]rune{
	0x80: 'Ç', 0x81: 'ü', 0x82: 'é', 0x83: 'â', 0x84: 'ä', 0x85: 'à',
	0x87: 'ç', 0x88: 'ê', 0x89: 'ë', 0x8A: 'è', 0x8B: 'ï', 0x8C: 'î',
	0x8D: 'ì', 0x8E: 'Ä', 0x90: 'É', 0x93: 'ô', 0x94: 'ö', 0x95: 'ò',
	0x96: 'û', 0x97: 'ù', 0x99: 'Ö', 0x9A: 'Ü', 0x9C: '£', 0x9D: '¥',
	0xA0: 'á', 0xA1: 'í', 0xA2: 'ó', 0xA3: 'ú', 0xA4: 'ñ', 0xA5: 'Ñ',
	0xA8: '¿', 0xAB: '½', 0xAC: '¼', 0xAD: '¡', 0xAE: '«', 0xAF: '»',
	0xB5: 'Á', 0xB6: 'Â', 0xB7: 'À', 0xB8: '©', 0xBD: '¢',
	0xC4: '─', 0xC6: 'ã', 0xC7: 'Ã',
	0xD2: 'Ê', 0xD3: 'Ë', 0xD4: 'È', 0xD5: '€', 0xD6: 'Í', 0xD7: 'Î',
	0xD8: 'Ï', 0xDE: 'Ì', 0xE0: 'Ó', 0xE1: 'ß', 0xE2: 'Ô', 0xE3: 'Ò',
	0xE4: 'õ', 0xE5: 'Õ', 0xE8: '×', 0xE9: 'Ú', 0xEA: 'Û', 0xEB: 'Ù',
	0xF1: '±', 0xF6: '÷', 0xF8: '°', 0xFA: '·',
}
