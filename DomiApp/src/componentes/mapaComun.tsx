/** Lo que comparten el mapa nativo y el de web: pines, encuadre, estilo. */
import { StyleSheet, Text, View } from 'react-native';
import type { Parada } from '@/lib/ruta';
import type { Punto } from '@/lib/tipos';
import { color, letra } from '@/tema';
import { Icono } from './base';

/** Mapa gratuito de OpenStreetMap (OpenFreeMap): sin clave, sin cupo, sin factura. */
export const ESTILO_MAPA = 'https://tiles.openfreemap.org/styles/liberty';

export type PropsMapa = {
  yo: Punto | null;
  rumbo?: number | null;
  paradas: Parada[];
  /** Espacio que tapan las tarjetas de arriba y abajo, para no esconder los pines */
  margen?: { arriba: number; abajo: number };
  /** La ruta por las calles ([lng, lat]); sin ella se dibuja la línea recta punteada */
  trazo?: [number, number][] | null;
  /** Centrado en el domi con zoom de calle, siguiéndolo; si no, se ve toda la ruta */
  seguir?: boolean;
};

export const ZOOM_SEGUIR = 17.5;

export function encuadre(yo: Punto | null, paradas: Parada[], trazo?: [number, number][] | null):
  | { tipo: 'centro'; centro: [number, number]; zoom: number }
  | { tipo: 'limites'; limites: [number, number, number, number] }
  | null {
  // La ruta por calles puede salirse de los pines: también entra en el encuadre
  const delTrazo = (trazo || []).map(([lng, lat]) => ({ lat, lng }));
  const puntos = [yo, ...paradas.map((p) => p.ubicacion), ...delTrazo].filter(Boolean) as Punto[];
  if (!puntos.length) return null;
  if (puntos.length === 1) return { tipo: 'centro', centro: [puntos[0].lng, puntos[0].lat], zoom: 15 };
  const lats = puntos.map((p) => p.lat);
  const lngs = puntos.map((p) => p.lng);
  return { tipo: 'limites', limites: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)] };
}

export function lineaRuta(yo: Punto | null, paradas: Parada[], trazo?: [number, number][] | null) {
  const crudos = trazo && trazo.length > 1
    ? trazo
    : [yo, ...paradas.map((p) => p.ubicacion)].filter(Boolean).map((p) => [p!.lng, p!.lat]);
  // Puntos repetidos seguidos (una parada encima de otra) dejan la línea "inválida" para el mapa
  const coords = crudos.filter(([lng, lat], i) => Number.isFinite(lng) && Number.isFinite(lat)
    && (i === 0 || lng !== crudos[i - 1][0] || lat !== crudos[i - 1][1]));
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'LineString' as const, coordinates: coords.length > 1 ? coords : [] },
  };
}

export function Pin({ parada, numero }: { parada: Parada; numero: number }) {
  const recoger = parada.tipo === 'recoger';
  return (
    <View style={s.pin} pointerEvents="none">
      <View style={[s.burbuja, { backgroundColor: recoger ? color.marca : color.tinta }]}>
        <Icono nombre={recoger ? 'storefront' : 'home-variant'} tam={16} tinte="#fff" />
        <Text style={s.numero}>{numero}</Text>
      </View>
      <View style={[s.punta, { borderTopColor: recoger ? color.marca : color.tinta }]} />
    </View>
  );
}

export function Yo() {
  return (
    <View style={s.yoHalo} pointerEvents="none">
      <View style={s.yo} />
    </View>
  );
}

const s = StyleSheet.create({
  pin: { alignItems: 'center' },
  burbuja: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, height: 32, borderRadius: 16,
    borderWidth: 2.5, borderColor: '#fff',
  },
  numero: { color: '#fff', fontFamily: letra.negra, fontSize: 15 },
  punta: {
    width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 9,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -1,
  },
  yoHalo: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(31,111,235,0.2)', alignItems: 'center', justifyContent: 'center' },
  yo: { width: 18, height: 18, borderRadius: 9, backgroundColor: color.info, borderWidth: 3, borderColor: '#fff' },
});
