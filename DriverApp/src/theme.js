// Premium dark palette — inspired by top-tier delivery driver apps
export const C = {
  // grounds
  bg:        '#0A0E16',
  card:      '#141B28',
  card2:     '#1B2434',
  line:      '#26324A',
  lineSoft:  '#1E2838',

  // text
  text:      '#F7FAFF',
  sub:       '#94A2BC',
  faint:     '#5E6B85',

  // brand / actions
  brand:     '#FF5A3C',   // vibrant orange-red (primary CTA / brand)
  brandDark: '#E8452A',
  go:        '#12E29C',   // mint green (online / confirm / success)
  goDark:    '#0BB981',
  blue:      '#3B82F6',
  amber:     '#F5B23D',
  violet:    '#8B7CF6',

  white:     '#FFFFFF',
  black:     '#000000',
};

// Reusable shadow presets
export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  glow: (color) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  }),
};

// Dark map style (Google Maps JSON — applied on Android; iOS uses Apple Maps)
export const mapDarkStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0f1621' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f1621' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b7a95' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1c2636' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a97b0' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2a3752' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a121e' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];
