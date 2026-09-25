import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Check } from 'lucide-react';
import api from '../../services/api';

/**
 * La pantalla del local (tablet o computador de la caja): muestra el QR para
 * marcar entrada o salida. El QR cambia cada vez que alguien lo escanea, así
 * que una foto del QR no sirve para marcar después.
 */
const CADA_MS = 2000;

export default function PantallaAsistencia() {
  const { clave } = useParams();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [escaneado, setEscaneado] = useState(false);
  const [ahora, setAhora] = useState(new Date());
  const codigoPrevio = useRef(null);

  // Pide el código actual; si cambió, alguien acaba de escanear.
  useEffect(() => {
    let vivo = true;
    let timer;
    const pedir = async () => {
      try {
        const { data } = await api.get(`/asistencia/pantalla/${clave}`);
        if (!vivo) return;
        setError('');
        if (codigoPrevio.current && codigoPrevio.current !== data.codigo) {
          setEscaneado(true);
          setTimeout(() => vivo && setEscaneado(false), 1800);
        }
        codigoPrevio.current = data.codigo;
        setDatos(data);
      } catch (e) {
        if (vivo && e.response?.status === 404) setError(e.response.data?.message || 'Este link no existe.');
      }
      if (vivo) timer = setTimeout(pedir, CADA_MS);
    };
    pedir();
    return () => { vivo = false; clearTimeout(timer); };
  }, [clave]);

  // Reloj
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Que la pantalla no se apague mientras está abierta.
  useEffect(() => {
    let lock;
    const pedirLock = async () => {
      try { lock = await navigator.wakeLock?.request('screen'); } catch { /* no disponible */ }
    };
    pedirLock();
    const alVolver = () => { if (document.visibilityState === 'visible') pedirLock(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => { document.removeEventListener('visibilitychange', alVolver); lock?.release?.(); };
  }, []);

  useEffect(() => {
    if (datos?.negocio?.nombre) document.title = `Asistencia · ${datos.negocio.nombre}`;
  }, [datos?.negocio?.nombre]);

  if (error) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50 p-6 text-center">
        <div>
          <p className="text-xl font-bold text-slate-900">{error}</p>
          <p className="mt-2 text-slate-500">Pide el link nuevo al administrador del negocio.</p>
        </div>
      </div>
    );
  }

  if (!datos) {
    return <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50"><div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-slate-500 animate-spin" /></div>;
  }

  const color = datos.negocio.color || '#E8002D';
  const url = `${window.location.origin}/marcar/${clave}/${datos.codigo}`;
  const horaTexto = ahora.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true });
  const fechaTexto = ahora.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col items-center justify-center p-6 select-none">
      <div className="flex items-center gap-3 mb-6">
        {datos.negocio.logo
          ? <img src={datos.negocio.logo} alt="" className="w-14 h-14 rounded-2xl object-cover bg-white border border-slate-200" />
          : <span className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl font-black" style={{ background: color }}>{datos.negocio.nombre.charAt(0)}</span>}
        <div>
          <p className="text-2xl font-black text-slate-900 leading-tight">{datos.negocio.nombre}</p>
          <p className="text-base text-slate-500">{datos.sede}</p>
        </div>
      </div>

      <div className="relative bg-white rounded-[28px] p-6 sm:p-8 border border-slate-200 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <QRCodeSVG value={url} size={320} level="M" marginSize={0} className="w-[min(72vw,52vh)] h-auto" />
        {escaneado && (
          <div className="absolute inset-0 rounded-[28px] bg-white/95 flex flex-col items-center justify-center animate-aparecer">
            <span className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center"><Check className="w-10 h-10 text-white" strokeWidth={3} /></span>
            <p className="mt-4 text-xl font-bold text-slate-900">Escaneado</p>
            <p className="text-slate-500">Ya puede escanear el siguiente</p>
          </div>
        )}
      </div>

      <p className="mt-6 text-xl font-bold text-slate-900 text-center">Escanea con tu celular para marcar entrada o salida</p>
      <p className="mt-4 text-5xl font-black tabular-nums text-slate-900">{horaTexto}</p>
      <p className="mt-1 text-base text-slate-500 capitalize">{fechaTexto}</p>
    </div>
  );
}
