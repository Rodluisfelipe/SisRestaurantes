/**
 * Tokens de diseño del menú del comensal (multi-tenant).
 *
 * Cada restaurante define un color primario en su panel. Aquí lo convertimos
 * en un sistema completo: variantes claras/oscuras, color de texto con
 * contraste AA garantizado y las escalas de radio, sombra y tipografía.
 *
 * Regla de oro: el menú NUNCA usa el rojo de Menuby, siempre el color del
 * restaurante. Menuby solo aparece en el "Powered by" del footer.
 */

/* ── Color ───────────────────────────────────────────────────────── */

const FALLBACK = '#F97316';

export function hexToRgb(hex) {
  if (typeof hex !== 'string') return null;
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
export const rgbToHex = ({ r, g, b }) => `#${toHex(r)}${toHex(g)}${toHex(b)}`;

/** Normaliza cualquier entrada a un hex válido de 6 dígitos (siempre con #). */
export function safeColor(hex, fallback = FALLBACK) {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHex(rgb) : fallback;
}

/** Luminancia relativa (WCAG 2.1). */
export function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const ch = [rgb.r, rgb.g, rgb.b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** Razón de contraste entre dos colores (1 a 21). */
export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Texto legible (blanco o tinta) sobre un fondo dado. AA = 4.5 en texto normal. */
export function textOn(bg, { ink = '#17120F' } = {}) {
  return contrast(bg, '#FFFFFF') >= contrast(bg, ink) ? '#FFFFFF' : ink;
}

/** Mezcla hacia blanco (amount > 0) o hacia negro (amount < 0). */
export function shade(hex, amount) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const t = amount < 0 ? 0 : 255;
  const p = Math.abs(amount);
  return rgbToHex({
    r: rgb.r + (t - rgb.r) * p,
    g: rgb.g + (t - rgb.g) * p,
    b: rgb.b + (t - rgb.b) * p,
  });
}

/** Color con canal alfa, listo para CSS. */
export function alpha(hex, a) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

/**
 * Deriva la paleta completa del restaurante a partir de su color primario.
 * `accent` es el color seguro para CTAs: si el primario es tan claro que el
 * texto blanco encima no alcanza AA, lo oscurecemos hasta que sí cumpla.
 */
export function derivePalette(primaryRaw, { dark = false, on: onRaw } = {}) {
  const primary = safeColor(primaryRaw);

  // CTA con contraste garantizado contra su propio texto
  let accent = primary;
  let guard = 0;
  while (contrast(accent, textOn(accent)) < 4.5 && guard < 12) {
    accent = shade(accent, -0.08);
    guard += 1;
  }

  /* Si el negocio eligió su propio color de texto (buttonTextColor) y cumple
     AA sobre el acento, se respeta: es parte de su identidad (ej. negro con
     amarillo). Si no llega al contraste, gana la legibilidad. */
  const chosenOn = hexToRgb(onRaw) ? safeColor(onRaw) : null;
  const onAccent = chosenOn && contrast(accent, chosenOn) >= 4.5 ? chosenOn : textOn(accent);

  /* Compañero del anillo: con acentos muy oscuros o muy claros, un degradado
     accent→accent es invisible. Se usa el color de texto de la marca si aporta
     contraste; si no, se aclara/oscurece el acento para que el anillo se vea. */
  const lum = luminance(accent);
  const ringPartner = chosenOn && contrast(accent, chosenOn) >= 3
    ? chosenOn
    : shade(accent, lum < 0.2 ? 0.55 : -0.35);

  return {
    primary,
    accent,
    onAccent,
    ringPartner,
    soft: dark ? alpha(primary, 0.18) : shade(primary, 0.9),   // fondos suaves
    softer: dark ? alpha(primary, 0.1) : shade(primary, 0.95),
    strong: shade(primary, -0.25),                              // texto sobre claro
    ring: alpha(primary, dark ? 0.5 : 0.35),
  };
}

/* ── Superficies (claro / oscuro) ────────────────────────────────── */

export const surfaces = {
  light: {
    bg: '#F9FAFB',   // fondo real de la página del menú (bg-gray-50)
    subtle: '#F1F5F9',
    card: '#FFFFFF',
    border: '#F1F5F9',
    text: '#0F172A',
    textSoft: '#64748B',
    textFaint: '#94A3B8',
  },
  // Nunca negro puro: #0D0D10 base, superficies elevadas +6% de luminancia
  dark: {
    bg: '#0D0D10',
    subtle: '#14141A',
    card: '#17171F',
    border: 'rgba(255,255,255,0.08)',
    text: '#F5F5F7',
    textSoft: 'rgba(255,255,255,0.62)',
    textFaint: 'rgba(255,255,255,0.4)',
  },
};

/* ── Radios, sombras y tipografía ────────────────────────────────── */

export const radii = {
  card: '20px',
  button: '14px',
  pill: '999px',
  sheet: '24px',
};

export const shadows = {
  // Difusas y sutiles: y 8px, blur 24px, 8% de opacidad
  card: '0 8px 24px rgba(15, 23, 42, 0.08)',
  cardHover: '0 12px 32px rgba(15, 23, 42, 0.12)',
  float: '0 10px 30px rgba(15, 23, 42, 0.14)',
  // En tema oscuro las sombras no se ven: se sustituyen por borde
  darkBorder: '1px solid rgba(255,255,255,0.08)',
};

export const type = {
  display: { size: '30px', weight: 800, tracking: '-0.02em' }, // nombre del restaurante
  section: { size: '20px', weight: 700 },                      // títulos de sección
  product: { size: '15px', weight: 600 },                      // nombre de producto
  body: { size: '13px', weight: 400 },                         // descripciones
  price: { size: '17px', weight: 800 },                        // el precio nunca es tímido
};

/** Tamaño mínimo táctil accesible (WCAG 2.5.5). */
export const TOUCH_TARGET = 44;

/**
 * El nombre del producto no se trunca jamás: se permite hasta 2 líneas y, si
 * es muy largo, se reduce el tamaño antes que cortar con "…".
 */
export function productNameSize(name = '', { hero = false } = {}) {
  const len = String(name).length;
  if (hero) return len > 42 ? 'text-[15px]' : 'text-base';
  if (len > 46) return 'text-[12px]';
  if (len > 30) return 'text-[13px]';
  return 'text-[14px]';
}

/**
 * Emite todo el sistema como CSS variables para colgarlas UNA vez del
 * contenedor del menú. Así el color del negocio deja de vivir en styles inline
 * repetidos y el tema oscuro pasa a ser un cambio de set, no un refactor.
 *
 *   <main style={menuCssVars(businessConfig?.theme?.buttonColor)}>
 *   ...
 *   <button className="bg-[var(--mb-accent)] text-[var(--mb-on-accent)]">
 */
export function menuCssVars(primary, { dark = false, on } = {}) {
  const p = derivePalette(primary, { dark, on });
  const s = dark ? surfaces.dark : surfaces.light;
  return {
    '--mb-accent': p.accent,
    '--mb-on-accent': p.onAccent,
    '--mb-ring-partner': p.ringPartner,
    '--mb-accent-soft': p.soft,
    '--mb-accent-softer': p.softer,
    '--mb-accent-strong': p.strong,
    '--mb-ring': p.ring,
    '--mb-surface': s.bg,
    '--mb-surface-2': s.subtle,
    '--mb-card': s.card,
    '--mb-line': s.border,
    '--mb-ink': s.text,
    '--mb-ink-2': s.textSoft,
    '--mb-ink-3': s.textFaint,
    '--mb-radius-card': radii.card,
    '--mb-radius-btn': radii.button,
    '--mb-radius-sheet': radii.sheet,
    '--mb-shadow-card': dark ? 'none' : shadows.card,
  };
}

export default {
  derivePalette, surfaces, radii, shadows, type, TOUCH_TARGET,
  productNameSize, contrast, textOn, alpha, shade, safeColor, menuCssVars,
};
