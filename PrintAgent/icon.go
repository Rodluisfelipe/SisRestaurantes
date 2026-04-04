package main

// PrinterIcon is a 16x16 ICO-format icon (printer shape) in bytes.
// This is a minimal monochrome icon for the system tray.
var PrinterIcon = []byte{
	// ICO header
	0x00, 0x00, // Reserved
	0x01, 0x00, // Type: ICO
	0x01, 0x00, // Count: 1 image

	// Directory entry for 16x16
	0x10,       // Width: 16
	0x10,       // Height: 16
	0x00,       // Colors: 0 (true color)
	0x00,       // Reserved
	0x01, 0x00, // Color planes
	0x20, 0x00, // Bits per pixel: 32
	0x68, 0x04, 0x00, 0x00, // Size of image data: 1128
	0x16, 0x00, 0x00, 0x00, // Offset to image data: 22

	// BMP Info Header (40 bytes)
	0x28, 0x00, 0x00, 0x00, // Header size: 40
	0x10, 0x00, 0x00, 0x00, // Width: 16
	0x20, 0x00, 0x00, 0x00, // Height: 32 (icon = 2x for AND mask)
	0x01, 0x00, // Planes: 1
	0x20, 0x00, // Bits: 32
	0x00, 0x00, 0x00, 0x00, // Compression: none
	0x00, 0x04, 0x00, 0x00, // Image size: 1024
	0x00, 0x00, 0x00, 0x00, // X ppm
	0x00, 0x00, 0x00, 0x00, // Y ppm
	0x00, 0x00, 0x00, 0x00, // Colors used
	0x00, 0x00, 0x00, 0x00, // Important colors
}

func init() {
	// Generate 16x16 BGRA pixel data (printer silhouette)
	// Colors: dark gray printer on transparent background
	// The image is stored bottom-up in BMP format
	pixels := make([]byte, 16*16*4) // 16x16 pixels, 4 bytes each (BGRA)

	// Simple printer icon pattern (16x16)
	// 0 = transparent, 1 = dark gray (#404040), 2 = light gray (#A0A0A0), 3 = white (#FFFFFF)
	pattern := [16][16]byte{
		//                             top row (row 0)
		{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0},
		{0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0},
		{0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0},
		{0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 0, 0, 0},
		{0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0},
		{0, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 0},
		{0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 0},
		{0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 0},
		{0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 0},
		{0, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 0},
		{0, 1, 2, 1, 3, 3, 3, 3, 3, 3, 3, 3, 1, 2, 1, 0},
		{0, 1, 1, 1, 3, 2, 2, 2, 2, 2, 2, 3, 1, 1, 1, 0},
		{0, 0, 0, 1, 3, 2, 2, 2, 2, 2, 2, 3, 1, 0, 0, 0},
		{0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0},
		{0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0},
		{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0},
	}

	colors := map[byte][4]byte{
		0: {0x00, 0x00, 0x00, 0x00}, // Transparent
		1: {0x40, 0x40, 0x40, 0xFF}, // Dark gray (BGRA)
		2: {0xA0, 0xA0, 0xA0, 0xFF}, // Light gray
		3: {0xFF, 0xFF, 0xFF, 0xFF}, // White
	}

	// BMP stores rows bottom-up
	for y := 15; y >= 0; y-- {
		for x := 0; x < 16; x++ {
			offset := ((15 - y) * 16 + x) * 4
			c := colors[pattern[y][x]]
			pixels[offset] = c[0]   // B
			pixels[offset+1] = c[1] // G
			pixels[offset+2] = c[2] // R
			pixels[offset+3] = c[3] // A
		}
	}

	// AND mask (16x16, 1 bit per pixel, 4 bytes per row with padding)
	andMask := make([]byte, 16*4)
	for y := 15; y >= 0; y-- {
		row := (15 - y) * 4
		for x := 0; x < 16; x++ {
			if pattern[y][x] == 0 {
				andMask[row+x/8] |= 0x80 >> (uint(x) % 8)
			}
		}
	}

	PrinterIcon = append(PrinterIcon, pixels...)
	PrinterIcon = append(PrinterIcon, andMask...)
}
