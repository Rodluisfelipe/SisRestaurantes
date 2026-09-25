import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MapPin, Delete, LogIn, LogOut, RotateCcw } from 'lucide-react';
import api from '../../services/api';

/**
 * Lo que abre el celular del empleado al escanear el QR de la pantalla:
 * acepta compartir la ubicación, pone su PIN y listo. Si lo último que marcó
 * fue una entrada, esto es la salida (lo decide el servidor).
 */
const LARGO_PIN = 4;

function leerCache(codigo) {
  try { return JSON.parse(sessionStorage.getItem(`asis:${codigo}`) || 'null'); } catch { return null; }
}
function guardarCache(codigo, v) {
  try { sessionStorage.setItem(`asis:${codigo}`, JSON.stringify(v)); } catch { /* sin almacenamiento */ }
}

export default function MarcarAsistencia() {
  const { clave, codigo } = useParams();
  const [paso, setPaso] = useState('escaneando'); // escaneando | ubicacion | pin | enviando | listo | fallo
  const [info, setInfo] = useState(null); // { pase, negocio, sede }
  const [ubicacion, setUbicacion] = useState(null);
  const [ubicError, setUbicError] = useState('');
  const [pin, setPin] = useState('');
  const [aviso, setAviso] = useState('');
  const [resultado, setResultado] = useState(null);
  const [fallo, setFallo] = useState('');
  const enviando = useRef(false);

  // 1. Gastar el código del QR (la pantalla cambia al siguiente).
  useEffect(() => {
    const cache = leerCache(codigo);
    if (cache) { setInfo(cache); setPaso('ubicacion'); return; }
    api.post('/asistencia/escanear', { clave, codigo })
      .then(({ data }) => { guardarCache(codigo, data); setInfo(data); setPaso('ubicacion'); })
      .catch((e) => { setFallo(e.response?.data?.message || 'No pudimos leer el QR. Escanéalo otra vez.'); setPaso('fallo'); });
  }, [clave, codigo]);

  // 2. Ubicación
  const pedirUbicacion = useCallback(() => {
    setUbicError('');
    if (!navigator.geolocation) { setUbicError('Tu celular no permite compartir la ubicación desde el navegador.'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUbicacion({ lat: pos.coords.latitude, lng: pos.coords.longitude, precision: Math.round(pos.coords.accuracy) });
        setPaso('pin');
      },
      (err) => {
        setUbicError(err.code === 1
          ? 'Bloqueaste la ubicación. Actívala para este sitio en los ajustes del navegador y vuelve a intentar.'
          : 'No pudimos obtener tu ubicación. Revisa que el GPS esté prendido y vuelve a intentar.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, []);

  useEffect(() => {
    if (paso === 'ubicacion' && !ubicacion) pedirUbicacion();
  }, [paso, ubicacion, pedirUbicacion]);

  // 3. PIN: al completar los 4 números se envía solo.
  const enviar = useCallback(async (pinCompleto) => {
    if (enviando.current) return;
    enviando.current = true;
    setPaso('enviando');
    setAviso('');
    try {
      const { data } = await api.post('/asistencia/marcar', { pase: info.pase, pin: pinCompleto, ubicacion });
      setResultado(data);
      setPaso('listo');
      try { sessionStorage.removeItem(`asis:${codigo}`); } catch { /* nada */ }
      navigator.vibrate?.(80);
    } catch (e) {
      const d = e.response?.data || {};
      if (d.vencido) { setFallo(d.message); setPaso('fallo'); }
      else { setAviso(d.message || 'No se pudo registrar. Intenta de nuevo.'); setPin(''); setPaso('pin'); navigator.vibrate?.([40, 40, 40]); }
    } finally {
      enviando.current = false;
    }
  }, [info, ubicacion, codigo]);

  const tocar = (n) => {
    if (paso !== 'pin') return;
    setAviso('');
    const nuevo = (pin + n).slice(0, LARGO_PIN);
    setPin(nuevo);
    if (nuevo.length === LARGO_PIN) enviar(nuevo);
  };

  const color = info?.negocio?.color || '#E8002D';

  const Cabecera = () => info && (
    <div className="flex items-center gap-3">
      {info.negocio.logo
        ? <img src={info.negocio.logo} alt="" className="w-11 h-11 rounded-xl object-cover border border-slate-200" />
        : <span className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-lg font-black" style={{ background: color }}>{info.negocio.nombre.charAt(0)}</span>}
      <div className="min-w-0">
        <p className="text-[17px] font-black text-slate-900 leading-tight truncate">{info.negocio.nombre}</p>
        <p className="text-[13px] text-slate-500 truncate">{info.sede}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col px-5" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 20px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}>
      <div className="w-full max-w-sm mx-auto flex-1 flex flex-col">
        <Cabecera />

        {paso === 'escaneando' && (
          <div className="flex-1 flex items-center justify-center"><div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-slate-500 animate-spin" /></div>
        )}

        {paso === 'fallo' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <span className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center"><RotateCcw className="w-7 h-7 text-amber-600" /></span>
            <p className="mt-4 text-lg font-bold text-slate-900">{fallo}</p>
          </div>
        )}

        {paso === 'ubicacion' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <span className="w-16 h-16 rounded-full bg-white border border-slate-200 flex items-center justify-center"><MapPin className="w-7 h-7" style={{ color }} /></span>
            <p className="mt-4 text-xl font-black text-slate-900">Comparte tu ubicación</p>
            <p className="mt-1 text-[15px] text-slate-500">Toca "Permitir" cuando tu celular lo pida.</p>
            {ubicError && <p className="mt-4 text-[14px] text-red-600 font-semibold">{ubicError}</p>}
            <button type="button" onClick={pedirUbicacion} className="mt-6 w-full h-12 rounded-full text-white font-bold text-[15px]" style={{ background: color }}>
              {ubicError ? 'Intentar de nuevo' : 'Compartir ubicación'}
            </button>
          </div>
        )}

        {(paso === 'pin' || paso === 'enviando') && (
          <div className="flex-1 flex flex-col justify-center">
            <p className="text-center text-xl font-black text-slate-900">Escribe tu PIN</p>
            <div className="mt-5 flex justify-center gap-3" aria-label={`${pin.length} de ${LARGO_PIN} números`}>
              {Array.from({ length: LARGO_PIN }).map((_, i) => (
                <span key={i} className="w-4 h-4 rounded-full border-2 transition-colors" style={i < pin.length ? { background: color, borderColor: color } : { borderColor: '#CBD5E1' }} />
              ))}
            </div>
            <p className="mt-3 h-10 text-center text-[14px] font-semibold text-red-600" role="alert">{paso === 'enviando' ? <span className="text-slate-500">Registrando…</span> : aviso}</p>
            <div className="grid grid-cols-3 gap-3 mt-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
                <button key={n} type="button" onClick={() => tocar(n)} disabled={paso === 'enviando'} className="h-16 rounded-2xl bg-white border border-slate-200 text-2xl font-bold text-slate-900 active:bg-slate-100 disabled:opacity-50">{n}</button>
              ))}
              <span />
              <button type="button" onClick={() => tocar('0')} disabled={paso === 'enviando'} className="h-16 rounded-2xl bg-white border border-slate-200 text-2xl font-bold text-slate-900 active:bg-slate-100 disabled:opacity-50">0</button>
              <button type="button" onClick={() => { setPin((p) => p.slice(0, -1)); setAviso(''); }} disabled={paso === 'enviando' || !pin} className="h-16 rounded-2xl flex items-center justify-center text-slate-500 active:bg-slate-100 disabled:opacity-30" aria-label="Borrar">
                <Delete className="w-7 h-7" />
              </button>
            </div>
          </div>
        )}

        {paso === 'listo' && resultado && (
          <div className="flex-1 flex flex-col items-center justify-center text-center animate-aparecer">
            <span className={`w-24 h-24 rounded-full flex items-center justify-center ${resultado.tipo === 'entrada' ? 'bg-emerald-500' : 'bg-blue-600'}`}>
              {resultado.tipo === 'entrada' ? <LogIn className="w-11 h-11 text-white" /> : <LogOut className="w-11 h-11 text-white" />}
            </span>
            <p className="mt-5 text-2xl font-black text-slate-900">{resultado.tipo === 'entrada' ? 'Entrada registrada' : 'Salida registrada'}</p>
            <p className="mt-1 text-4xl font-black tabular-nums text-slate-900">{resultado.hora}</p>
            <p className="mt-2 text-[15px] text-slate-500">{resultado.sede}</p>
            <p className="mt-6 text-lg font-semibold text-slate-700">
              {resultado.tipo === 'entrada' ? `¡Buen turno, ${resultado.nombre.split(' ')[0]}!` : `¡Hasta luego, ${resultado.nombre.split(' ')[0]}!`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
