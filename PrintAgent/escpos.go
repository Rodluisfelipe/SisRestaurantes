package main

import (
	"fmt"
	"math"
	"strings"
	"time"
)

// ESC/POS command bytes
var (
	cmdInit        = []byte{0x1B, 0x40}       // Initialize printer
	cmdAlignLeft   = []byte{0x1B, 0x61, 0x00} // Left align
	cmdAlignCenter = []byte{0x1B, 0x61, 0x01} // Center align
	cmdAlignRight  = []byte{0x1B, 0x61, 0x02} // Right align
	cmdBoldOn      = []byte{0x1B, 0x45, 0x01} // Bold on
	cmdBoldOff     = []byte{0x1B, 0x45, 0x00} // Bold off
	cmdDoubleSize  = []byte{0x1D, 0x21, 0x11} // Double width + height
	cmdDoubleW     = []byte{0x1D, 0x21, 0x10} // Double width only
	cmdNormalSize  = []byte{0x1D, 0x21, 0x00} // Normal size
	cmdFontA       = []byte{0x1B, 0x4D, 0x00} // Font A (12x24)
	cmdFontB       = []byte{0x1B, 0x4D, 0x01} // Font B (9x17) — more chars per line
	cmdUnderlineOn = []byte{0x1B, 0x2D, 0x01} // Underline on
	cmdUnderlineOff= []byte{0x1B, 0x2D, 0x00} // Underline off
	cmdFeed        = []byte{0x0A}             // Line feed
	cmdCut         = []byte{0x1D, 0x56, 0x41, 0x03} // Partial cut with 3 lines feed
	cmdBeep        = []byte{0x1B, 0x42, 0x03, 0x02} // Beep 3 times, 200ms each
)

// PaperProfile holds format settings for each paper width
type PaperProfile struct {
	Width       int    // Paper width in mm
	ColsNormal  int    // Characters per line with Font A (normal size)
	ColsDouble  int    // Chars per line when double-width (for total line)
	ColsSmall   int    // Chars per line with Font B (smaller font)
	UseSmallFont bool  // Use Font B for items to fit more text
	Label       string // Display name
}

// Supported paper profiles — the 4 most common thermal paper sizes
var PaperProfiles = map[int]PaperProfile{
	80: {Width: 80, ColsNormal: 48, ColsDouble: 24, ColsSmall: 64, UseSmallFont: false, Label: "80mm Estándar"},
	76: {Width: 76, ColsNormal: 42, ColsDouble: 21, ColsSmall: 56, UseSmallFont: false, Label: "76mm Cocina"},
	58: {Width: 58, ColsNormal: 32, ColsDouble: 16, ColsSmall: 42, UseSmallFont: false, Label: "58mm Compacto"},
	44: {Width: 44, ColsNormal: 22, ColsDouble: 11, ColsSmall: 29, UseSmallFont: true,  Label: "44mm Mini"},
}

// GetProfile returns the paper profile for the given width, defaulting to 80mm
func GetProfile(paperWidth int) PaperProfile {
	if p, ok := PaperProfiles[paperWidth]; ok {
		return p
	}
	return PaperProfiles[80]
}

// GenerateComanda creates an ESC/POS kitchen ticket (NO prices, preparation-focused)
func GenerateComanda(order map[string]interface{}, business *BusinessInfo, paperWidth int, autoCut bool) []byte {
	profile := GetProfile(paperWidth)
	cols := profile.ColsNormal
	colsD := profile.ColsDouble
	isCompact := paperWidth <= 44
	var buf []byte

	// Init + beep
	buf = append(buf, cmdInit...)
	buf = append(buf, cmdFontA...)
	buf = append(buf, cmdBeep...)

	// === HEADER: COMANDA ===
	buf = append(buf, cmdAlignCenter...)
	if isCompact {
		buf = append(buf, cmdBoldOn...)
		buf = appendLine(buf, "*** COMANDA ***")
		buf = append(buf, cmdBoldOff...)
	} else {
		buf = append(buf, cmdDoubleSize...)
		buf = appendLine(buf, "COMANDA")
		buf = append(buf, cmdNormalSize...)
	}

	// Order number — big and bold
	buf = append(buf, cmdBoldOn...)
	if !isCompact {
		buf = append(buf, cmdDoubleSize...)
	}
	orderNum := getString(order, "orderNumber")
	buf = appendLine(buf, fmt.Sprintf("#%s", orderNum))
	if !isCompact {
		buf = append(buf, cmdNormalSize...)
	}
	buf = append(buf, cmdBoldOff...)

	// Date/time
	createdAt := getString(order, "createdAt")
	t, err := time.Parse(time.RFC3339, createdAt)
	if err != nil {
		t = time.Now()
	}
	loc := time.FixedZone("COT", -5*3600)
	t = t.In(loc)
	buf = appendLine(buf, t.Format("15:04  02/01/2006"))

	buf = append(buf, cmdAlignLeft...)
	buf = appendLine(buf, separator(cols))

	// === ORDER TYPE + CUSTOMER (essential info for kitchen) ===
	orderType := getString(order, "orderType")
	tableNumber := getString(order, "tableNumber")
	customerName := getString(order, "customerName")

	typeLabels := map[string]string{
		"inSite":   "EN SITIO",
		"takeaway": "PARA LLEVAR",
		"delivery": "DOMICILIO",
	}
	typeLabel := typeLabels[orderType]
	if typeLabel == "" {
		typeLabel = strings.ToUpper(orderType)
	}

	// Order type in double size — critical for kitchen
	buf = append(buf, cmdAlignCenter...)
	buf = append(buf, cmdBoldOn...)
	if !isCompact {
		buf = append(buf, cmdDoubleSize...)
	}
	buf = appendLine(buf, typeLabel)
	if !isCompact {
		buf = append(buf, cmdNormalSize...)
	}
	buf = append(buf, cmdBoldOff...)

	if orderType == "inSite" && tableNumber != "" {
		buf = append(buf, cmdBoldOn...)
		if !isCompact {
			buf = append(buf, cmdDoubleSize...)
		}
		buf = appendLine(buf, fmt.Sprintf("MESA %s", tableNumber))
		if !isCompact {
			buf = append(buf, cmdNormalSize...)
		}
		buf = append(buf, cmdBoldOff...)
	}

	buf = append(buf, cmdAlignLeft...)

	// Customer name (smaller)
	if customerName != "" {
		buf = appendLine(buf, truncate(customerName, cols))
	}

	buf = appendLine(buf, separator(cols))

	// === ITEMS (NO PRICES — kitchen doesn't need them) ===
	itemCols := cols
	if profile.UseSmallFont {
		buf = append(buf, cmdFontB...)
		itemCols = profile.ColsSmall
	}

	items, _ := order["items"].([]interface{})
	for i, item := range items {
		itemMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}

		name := getString(itemMap, "name")
		qty := getFloat(itemMap, "quantity")
		if qty == 0 {
			qty = 1
		}

		// Item line — bold, quantity prominent
		buf = append(buf, cmdBoldOn...)
		itemLine := fmt.Sprintf("%.0fx  %s", qty, name)
		buf = appendLine(buf, truncate(itemLine, itemCols))
		buf = append(buf, cmdBoldOff...)

		// Toppings — essential for kitchen
		toppings, _ := itemMap["selectedToppings"].([]interface{})
		for _, topping := range toppings {
			toppingMap, ok := topping.(map[string]interface{})
			if !ok {
				continue
			}

			subGroups, hasSubGroups := toppingMap["subGroups"].([]interface{})
			if hasSubGroups && len(subGroups) > 0 {
				for _, sub := range subGroups {
					subMap, ok := sub.(map[string]interface{})
					if !ok {
						continue
					}
					subName := getString(subMap, "optionName")
					if subName != "" {
						buf = appendLine(buf, "  >> "+truncate(subName, itemCols-5))
					}
				}
			} else {
				tName := getString(toppingMap, "optionName")
				if tName != "" {
					buf = appendLine(buf, "  >> "+truncate(tName, itemCols-5))
				}
			}
		}

		// Loyalty reward tag
		if isLoyalty, _ := itemMap["isLoyaltyReward"].(bool); isLoyalty {
			buf = appendLine(buf, "  [CANJE]")
		}

		// Separator between items for readability
		if i < len(items)-1 {
			buf = appendLine(buf, "")
		}
	}

	// Switch back to Font A
	if profile.UseSmallFont {
		buf = append(buf, cmdFontA...)
	}

	buf = appendLine(buf, separator(cols))

	// === CUSTOMER NOTES — critical for kitchen ===
	customerNotes := getString(order, "customerNotes")
	if customerNotes != "" {
		buf = append(buf, cmdBoldOn...)
		buf = appendLine(buf, "NOTA:")
		buf = append(buf, cmdBoldOff...)
		buf = appendWrapped(buf, customerNotes, cols)
		buf = appendLine(buf, separator(cols))
	}

	// === FOOTER ===
	buf = append(buf, cmdAlignCenter...)
	// Delivery address on comanda (kitchen needs to know for packaging/labeling)
	if orderType == "delivery" {
		address := getString(order, "address")
		deliveryZoneName := getString(order, "deliveryZoneName")
		if address != "" {
			buf = append(buf, cmdAlignLeft...)
			buf = appendWrapped(buf, "Dir: "+address, cols)
			buf = append(buf, cmdAlignCenter...)
		}
		if deliveryZoneName != "" && !isCompact {
			buf = appendLine(buf, "Zona: "+deliveryZoneName)
		}
	}

	// Repeat order number at bottom for easy identification
	buf = append(buf, cmdBoldOn...)
	if !isCompact {
		buf = append(buf, cmdDoubleSize...)
	}
	buf = appendLine(buf, fmt.Sprintf("#%s", orderNum))
	if !isCompact {
		buf = append(buf, cmdNormalSize...)
	}
	buf = append(buf, cmdBoldOff...)
	buf = append(buf, cmdAlignLeft...)

	// Feed and cut
	buf = append(buf, cmdFeed...)
	buf = append(buf, cmdFeed...)
	buf = append(buf, cmdFeed...)
	if autoCut {
		buf = append(buf, cmdCut...)
	}

	return buf
}

// GenerateRecibo creates an ESC/POS receipt (WITH prices, for the customer)
func GenerateRecibo(order map[string]interface{}, business *BusinessInfo, paperWidth int, autoCut bool) []byte {
	profile := GetProfile(paperWidth)
	cols := profile.ColsNormal
	colsD := profile.ColsDouble
	isCompact := paperWidth <= 44 // Ultra-compact mode for tiny printers
	var buf []byte

	// Init printer + select Font A
	buf = append(buf, cmdInit...)
	buf = append(buf, cmdFontA...)
	// Beep on new order
	buf = append(buf, cmdBeep...)

	// === HEADER: Business Info ===
	buf = append(buf, cmdAlignCenter...)
	if isCompact {
		// 44mm: use bold only, no double-size (would overflow)
		buf = append(buf, cmdBoldOn...)
		buf = appendLine(buf, truncate(safeStr(business.BusinessName, "Mi Negocio"), cols))
		buf = append(buf, cmdBoldOff...)
	} else {
		buf = append(buf, cmdDoubleSize...)
		buf = appendLine(buf, truncate(safeStr(business.BusinessName, "Mi Negocio"), colsD))
		buf = append(buf, cmdNormalSize...)
	}

	if business.Address != "" {
		buf = appendLine(buf, wrapText(business.Address, cols))
	}
	if business.Phone != "" {
		buf = appendLine(buf, "Tel: "+business.Phone)
	}
	if business.NIT != "" && !isCompact {
		buf = appendLine(buf, "NIT: "+business.NIT)
	}

	buf = append(buf, cmdAlignLeft...)
	buf = appendLine(buf, separator(cols))

	// === ORDER INFO ===
	orderNum := getString(order, "orderNumber")
	buf = append(buf, cmdAlignCenter...)
	buf = append(buf, cmdBoldOn...)
	if isCompact {
		buf = appendLine(buf, fmt.Sprintf("# %s", orderNum))
	} else {
		buf = append(buf, cmdDoubleSize...)
		buf = appendLine(buf, fmt.Sprintf("Pedido #%s", orderNum))
		buf = append(buf, cmdNormalSize...)
	}
	buf = append(buf, cmdBoldOff...)

	// Date/time
	createdAt := getString(order, "createdAt")
	t, err := time.Parse(time.RFC3339, createdAt)
	if err != nil {
		t = time.Now()
	}
	// Colombia timezone (UTC-5)
	loc := time.FixedZone("COT", -5*3600)
	t = t.In(loc)
	buf = appendLine(buf, t.Format("02/01/2006  15:04"))

	buf = append(buf, cmdAlignLeft...)
	buf = appendLine(buf, separator(cols))

	// === CUSTOMER INFO ===
	customerName := getString(order, "customerName")
	phone := getString(order, "phone")
	orderType := getString(order, "orderType")
	tableNumber := getString(order, "tableNumber")
	address := getString(order, "address")
	deliveryZoneName := getString(order, "deliveryZoneName")
	paymentMethod := getString(order, "paymentMethod")
	customerNotes := getString(order, "customerNotes")

	buf = append(buf, cmdBoldOn...)
	if isCompact {
		buf = appendLine(buf, truncate(customerName, cols))
	} else {
		buf = appendLine(buf, "Cliente: "+truncate(customerName, cols-9))
	}
	buf = append(buf, cmdBoldOff...)

	if phone != "" {
		if isCompact {
			buf = appendLine(buf, phone)
		} else {
			buf = appendLine(buf, "Tel: "+phone)
		}
	}

	typeLabels := map[string]string{
		"inSite":   "En Sitio",
		"takeaway": "Para Llevar",
		"delivery": "Domicilio",
	}
	typeLabel := typeLabels[orderType]
	if typeLabel == "" {
		typeLabel = orderType
	}
	if isCompact {
		buf = appendLine(buf, typeLabel)
	} else {
		buf = appendLine(buf, "Tipo: "+typeLabel)
	}

	if orderType == "inSite" && tableNumber != "" {
		buf = appendLine(buf, "Mesa: "+tableNumber)
	}
	if orderType == "delivery" && address != "" {
		if isCompact {
			buf = appendLine(buf, truncate(address, cols))
		} else {
			// Wrap long addresses for wider papers
			buf = appendWrapped(buf, "Dir: "+address, cols)
		}
	}
	if deliveryZoneName != "" && !isCompact {
		buf = appendLine(buf, "Zona: "+deliveryZoneName)
	}

	pmLabels := map[string]string{
		"cash":           "Efectivo",
		"efectivo":       "Efectivo",
		"nequi":          "Nequi",
		"daviplata":      "Daviplata",
		"transfer":       "Transferencia",
		"transferencia":  "Transferencia",
		"other":          "Otro",
	}
	if paymentMethod != "" {
		pmLabel := pmLabels[paymentMethod]
		if pmLabel == "" {
			pmLabel = paymentMethod
		}
		if isCompact {
			buf = appendLine(buf, pmLabel)
		} else {
			buf = appendLine(buf, "Pago: "+pmLabel)
		}
	}

	if customerNotes != "" {
		if isCompact {
			buf = appendLine(buf, truncate(customerNotes, cols))
		} else {
			buf = appendWrapped(buf, "Nota: "+customerNotes, cols)
		}
	}

	buf = appendLine(buf, separator(cols))

	// === ITEMS ===
	// For 44mm paper, use Font B for items to fit more text
	itemCols := cols
	if profile.UseSmallFont {
		buf = append(buf, cmdFontB...)
		itemCols = profile.ColsSmall
	}

	items, _ := order["items"].([]interface{})
	for _, item := range items {
		itemMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}

		name := getString(itemMap, "name")
		price := getFloat(itemMap, "price")
		qty := getFloat(itemMap, "quantity")
		if qty == 0 {
			qty = 1
		}

		lineTotal := price * qty
		priceStr := formatCOP(lineTotal)

		if isCompact {
			// 44mm: name on one line, price on next (not enough space for both)
			buf = append(buf, cmdBoldOn...)
			buf = appendLine(buf, fmt.Sprintf("%.0fx %s", qty, truncate(name, itemCols-3)))
			buf = append(buf, cmdBoldOff...)
			buf = append(buf, cmdAlignRight...)
			buf = appendLine(buf, priceStr)
			buf = append(buf, cmdAlignLeft...)
		} else {
			// 58mm+: item and price on same line, justified
			prefix := fmt.Sprintf("%.0fx %s", qty, name)
			if len(prefix)+len(priceStr)+1 > itemCols {
				prefix = fmt.Sprintf("%.0fx %s", qty, truncate(name, itemCols-len(priceStr)-5))
			}
			buf = appendLineJustified(buf, prefix, priceStr, itemCols)
		}

		// Toppings
		toppings, _ := itemMap["selectedToppings"].([]interface{})
		for _, topping := range toppings {
			toppingMap, ok := topping.(map[string]interface{})
			if !ok {
				continue
			}

			// Handle subGroups (nested toppings)
			subGroups, hasSubGroups := toppingMap["subGroups"].([]interface{})
			if hasSubGroups && len(subGroups) > 0 {
				for _, sub := range subGroups {
					subMap, ok := sub.(map[string]interface{})
					if !ok {
						continue
					}
					subName := getString(subMap, "optionName")
					subPrice := getFloat(subMap, "price")
					if subName != "" {
						if isCompact {
							buf = appendLine(buf, " +"+truncate(subName, itemCols-2))
						} else {
							tLine := "  + " + subName
							if subPrice > 0 {
								buf = appendLineJustified(buf, tLine, formatCOP(subPrice), itemCols)
							} else {
								buf = appendLine(buf, tLine)
							}
						}
					}
				}
			} else {
				tName := getString(toppingMap, "optionName")
				tPrice := getFloat(toppingMap, "price")
				if tName != "" {
					if isCompact {
						buf = appendLine(buf, " +"+truncate(tName, itemCols-2))
					} else {
						tLine := "  + " + tName
						if tPrice > 0 {
							buf = appendLineJustified(buf, tLine, formatCOP(tPrice), itemCols)
						} else {
							buf = appendLine(buf, tLine)
						}
					}
				}
			}
		}

		// Loyalty reward tag
		if isLoyalty, _ := itemMap["isLoyaltyReward"].(bool); isLoyalty {
			buf = appendLine(buf, "  [CANJE]")
		}
	}

	// Switch back to Font A for totals
	if profile.UseSmallFont {
		buf = append(buf, cmdFontA...)
	}

	buf = appendLine(buf, separator(cols))

	// === TOTALS ===
	totalAmount := getFloat(order, "totalAmount")
	deliveryFee := getFloat(order, "deliveryFee")
	discountAmount := getFloat(order, "discountAmount")
	finalAmount := getFloat(order, "finalAmount")

	if finalAmount == 0 {
		finalAmount = totalAmount + deliveryFee - discountAmount
	}

	if deliveryFee > 0 || discountAmount > 0 {
		if isCompact {
			buf = appendLineJustified(buf, "Subt:", formatCOP(totalAmount), cols)
		} else {
			buf = appendLineJustified(buf, "Subtotal:", formatCOP(totalAmount), cols)
		}
	}
	if deliveryFee > 0 {
		if isCompact {
			buf = appendLineJustified(buf, "Envio:", formatCOP(deliveryFee), cols)
		} else {
			buf = appendLineJustified(buf, "Domicilio:", formatCOP(deliveryFee), cols)
		}
	}
	if discountAmount > 0 {
		couponCode := getString(order, "couponCode")
		discLabel := "Desc:"
		if !isCompact {
			discLabel = "Descuento:"
			if couponCode != "" {
				discLabel = fmt.Sprintf("Desc (%s):", couponCode)
			}
		}
		buf = appendLineJustified(buf, discLabel, "-"+formatCOP(discountAmount), cols)
	}

	// TOTAL in bold + double size (or just bold for compact)
	buf = append(buf, cmdBoldOn...)
	if isCompact {
		buf = appendLineJustified(buf, "TOTAL", formatCOP(finalAmount), cols)
	} else {
		buf = append(buf, cmdDoubleSize...)
		buf = appendLineJustified(buf, "TOTAL:", formatCOP(finalAmount), colsD)
		buf = append(buf, cmdNormalSize...)
	}
	buf = append(buf, cmdBoldOff...)

	buf = appendLine(buf, separator(cols))

	// === FOOTER ===
	buf = append(buf, cmdAlignCenter...)
	if isCompact {
		buf = appendLine(buf, "Gracias!")
	} else {
		buf = appendLine(buf, "Gracias por tu compra!")
		buf = appendLine(buf, "Powered by MenuBy")
	}
	buf = append(buf, cmdAlignLeft...)

	// Feed lines and cut
	buf = append(buf, cmdFeed...)
	buf = append(buf, cmdFeed...)
	buf = append(buf, cmdFeed...)

	if autoCut {
		buf = append(buf, cmdCut...)
	}

	return buf
}

// === Helper Functions ===

func appendLine(buf []byte, text string) []byte {
	buf = append(buf, []byte(text)...)
	buf = append(buf, cmdFeed...)
	return buf
}

func appendLineJustified(buf []byte, left, right string, cols int) []byte {
	spaces := cols - len(left) - len(right)
	if spaces < 1 {
		spaces = 1
	}
	line := left + strings.Repeat(" ", spaces) + right
	return appendLine(buf, line)
}

func separator(cols int) string {
	return strings.Repeat("-", cols)
}

// wrapText returns the first line that fits, truncated if needed
func wrapText(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return truncate(s, maxLen)
}

// appendWrapped writes text that may span multiple lines
func appendWrapped(buf []byte, text string, cols int) []byte {
	if len(text) <= cols {
		return appendLine(buf, text)
	}
	// Split into lines that fit
	for len(text) > 0 {
		lineLen := cols
		if lineLen > len(text) {
			lineLen = len(text)
		}
		// Try to break at a space
		if lineLen < len(text) {
			lastSpace := strings.LastIndex(text[:lineLen], " ")
			if lastSpace > cols/3 {
				lineLen = lastSpace + 1
			}
		}
		buf = appendLine(buf, strings.TrimRight(text[:lineLen], " "))
		text = text[lineLen:]
	}
	return buf
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	if maxLen < 4 {
		return s[:maxLen]
	}
	return s[:maxLen-3] + "..."
}

func safeStr(s, fallback string) string {
	if s == "" {
		return fallback
	}
	return s
}

func getString(m map[string]interface{}, key string) string {
	v, ok := m[key]
	if !ok || v == nil {
		return ""
	}
	s, ok := v.(string)
	if ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}

func getFloat(m map[string]interface{}, key string) float64 {
	v, ok := m[key]
	if !ok || v == nil {
		return 0
	}
	switch n := v.(type) {
	case float64:
		return n
	case int:
		return float64(n)
	case int64:
		return float64(n)
	default:
		return 0
	}
}

func formatCOP(amount float64) string {
	rounded := math.Round(amount)
	if rounded == 0 {
		return "$0"
	}
	// Format with thousands separator (dots for Colombian format)
	negative := rounded < 0
	if negative {
		rounded = -rounded
	}
	intPart := int64(rounded)
	str := fmt.Sprintf("%d", intPart)

	// Add dots for thousands
	n := len(str)
	if n > 3 {
		var parts []string
		for n > 3 {
			parts = append([]string{str[n-3:]}, parts...)
			str = str[:n-3]
			n = len(str)
		}
		parts = append([]string{str}, parts...)
		str = strings.Join(parts, ".")
	}

	if negative {
		return "-$" + str
	}
	return "$" + str
}
