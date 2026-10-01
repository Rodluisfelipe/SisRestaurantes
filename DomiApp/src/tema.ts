/**
 * El aspecto de la app. Pensado para la calle: pleno sol, una mano en el
 * manubrio, guantes, prisa. Por eso letra grande, contraste alto y botones
 * que se aciertan sin mirar.
 */
export const color = {
  fondo: '#F4F4F2',
  superficie: '#FFFFFF',
  tinta: '#0E0E10',
  tintaSuave: '#55565C',
  tintaTenue: '#8C8D93',
  borde: '#E4E4E0',

  marca: '#E11D2A',
  marcaOscura: '#B3121D',
  marcaSuave: '#FDE8E9',

  dinero: '#0F9D58',
  dineroSuave: '#E3F5EB',
  efectivo: '#F5A300',
  efectivoSuave: '#FFF3D6',
  peligro: '#D92D20',
  peligroSuave: '#FDECEA',
  info: '#1F6FEB',
  infoSuave: '#E6F0FF',

  noche: '#141417',
  nocheSuave: '#26262B',
} as const;

export const letra = {
  normal: 'Manrope_500Medium',
  media: 'Manrope_600SemiBold',
  fuerte: 'Manrope_700Bold',
  negra: 'Manrope_800ExtraBold',
} as const;

export const espacio = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 28 } as const;
export const radio = { s: 10, m: 14, l: 20, xl: 28, total: 999 } as const;

export const sombra = {
  tarjeta: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  flotante: {
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
} as const;

/** Altura mínima de cualquier cosa que se toque en ruta. */
export const TOQUE = 56;
