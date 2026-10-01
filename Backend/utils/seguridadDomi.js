/**
 * Reglas contra trampas en la app del domi: app modificada y GPS falso.
 *
 * Funciones puras (sin base de datos) para poder probarlas solas.
 *
 * Lo que manda el celular se puede falsificar con suficiente esfuerzo; por eso
 * hay dos capas: lo que reporta la app (firma, ganchos, ubicación simulada) y
 * lo que el servidor comprueba por su cuenta (saltos imposibles de GPS).
 */
const { distanciaKm } = require('./domiApp');

/** Más rápido que esto, en moto por ciudad, es teletransporte. */
const MAX_KMH = 160;
/** Por debajo de esto el GPS normal "salta" solo (edificios, túneles). */
const SALTO_MIN_KM = 0.5;

/** Huellas SHA-256 de la llave con que se firma la app oficial (de la variable de entorno). */
function firmasPermitidas(texto = process.env.DOMI_APP_FIRMAS) {
  return String(texto || '')
    .split(/[\s,]+/)
    .map((f) => f.replace(/:/g, '').toLowerCase())
    .filter((f) => /^[0-9a-f]{64}$/.test(f));
}

/**
 * ¿La app que se conecta es la oficial y está sana?
 *
 * Sin firmas configuradas (desarrollo) no se exige nada. Con firmas:
 *  - la app tiene que mandar su reporte (la web no puede: queda por fuera);
 *  - la firma tiene que ser una de las nuestras (una app recompilada no la tiene);
 *  - sin herramientas de modificación en vivo (Frida, Xposed, LSPosed…);
 *  - sin modo depuración.
 * Root y emulador solo se anotan: hay domis honestos con el celular rooteado.
 */
function evaluarIntegridad(reporte, firmas = firmasPermitidas()) {
  const avisos = [];
  if (reporte?.root) avisos.push('root');
  if (reporte?.emulador) avisos.push('emulador');
  if (!firmas.length) return { exigida: false, alterada: false, motivos: [], avisos };

  if (!reporte || typeof reporte !== 'object') return { exigida: true, alterada: true, motivos: ['sin_reporte'], avisos };
  const motivos = [];
  const suyas = (Array.isArray(reporte.firmas) ? reporte.firmas : []).map((f) => String(f).replace(/:/g, '').toLowerCase());
  if (!suyas.some((f) => firmas.includes(f))) motivos.push('firma');
  if (Array.isArray(reporte.ganchos) && reporte.ganchos.length) motivos.push('ganchos');
  if (reporte.depurable) motivos.push('depurable');
  return { exigida: true, alterada: motivos.length > 0, motivos, avisos };
}

/**
 * Separa los puntos de GPS buenos de los falsos.
 *  - simulada: el propio Android dice que la ubicación es de una app de GPS falso;
 *  - salto: para llegar ahí desde el punto anterior habría que ir a más de 160 km/h.
 * `anterior` es el último punto bueno conocido ({ lat, lng, at }).
 */
function filtrarPuntos(puntos, anterior = null) {
  const buenos = [];
  let simulados = 0;
  let saltos = 0;
  let previo = anterior && anterior.at ? anterior : null;
  for (const p of puntos) {
    if (p.simulada) { simulados++; continue; }
    if (previo) {
      const km = distanciaKm(previo, p);
      const horas = (new Date(p.at) - new Date(previo.at)) / 3_600_000;
      if (km != null && km > SALTO_MIN_KM && (horas <= 0 || km / horas > MAX_KMH)) { saltos++; continue; }
    }
    buenos.push(p);
    previo = p;
  }
  return { buenos, simulados, saltos };
}

module.exports = { MAX_KMH, firmasPermitidas, evaluarIntegridad, filtrarPuntos };
