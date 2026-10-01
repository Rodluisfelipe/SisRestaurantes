/** Mapa nativo (MapLibre). La versión de navegador está en Mapa.web.tsx. */
import { Camera, GeoJSONSource, Layer, Map, Marker } from '@maplibre/maplibre-react-native';
import { StyleSheet } from 'react-native';
import { encuadre, ESTILO_MAPA, lineaRuta, Pin, Yo, type PropsMapa } from './mapaComun';

export function Mapa({ yo, paradas, margen = { arriba: 120, abajo: 320 }, trazo }: PropsMapa) {
  const vista = encuadre(yo, paradas, trazo);
  const relleno = { top: margen.arriba + 30, bottom: margen.abajo + 30, left: 50, right: 50 };
  const linea = lineaRuta(yo, paradas, trazo);
  const porCalles = !!trazo && trazo.length > 1;

  return (
    <Map
      style={StyleSheet.absoluteFill}
      mapStyle={ESTILO_MAPA}
      logo={false}
      compass={false}
      scaleBar={false}
      touchPitch={false}
      touchRotate={false}
      attributionPosition={{ bottom: margen.abajo + 8, left: 8 }}>
      {vista?.tipo === 'limites' && <Camera bounds={vista.limites} padding={relleno} duration={700} easing="ease" />}
      {vista?.tipo === 'centro' && <Camera center={vista.centro} zoom={vista.zoom} padding={relleno} duration={700} easing="ease" />}
      {!vista && <Camera center={[-74.08, 4.65]} zoom={10} />}

      {linea.geometry.coordinates.length > 1 && (
        <GeoJSONSource id="ruta" data={linea}>
          <Layer
            id="ruta-borde"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': '#ffffff', 'line-width': 8 }}
          />
          {/* key distinta: MapLibre no deja cambiarle el id a una capa montada */}
          {porCalles ? (
            <Layer
              key="ruta-calles"
              id="ruta-calles"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': '#1F6FEB', 'line-width': 5 }}
            />
          ) : (
            <Layer
              key="ruta-linea"
              id="ruta-linea"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': '#0E0E10', 'line-width': 4, 'line-dasharray': [0.2, 2] }}
            />
          )}
        </GeoJSONSource>
      )}

      {paradas.map((p, i) => p.ubicacion && (
        <Marker key={p.clave} id={p.clave} lngLat={[p.ubicacion.lng, p.ubicacion.lat]} anchor="bottom">
          <Pin parada={p} numero={i + 1} />
        </Marker>
      ))}
      {yo && (
        <Marker id="yo" lngLat={[yo.lng, yo.lat]} anchor="center">
          <Yo />
        </Marker>
      )}
    </Map>
  );
}
