/**
 * Mapa para el navegador (solo para probar la app en web): maplibre-gl con el
 * mismo estilo y los mismos pines que el nativo.
 *
 * Se carga del CDN oficial y no del paquete: empaquetado por Metro, maplibre
 * no encuentra su "worker" y el mapa no arranca.
 */
import type { GeoJSONSource, Map as MapaGL, Marker } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StyleSheet, View } from 'react-native';
import { encuadre, ESTILO_MAPA, lineaRuta, Pin, Yo, ZOOM_SEGUIR, type PropsMapa } from './mapaComun';

const VERSION = '6.11.2';
type Libreria = typeof import('maplibre-gl');
let cargando: Promise<Libreria> | null = null;

function cargarMaplibre(): Promise<Libreria> {
  const w = window as unknown as { maplibregl?: Libreria };
  if (w.maplibregl) return Promise.resolve(w.maplibregl);
  cargando ??= new Promise((res, rej) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `https://cdn.jsdelivr.net/npm/maplibre-gl@${VERSION}/dist/maplibre-gl.css`;
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = `https://cdn.jsdelivr.net/npm/maplibre-gl@${VERSION}/dist/maplibre-gl.js`;
    js.onload = () => (w.maplibregl ? res(w.maplibregl) : rej(new Error('maplibre no cargó')));
    js.onerror = () => rej(new Error('maplibre no cargó'));
    document.head.appendChild(js);
  });
  return cargando;
}

export function Mapa({ yo, paradas, margen = { arriba: 120, abajo: 320 }, trazo, seguir }: PropsMapa) {
  const caja = useRef<HTMLDivElement | null>(null);
  const mapa = useRef<MapaGL | null>(null);
  const lib = useRef<Libreria | null>(null);
  const marcadores = useRef<{ m: Marker; raiz: Root }[]>([]);
  const cargado = useRef(false);
  const pendiente = useRef<(() => void) | null>(null);

  useEffect(() => {
    let vivo = true;
    let m: MapaGL | null = null;
    cargarMaplibre().then((L) => {
      if (!vivo || !caja.current) return;
      lib.current = L;
      m = new L.Map({ container: caja.current, style: ESTILO_MAPA, center: [-74.08, 4.65], zoom: 11, attributionControl: { compact: true } });
      m.dragRotate.disable();
      m.touchZoomRotate.disableRotation();
      m.on('load', () => {
        cargado.current = true;
        m!.addSource('ruta', { type: 'geojson', data: lineaRuta(null, []) });
        m!.addLayer({ id: 'ruta-borde', type: 'line', source: 'ruta', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#fff', 'line-width': 8 } });
        m!.addLayer({ id: 'ruta-linea', type: 'line', source: 'ruta', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#0E0E10', 'line-width': 4, 'line-dasharray': [0.2, 2] } });
        pendiente.current?.();
      });
      mapa.current = m;
    }).catch(() => { /* sin mapa en web: la app sigue funcionando */ });
    return () => { vivo = false; m?.remove(); mapa.current = null; cargado.current = false; };
  }, []);

  useEffect(() => {
    const pintar = () => {
      const m = mapa.current;
      const L = lib.current;
      if (!m || !L || !cargado.current) return;
      marcadores.current.forEach(({ m: mk, raiz }) => { mk.remove(); setTimeout(() => raiz.unmount(), 0); });
      marcadores.current = [];
      const poner = (lngLat: [number, number], nodo: React.ReactElement, anchor: 'bottom' | 'center') => {
        const el = document.createElement('div');
        const raiz = createRoot(el);
        raiz.render(nodo);
        marcadores.current.push({ m: new L.Marker({ element: el, anchor }).setLngLat(lngLat).addTo(m), raiz });
      };
      paradas.forEach((p, i) => p.ubicacion && poner([p.ubicacion.lng, p.ubicacion.lat], <Pin parada={p} numero={i + 1} />, 'bottom'));
      if (yo) poner([yo.lng, yo.lat], <Yo />, 'center');
      (m.getSource('ruta') as GeoJSONSource | undefined)?.setData(lineaRuta(yo, paradas, trazo));
      // Por calles: línea continua azul; en recta: punteada, como aproximación
      const porCalles = !!trazo && trazo.length > 1;
      if (m.getLayer('ruta-linea')) {
        m.setPaintProperty('ruta-linea', 'line-color', porCalles ? '#1F6FEB' : '#0E0E10');
        m.setPaintProperty('ruta-linea', 'line-width', porCalles ? 5 : 4);
        m.setPaintProperty('ruta-linea', 'line-dasharray', porCalles ? [1, 0] : [0.2, 2]);
      }
      const v = seguir && yo
        ? { tipo: 'centro' as const, centro: [yo.lng, yo.lat] as [number, number], zoom: ZOOM_SEGUIR }
        : encuadre(yo, paradas, trazo);
      const padding = { top: margen.arriba + 30, bottom: margen.abajo + 30, left: 50, right: 50 };
      if (v?.tipo === 'limites') m.fitBounds([[v.limites[0], v.limites[1]], [v.limites[2], v.limites[3]]], { padding, duration: 600, maxZoom: 16 });
      if (v?.tipo === 'centro') m.easeTo({ center: v.centro, zoom: v.zoom, padding, duration: 600 });
    };
    pendiente.current = pintar;
    pintar();
  }, [yo, paradas, margen.arriba, margen.abajo, trazo, seguir]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <div ref={caja} style={{ position: 'absolute', inset: 0 }} />
    </View>
  );
}
