// Light "red & white" palette — clean, high-contrast delivery driver UI.
// Red is the brand / primary; surfaces are white on a soft gray app background.
// Green is kept ONLY as a functional status (online / success / countdown-safe),
// where red would read as an alert.
export const C = {
  // grounds
  bg:        '#F4F6FA',   // soft gray app background (cards sit on top)
  card:      '#FFFFFF',   // primary surface
  card2:     '#F7F8FB',   // subtle inset surface (inputs, stats)
  line:      '#E4E8EF',   // borders
  lineSoft:  '#EEF1F6',   // softer borders / dividers

  // text
  text:      '#111827',   // near-black ink
  sub:       '#5B6472',   // secondary
  faint:     '#96A0AE',   // tertiary / placeholders

  // brand / actions
  brand:     '#E11D2A',   // vivid red (primary CTA / brand)
  brandDark: '#B10F1A',
  go:        '#12B981',   // green (online / confirm success / safe)
  goDark:    '#0E9E6E',
  blue:      '#2563EB',
  amber:     '#E0921A',
  violet:    '#7C5CF6',
  bad:       '#E11D2A',   // red (danger / countdown running out / errors)

  white:     '#FFFFFF',
  black:     '#000000',

  // ink that sits on top of a filled brand/accent button
  onAccent:  '#FFFFFF',
};

// Reusable shadow presets — soft, for a light UI
export const shadow = {
  card: {
    shadowColor: '#1B2A4A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 6,
  },
  glow: (color) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 8,
  }),
};

// Clean light map style (Google Maps JSON — applied on Android; iOS uses Apple Maps).
// Mutes POIs/transit so delivery pins stand out on a bright, legible base.
export const mapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#F5F6F8' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6B7280' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8A93A3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#FDE7E1' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#F6C9BE' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#D6E4F0' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#E6F0E4' }] },
];

// Back-compat alias (older imports referenced mapDarkStyle)
export const mapDarkStyle = mapStyle;
