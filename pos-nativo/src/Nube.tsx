import { useEffect, useState } from 'react';
import { conectada, desconectarNube, emparejar, probarNube, sincronizar, urlNube } from './nativo';

/**
 * Conectar esta caja con MenuBy.
 *
 * Se hace **una vez**, al instalar, y el flujo está pensado para que lo haga
 * un técnico por control remoto en cinco minutos:
 *
 *   panel de MenuBy → copiar la sesión → pegarla aquí → listo
 *
 * La sesión del panel vence en 24 horas y por eso no se guarda: se cambia por
 * el token de la caja, que dura 90 días y vive en el llavero del sistema
 * operativo. Si se guardara la del panel, la caja dejaría de sincronizar al día
 * siguiente, en mitad del servicio y sin que nadie entienda por qué.
 */
export default function Nube({ onCerrar }: { onCerrar: () => void }) {
  const [url, setUrl] = useState('https://api.menuby.tech/api');
  const [token, setToken] = useState('');
  const [caja, setCaja] = useState('caja-1');
  const [yaConectada, setYaConectada] = useState(false);
  const [negocio, setNegocio] = useState('');
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    conectada().then(setYaConectada).catch(() => {});
    urlNube().then((u) => u && setUrl(u)).catch(() => {});
  }, []);

  const conectar = async () => {
    setOcupado(true);
    setError('');
    setAviso('');
    try {
      const r = await emparejar(url, token, caja);
      setNegocio(r.negocio);
      setYaConectada(true);
      // La sesión del panel no se queda ni en pantalla.
      setToken('');
      setAviso(`Conectada a ${r.negocio || 'tu negocio'}. El token de esta caja dura ${r.vence_en_dias} días.`);
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ''));
    } finally {
      setOcupado(false);
    }
  };

  const probar = async () => {
    setOcupado(true);
    setError('');
    setAviso('');
    try {
      await probarNube();
      setAviso('La caja habla con MenuBy sin problema.');
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ''));
    } finally {
      setOcupado(false);
    }
  };

  const bajarTodo = async () => {
    setOcupado(true);
    setError('');
    setAviso('');
    try {
      const r = await sincronizar();
      setError(r.error ?? '');
      setAviso(`Subieron ${r.enviadas} venta(s) y bajaron ${r.catalogo} producto(s).`);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 bg-black/50 flex items-center justify-center" onClick={onCerrar}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[520px] max-h-[85vh] overflow-y-auto bg-white rounded-2xl p-5 space-y-4"
      >
        <div>
          <p className="text-[15px] font-black">Conexión con MenuBy</p>
          <p className="text-[12px] text-slate-400 mt-0.5">
            {yaConectada
              ? `Esta caja ya está conectada${negocio ? ` a ${negocio}` : ''}.`
              : 'Esta caja todavía no está conectada. Vende y guarda igual, pero nada sube.'}
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Servidor de MenuBy
          </label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full h-11 px-3 rounded-xl border-2 border-slate-200 text-[13px] outline-none focus:border-slate-900"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Nombre de esta caja
          </label>
          <input
            value={caja}
            onChange={(e) => setCaja(e.target.value)}
            placeholder="caja-1"
            className="w-full h-11 px-3 rounded-xl border-2 border-slate-200 text-[13px] outline-none focus:border-slate-900"
          />
          <p className="text-[11px] text-slate-400">
            Para distinguirla el día que el negocio tenga dos.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Sesión del panel
          </label>
          <textarea
            value={token}
            onChange={(e) => setToken(e.target.value.trim())}
            rows={3}
            placeholder="eyJhbGciOi…"
            className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 text-[11px] font-mono outline-none focus:border-slate-900"
          />
          {/* Las instrucciones exactas, porque esto lo va a hacer alguien que
              nunca ha abierto las herramientas del navegador. */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-[11.5px] text-slate-600 space-y-1">
            <p className="font-bold text-slate-700">Cómo obtenerla</p>
            <p>1. Entra al panel de MenuBy en este mismo equipo.</p>
            <p>2. Presiona <b>F12</b> → pestaña <b>Application</b> (o Almacenamiento).</p>
            <p>3. <b>Local Storage</b> → tu dominio → copia el valor de <b>accessToken</b>.</p>
            <p className="text-slate-400 pt-1">
              Se usa una sola vez y no se guarda: sirve para pedir el token largo de la caja.
            </p>
          </div>
        </div>

        {aviso && <p className="text-[12.5px] font-semibold text-emerald-600">{aviso}</p>}
        {error && <p className="text-[12.5px] font-semibold text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={conectar}
            disabled={ocupado || token.length < 20}
            className="flex-1 h-12 rounded-xl bg-slate-900 text-white text-[13px] font-bold disabled:opacity-30"
          >
            {ocupado ? 'Conectando…' : yaConectada ? 'Volver a conectar' : 'Conectar'}
          </button>
          {yaConectada && (
            <>
              <button
                onClick={probar}
                disabled={ocupado}
                className="h-12 px-4 rounded-xl border-2 border-slate-200 text-[13px] font-bold text-slate-600"
              >
                Probar
              </button>
              <button
                onClick={bajarTodo}
                disabled={ocupado}
                className="h-12 px-4 rounded-xl border-2 border-slate-200 text-[13px] font-bold text-slate-600"
              >
                Sincronizar
              </button>
            </>
          )}
        </div>

        {yaConectada && (
          <button
            onClick={async () => {
              await desconectarNube();
              setYaConectada(false);
              setAviso('Caja desconectada. Las ventas siguen guardadas aquí.');
            }}
            className="w-full h-10 text-[12px] font-semibold text-slate-400 hover:text-red-600"
          >
            Desconectar esta caja
          </button>
        )}

        <button onClick={onCerrar} className="w-full h-10 text-[12.5px] font-semibold text-slate-500">
          Cerrar
        </button>
      </div>
    </div>
  );
}
