import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MapPin, Delete, LogIn, LogOut, RotateCcw, Loader2, Check } from 'lucide-react';
import api from '../../services/api';

/**
 * Lo que abre el celular del empleado al escanear el QR de la pantalla.
 *
 * Rápido: el escaneo y la ubicación arrancan juntos apenas abre la página, y
 * el teclado del PIN aparece de una vez. Con el PIN, el servidor dice quién es
 * y qué va a marcar ("Hola Ana · ENTRADA"); la marca solo se registra cuando
 * la persona confirma.
 *
 * Protegido contra el doble escaneo: si el mismo celular abre el link dos
 * veces (dos pestañas, la cámara que abre dos veces) se reutiliza el mismo
 * escaneo en vez de gastar dos QR.
 */
const LARGO_PIN = 4;
const CACHE_MS = 9 * 60 * 1000; // el pase dura 10 min en el servidor
const enCurso = new Map(); // codigo → promesa del escaneo (evita dos POST desde la misma pestaña)

function leerCache(codigo) {
  try {
    const v = JSON.parse(localStorage.getItem(`asis:${codigo}`) || 'null');
    return v && Date.now() - v.t < CACHE_MS ? v.datos : null;
  } catch { return null; }
}
function guardarCache(codigo, datos) {
  try { localStorage.setItem(`asis:${codigo}`, JSON.stringify({ t: Date.now(), datos })); } catch { /* sin almacenamiento */ }
}
function borrarCache(codigo) {
  try { localStorage.removeItem(`asis:${codigo}`); } catch { /* nada */ }
}

function escanear(clave, codigo) {
  const cache = leerCache(codigo);
  if (cache) return Promise.resolve(cache);
  if (!enCurso.has(codigo)) {
    enCurso.set(codigo, api.post('/asistencia/escanear', { clave, codigo })
      .then(({ data }) => { guardarCache(codigo, data); return data; })
      .finally(() => setTimeout(() => enCurso.delete(codigo), 1000)));
  }
  return enCurso.get(codigo);
}

function obtenerUbicacion() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('sin-gps')); return; }
    const pedir = (alta, reintento) => navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, precision: Math.round(pos.coords.accuracy) }),
      (err) => {
        if (err.code === 1) reject(err);
        else if (reintento) pedir(false, false); // sin precisión alta suele responder más rápido
        else reject(err);
      },
      { enableHighAccuracy: alta, timeout: alta ? 10000 : 15000, maximumAge: 30000 },
    );
    pedir(true, true);
  });
}

export default function MarcarAsistencia() {
  const { clave, codigo } = useParams();
  const [paso, setPaso] = useState('escaneando'); // escaneando | pin | verificando | confirmar | registrando | listo | fallo
  const [info, setInfo] = useState(null);
  const [ubic, setUbic] = useState({ estado: 'buscando' }); // buscando | lista | error
  const [pin, setPin] = useState('');
  const [aviso, setAviso] = useState('');
  const [quien, setQuien] = useState(null); // { confirmacion, nombre, tipo, sede }
  const [resultado, setResultado] = useState(null);
  const [fallo, setFallo] = useState('');
  const promesaUbic = useRef(null);
  const ocupado = useRef(false);

  const pedirUbicacion = useCallback(() => {
    setUbic({ estado: 'buscando' });
    promesaUbic.current = obtenerUbicacion()
      .then((u) => { setUbic({ estado: 'lista', ...u }); return u; })
      .catch((err) => {
        setUbic({
          estado: 'error',
          mensaje: err?.code === 1
            ? 'Bloqueaste la ubicación. Actívala para este sitio en los ajustes del navegador.'
            : 'No pudimos obtener tu ubicación. Revisa que el GPS esté prendido.',
        });
        return null;
      });
    return promesaUbic.current;
  }, []);

  // Escaneo y ubicación arrancan al mismo tiempo.
  useEffect(() => {
    pedirUbicacion();
    escanear(clave, codigo)
      .then((data) => { setInfo(data); setPaso('pin'); })
      .catch((e) => { setFallo(e.response?.data?.message || 'No pudimos leer el QR. Escanéalo otra vez.'); setPaso('fallo'); });
  }, [clave, codigo, pedirUbicacion]);

  const vencer = (mensaje) => { borrarCache(codigo); setFallo(mensaje); setPaso('fallo'); };

  // PIN completo → ¿quién es y qué marca?
  const identificar = useCallback(async (pinCompleto) => {
    if (ocupado.current) return;
    ocupado.current = true;
    setPaso('verificando');
    setAviso('');
    try {
      const { data } = await api.post('/asistencia/identificar', { pase: info.pase, pin: pinCompleto });
      setQuien(data);
      setPaso('confirmar');
      navigator.vibrate?.(30);
    } catch (e) {
      const d = e.response?.data || {};
      if (d.vencido) vencer(d.message);
      else { setAviso(d.message || 'No se pudo verificar. Intenta de nuevo.'); setPin(''); setPaso('pin'); navigator.vibrate?.([40, 40, 40]); }
    } finally {
      ocupado.current = false;
    }
  }, [info]);

  // Confirmar → registrar (espera la ubicación si todavía no llega).
  const confirmar = async () => {
    if (ocupado.current) return;
    ocupado.current = true;
    setPaso('registrando');
    try {
      const u = ubic.estado === 'lista' ? ubic : await (promesaUbic.current || pedirUbicacion());
      if (!u) { setPaso('confirmar'); return; }
      const { data } = await api.post('/asistencia/confirmar', {
        confirmacion: quien.confirmacion,
        ubicacion: { lat: u.lat, lng: u.lng, precision: u.precision },
      });
      borrarCache(codigo);
      setResultado(data);
      setPaso('listo');
      navigator.vibrate?.(90);
    } catch (e) {
      const d = e.response?.data || {};
      if (d.yaRegistrada) { borrarCache(codigo); setResultado({ ...quien, hora: '', yaEstaba: true, mensaje: d.message }); setPaso('listo'); }
      else if (d.vencido) vencer(d.message);
      else { setAviso(d.message || 'No se pudo registrar. Intenta de nuevo.'); setPaso('confirmar'); }
    } finally {
      ocupado.current = false;
    }
  };

  const tocar = (n) => {
    if (paso !== 'pin') return;
    setAviso('');
    const nuevo = (pin + n).slice(0, LARGO_PIN);
    setPin(nuevo);
    if (nuevo.length === LARGO_PIN) identificar(nuevo);
  };

  const noSoyYo = () => { setQuien(null); setPin(''); setAviso(''); setPaso('pin'); };

  const color = info?.negocio?.color || '#E8002D';
  const esEntrada = (quien || resultado)?.tipo === 'entrada';
  const colorTipo = esEntrada ? '#059669' : '#2563EB';

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col px-5" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 18px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 18px)' }}>
      <div className="w-full max-w-sm mx-auto flex-1 flex flex-col">
        {/* Negocio y sede */}
        <div className="flex items-center gap-3 min-h-[44px]">
          {info ? (
            <>
              {info.negocio.logo
                ? <img src={info.negocio.logo} alt="" className="w-11 h-11 rounded-xl object-cover border border-slate-200 bg-white" />
                : <span className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-lg font-black" style={{ background: color }}>{info.negocio.nombre.charAt(0)}</span>}
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-black text-slate-900 leading-tight truncate">{info.negocio.nombre}</p>
                <p className="text-[13px] text-slate-500 truncate">{info.sede}</p>
              </div>
            </>
          ) : paso !== 'fallo' && (
            <>
              <span className="w-11 h-11 rounded-xl bg-slate-200 animate-pulse" />
              <span className="h-4 w-32 rounded bg-slate-200 animate-pulse" />
            </>
          )}
        </div>

        {/* Estado de la ubicación, siempre a la vista mientras se marca */}
        {['pin', 'verificando', 'confirmar', 'registrando'].includes(paso) && (
          <div className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold ${ubic.estado === 'error' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-white border border-slate-200 text-slate-600'}`} role="status">
            {ubic.estado === 'buscando' && <><Loader2 className="w-4 h-4 animate-spin" /> Obteniendo tu ubicación…</>}
            {ubic.estado === 'lista' && <><MapPin className="w-4 h-4 text-emerald-600" /> Ubicación lista</>}
            {ubic.estado === 'error' && (
              <>
                <MapPin className="w-4 h-4 shrink-0" />
                <span className="flex-1 leading-snug">{ubic.mensaje}</span>
                <button type="button" onClick={pedirUbicacion} className="shrink-0 underline">Reintentar</button>
              </>
            )}
          </div>
        )}

        {paso === 'escaneando' && (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="w-9 h-9 text-slate-400 animate-spin" /></div>
        )}

        {paso === 'fallo' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <span className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center"><RotateCcw className="w-7 h-7 text-amber-600" /></span>
            <p className="mt-4 text-lg font-bold text-slate-900 leading-snug">{fallo}</p>
          </div>
        )}

        {(paso === 'pin' || paso === 'verificando') && (
          <div className="flex-1 flex flex-col justify-center">
            <p className="text-center text-xl font-black text-slate-900">Escribe tu PIN</p>
            <div className="mt-5 flex justify-center gap-3" aria-label={`${pin.length} de ${LARGO_PIN} números`}>
              {Array.from({ length: LARGO_PIN }).map((_, i) => (
                <span key={i} className="w-4 h-4 rounded-full border-2 transition-colors" style={i < pin.length ? { background: color, borderColor: color } : { borderColor: '#CBD5E1' }} />
              ))}
            </div>
            <p className="mt-3 min-h-[40px] text-center text-[14px] font-semibold text-red-600 leading-snug" role="alert">
              {paso === 'verificando' ? <span className="text-slate-500">Verificando…</span> : aviso}
            </p>
            <div className="grid grid-cols-3 gap-3 mt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
                <button key={n} type="button" onClick={() => tocar(n)} disabled={paso !== 'pin'} className="h-16 rounded-2xl bg-white border border-slate-200 text-2xl font-bold text-slate-900 active:bg-slate-100 active:scale-95 transition-transform disabled:opacity-50">{n}</button>
              ))}
              <span />
              <button type="button" onClick={() => tocar('0')} disabled={paso !== 'pin'} className="h-16 rounded-2xl bg-white border border-slate-200 text-2xl font-bold text-slate-900 active:bg-slate-100 active:scale-95 transition-transform disabled:opacity-50">0</button>
              <button type="button" onClick={() => { setPin((p) => p.slice(0, -1)); setAviso(''); }} disabled={paso !== 'pin' || !pin} className="h-16 rounded-2xl flex items-center justify-center text-slate-500 active:bg-slate-100 disabled:opacity-30" aria-label="Borrar">
                <Delete className="w-7 h-7" />
              </button>
            </div>
          </div>
        )}

        {(paso === 'confirmar' || paso === 'registrando') && quien && (
          <div className="flex-1 flex flex-col justify-center animate-aparecer">
            <div className="rounded-3xl bg-white border border-slate-200 p-6 text-center shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
              <span className="mx-auto w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black text-white" style={{ background: colorTipo }}>
                {quien.nombre.trim().charAt(0).toUpperCase()}
              </span>
              <p className="mt-3 text-2xl font-black text-slate-900">Hola, {quien.nombre.split(' ')[0]}</p>
              <p className="mt-1 text-[15px] text-slate-500">Vas a marcar tu</p>
              <p className="mt-1 text-4xl font-black tracking-tight" style={{ color: colorTipo }}>{esEntrada ? 'ENTRADA' : 'SALIDA'}</p>
              <p className="mt-2 text-[15px] font-semibold text-slate-700">
                {quien.sede} · {new Date().toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </p>
            </div>
            <p className="mt-3 min-h-[20px] text-center text-[14px] font-semibold text-red-600" role="alert">{aviso}</p>
            <button
              type="button"
              onClick={confirmar}
              disabled={paso === 'registrando' || ubic.estado === 'error'}
              className="mt-2 w-full h-16 rounded-2xl text-white text-[18px] font-black flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
              style={{ background: colorTipo }}
            >
              {paso === 'registrando'
                ? <><Loader2 className="w-5 h-5 animate-spin" /> {ubic.estado === 'buscando' ? 'Esperando tu ubicación…' : 'Registrando…'}</>
                : <>{esEntrada ? <LogIn className="w-6 h-6" /> : <LogOut className="w-6 h-6" />} Confirmar {esEntrada ? 'entrada' : 'salida'}</>}
            </button>
            <button type="button" onClick={noSoyYo} disabled={paso === 'registrando'} className="mt-3 h-11 text-[15px] font-semibold text-slate-500 disabled:opacity-40">
              No soy yo
            </button>
          </div>
        )}

        {paso === 'listo' && resultado && (
          <div className="flex-1 flex flex-col items-center justify-center text-center animate-aparecer">
            <span className="w-24 h-24 rounded-full flex items-center justify-center animate-agregado" style={{ background: resultado.tipo === 'entrada' ? '#059669' : '#2563EB' }}>
              <Check className="w-12 h-12 text-white" strokeWidth={3} />
            </span>
            {resultado.yaEstaba ? (
              <p className="mt-5 text-xl font-black text-slate-900 leading-snug">{resultado.mensaje}</p>
            ) : (
              <>
                <p className="mt-5 text-2xl font-black text-slate-900">{resultado.tipo === 'entrada' ? 'Entrada registrada' : 'Salida registrada'}</p>
                <p className="mt-1 text-4xl font-black tabular-nums text-slate-900">{resultado.hora}</p>
                <p className="mt-2 text-[15px] text-slate-500">{resultado.sede}</p>
                <p className="mt-6 text-lg font-semibold text-slate-700">
                  {resultado.tipo === 'entrada' ? `¡Buen turno, ${resultado.nombre.split(' ')[0]}!` : `¡Hasta luego, ${resultado.nombre.split(' ')[0]}!`}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
