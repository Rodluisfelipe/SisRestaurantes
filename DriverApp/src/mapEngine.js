/**
 * mapEngine — central MapLibre setup for the DriverApp.
 *
 * Uses MapLibre Native (no Google) with free OpenStreetMap vector tiles from
 * OpenFreeMap (https://openfreemap.org) — no API key, no sign-up, no limits.
 * Style "positron" is a clean light base that matches the red & white UI.
 *
 * Note: MapLibre is a NATIVE module — it does NOT run in Expo Go. The app must
 * be run via a dev build or an EAS/`expo run:android` APK.
 *
 * Coordinates in MapLibre are GeoJSON order: [longitude, latitude].
 */

import * as MapLibre from '@maplibre/maplibre-react-native';

// MapLibre (unlike Mapbox) needs no access token; call it defensively in case
// a given version still expects it.
try {
  (MapLibre.setAccessToken || MapLibre.default?.setAccessToken)?.(null);
} catch { /* no-op */ }

const ns = MapLibre.default || MapLibre;

export const MapView       = MapLibre.MapView       || ns.MapView;
export const Camera        = MapLibre.Camera        || ns.Camera;
export const MarkerView    = MapLibre.MarkerView    || ns.MarkerView;
export const PointAnnotation = MapLibre.PointAnnotation || ns.PointAnnotation;
export const ShapeSource   = MapLibre.ShapeSource   || ns.ShapeSource;
export const LineLayer     = MapLibre.LineLayer     || ns.LineLayer;
export const UserLocation  = MapLibre.UserLocation  || ns.UserLocation;

// Free OSM vector style — swap to 'liberty' or 'bright' for a more colourful map.
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

// Helpers to convert between our {lat, lon} shape and MapLibre's [lng, lat].
export const toLngLat = (lat, lon) => [lon, lat];
