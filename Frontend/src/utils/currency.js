/**
 * Currency & country utilities for multi-region support.
 * Existing Colombian users keep COP / +57 by default — no migration needed.
 */

export const CURRENCIES = {
  COP: { label: 'Peso colombiano',  symbol: '$',  locale: 'es-CO', decimals: 0, flag: '🇨🇴' },
  MXN: { label: 'Peso mexicano',    symbol: '$',  locale: 'es-MX', decimals: 0, flag: '🇲🇽' },
  USD: { label: 'Dólar americano',  symbol: '$',  locale: 'en-US', decimals: 2, flag: '🇺🇸' },
  ARS: { label: 'Peso argentino',   symbol: '$',  locale: 'es-AR', decimals: 0, flag: '🇦🇷' },
  BRL: { label: 'Real brasileño',   symbol: 'R$', locale: 'pt-BR', decimals: 2, flag: '🇧🇷' },
  CLP: { label: 'Peso chileno',     symbol: '$',  locale: 'es-CL', decimals: 0, flag: '🇨🇱' },
  PEN: { label: 'Sol peruano',      symbol: 'S/', locale: 'es-PE', decimals: 2, flag: '🇵🇪' },
  UYU: { label: 'Peso uruguayo',    symbol: '$',  locale: 'es-UY', decimals: 0, flag: '🇺🇾' },
  PYG: { label: 'Guaraní paraguayo',symbol: '₲',  locale: 'es-PY', decimals: 0, flag: '🇵🇾' },
  BOB: { label: 'Boliviano',        symbol: 'Bs', locale: 'es-BO', decimals: 2, flag: '🇧🇴' },
  GTQ: { label: 'Quetzal guatemalteco', symbol: 'Q', locale: 'es-GT', decimals: 2, flag: '🇬🇹' },
  CRC: { label: 'Colón costarricense', symbol: '₡', locale: 'es-CR', decimals: 0, flag: '🇨🇷' },
  DOP: { label: 'Peso dominicano',  symbol: 'RD$', locale: 'es-DO', decimals: 2, flag: '🇩🇴' },
  EUR: { label: 'Euro',             symbol: '€',   locale: 'es-ES', decimals: 2, flag: '🇪🇺' },
};

export const COUNTRY_CODES = [
  { code: '+57',  country: 'Colombia',            flag: '🇨🇴', currency: 'COP' },
  { code: '+52',  country: 'México',              flag: '🇲🇽', currency: 'MXN' },
  { code: '+1',   country: 'Estados Unidos',      flag: '🇺🇸', currency: 'USD' },
  { code: '+54',  country: 'Argentina',           flag: '🇦🇷', currency: 'ARS' },
  { code: '+55',  country: 'Brasil',              flag: '🇧🇷', currency: 'BRL' },
  { code: '+56',  country: 'Chile',               flag: '🇨🇱', currency: 'CLP' },
  { code: '+51',  country: 'Perú',                flag: '🇵🇪', currency: 'PEN' },
  { code: '+593', country: 'Ecuador',             flag: '🇪🇨', currency: 'USD' },
  { code: '+58',  country: 'Venezuela',           flag: '🇻🇪', currency: 'USD' },
  { code: '+507', country: 'Panamá',              flag: '🇵🇦', currency: 'USD' },
  { code: '+506', country: 'Costa Rica',          flag: '🇨🇷', currency: 'CRC' },
  { code: '+502', country: 'Guatemala',           flag: '🇬🇹', currency: 'GTQ' },
  { code: '+503', country: 'El Salvador',         flag: '🇸🇻', currency: 'USD' },
  { code: '+504', country: 'Honduras',            flag: '🇭🇳', currency: 'USD' },
  { code: '+505', country: 'Nicaragua',           flag: '🇳🇮', currency: 'USD' },
  { code: '+1-809', country: 'República Dominicana',flag: '🇩🇴', currency: 'DOP' },
  { code: '+598', country: 'Uruguay',             flag: '🇺🇾', currency: 'UYU' },
  { code: '+595', country: 'Paraguay',            flag: '🇵🇾', currency: 'PYG' },
  { code: '+591', country: 'Bolivia',             flag: '🇧🇴', currency: 'BOB' },
  { code: '+34',  country: 'España',              flag: '🇪🇸', currency: 'EUR' },
];

/**
 * Format a number as currency string.
 * Returns symbol + formatted number (e.g. "$1.000", "$1,000", "R$1.000,00").
 * Defaults to COP if currency is unknown.
 */
export function formatCurrency(amount, currency = 'COP') {
  const cfg = CURRENCIES[currency] || CURRENCIES.COP;
  const num = new Intl.NumberFormat(cfg.locale, {
    minimumFractionDigits: cfg.decimals,
    maximumFractionDigits: cfg.decimals,
  }).format(amount || 0);
  return `${cfg.symbol}${num}`;
}

/** Returns just the symbol for a given currency code. */
export function getCurrencySymbol(currency = 'COP') {
  return CURRENCIES[currency]?.symbol ?? '$';
}

/** Returns locale string for a given currency code. */
export function getCurrencyLocale(currency = 'COP') {
  return CURRENCIES[currency]?.locale ?? 'es-CO';
}

/**
 * Returns the recommended currency for a given country dial code.
 * Used to auto-suggest currency when the user selects their country.
 */
export function getCurrencyForDialCode(dialCode) {
  return COUNTRY_CODES.find(c => c.code === dialCode)?.currency ?? 'COP';
}
