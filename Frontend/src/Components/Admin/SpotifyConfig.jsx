import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { FaSpotify, FaSpinner, FaCopy, FaExternalLinkAlt, FaCheckCircle, FaChevronDown } from 'react-icons/fa';
import api from '../../services/api';

/**
 * Conectar Spotify para mostrar en el menú qué suena en el local.
 *
 * Cada negocio trae su propia app de Spotify. Eso le ahorra a MenuBy depender
 * de que Spotify apruebe una cuota extendida, pero le pasa la fricción al
 * dueño: tiene que crear la app él mismo. Por eso esta pantalla es, sobre
 * todo, un instructivo — si las indicaciones no son claras, la función no la
 * usa nadie.
 */
export default function SpotifyConfig({ businessId }) {
  const [cuenta, setCuenta] = useState(null);
  const [urlRedireccion, setUrlRedireccion] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({ clientId: '', clientSecret: '' });

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await api.get(`/spotify/cuenta?businessId=${businessId}`);
      setCuenta(data.cuenta);
      setUrlRedireccion(data.urlDeRedireccion || '');
      if (data.cuenta?.clientId) setForm(f => ({ ...f, clientId: data.cuenta.clientId }));
    } catch {
      // Silencioso: si no carga, la sección simplemente se muestra vacía.
    } finally {
      setCargando(false);
    }
  }, [businessId]);

  useEffect(() => { cargar(); }, [cargar]);

  const guardarCredenciales = async () => {
    if (!form.clientId.trim() || !form.clientSecret.trim()) {
      toast.error('Pega el Client ID y el Client Secret de tu app');
      return;
    }
    setGuardando(true);
    try {
      const { data } = await api.put('/spotify/credenciales', {
        businessId, clientId: form.clientId.trim(), clientSecret: form.clientSecret.trim(),
      });
      setCuenta(data.cuenta);
      setForm(f => ({ ...f, clientSecret: '' }));
      toast.success('Credenciales guardadas. Ahora conecta tu cuenta.');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudieron guardar las credenciales.');
    } finally {
      setGuardando(false);
    }
  };

  const conectar = async () => {
    try {
      const { data } = await api.get(`/spotify/conectar?businessId=${businessId}`);
      window.location.href = data.url;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudo abrir la autorización de Spotify.');
    }
  };

  const desconectar = async () => {
    if (!confirm('¿Desconectar Spotify? El banner dejará de aparecer en el menú.')) return;
    try {
      await api.delete(`/spotify/cuenta?businessId=${businessId}`);
      setCuenta(null);
      setForm({ clientId: '', clientSecret: '' });
      toast.success('Spotify desconectado');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudo desconectar.');
    }
  };

  const alternarBanner = async () => {
    try {
      const { data } = await api.patch('/spotify/activo', { businessId, activo: !cuenta.activo });
      setCuenta(data.cuenta);
      toast.success(data.cuenta.activo ? 'Banner encendido' : 'Banner apagado');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudo actualizar.');
    }
  };

  const copiar = async (texto) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success('Copiado');
    } catch {
      toast.error('No se pudo copiar. Selecciónalo a mano.');
    }
  };

  if (cargando) {
    return <div className="py-3 text-center"><FaSpinner className="animate-spin text-slate-300 mx-auto text-sm" /></div>;
  }

  const conectado = cuenta?.conectado;

  return (
    <div className="mt-3 rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setAbierto(!abierto)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <FaSpotify className={conectado ? 'text-[#1DB954]' : 'text-slate-400'} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-700">Música del local</p>
          <p className="text-[11px] text-slate-400 truncate">
            {conectado
              ? `${cuenta.displayName || 'Conectado'} · banner ${cuenta.activo ? 'encendido' : 'apagado'}`
              : 'Muestra en el menú qué canción está sonando'}
          </p>
        </div>
        <FaChevronDown className={`text-slate-300 text-xs transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <div className="p-3 space-y-3 bg-white">
          {conectado ? (
            <>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
                <FaCheckCircle className="text-emerald-500 text-sm flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-emerald-800 truncate">
                    {cuenta.displayName || 'Cuenta conectada'}
                  </p>
                  <p className="text-[11px] text-emerald-600">
                    El banner aparece solo cuando hay música sonando
                  </p>
                </div>
              </div>

              {cuenta.status === 'error' && cuenta.lastError && (
                <p className="text-[11px] text-red-600 bg-red-50 rounded-lg p-2">{cuenta.lastError}</p>
              )}

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200">
                <span className="text-xs text-slate-600">Mostrar el banner</span>
                <button
                  onClick={alternarBanner}
                  className={`w-10 h-6 rounded-full p-0.5 transition-colors ${cuenta.activo ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${cuenta.activo ? 'translate-x-4' : ''}`} />
                </button>
              </div>

              <button onClick={desconectar} className="text-[11px] text-red-500 hover:text-red-600 font-medium">
                Desconectar Spotify
              </button>
            </>
          ) : (
            <>
              <ol className="text-[11px] text-slate-600 space-y-2 list-decimal list-inside">
                <li>
                  Entra a{' '}
                  <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer"
                     className="text-blue-600 font-medium inline-flex items-center gap-1">
                    developer.spotify.com <FaExternalLinkAlt className="text-[8px]" />
                  </a>{' '}
                  con la cuenta de Spotify del local y crea una app.
                </li>
                <li>
                  En <strong>Redirect URI</strong> pega exactamente esto:
                  <div className="flex items-center gap-1 mt-1">
                    <code className="flex-1 text-[10px] bg-slate-100 rounded px-2 py-1.5 break-all">{urlRedireccion}</code>
                    <button onClick={() => copiar(urlRedireccion)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 flex-shrink-0">
                      <FaCopy className="text-[10px]" />
                    </button>
                  </div>
                </li>
                <li>Copia el <strong>Client ID</strong> y el <strong>Client Secret</strong> y pégalos acá abajo.</li>
              </ol>

              <input
                type="text"
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                placeholder="Client ID"
                className="w-full rounded-lg border border-slate-200 text-xs px-2.5 py-2 font-mono"
              />
              <input
                type="password"
                value={form.clientSecret}
                onChange={(e) => setForm({ ...form, clientSecret: e.target.value })}
                placeholder={cuenta?.clientSecretPista ? `Client Secret (guardado: ${cuenta.clientSecretPista})` : 'Client Secret'}
                className="w-full rounded-lg border border-slate-200 text-xs px-2.5 py-2 font-mono"
              />

              <button
                onClick={guardarCredenciales}
                disabled={guardando}
                className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white text-xs font-semibold flex items-center justify-center gap-2"
              >
                {guardando && <FaSpinner className="animate-spin text-[10px]" />}
                Guardar credenciales
              </button>

              {cuenta?.clientId && (
                <button
                  onClick={conectar}
                  className="w-full py-2.5 rounded-lg bg-[#1DB954] hover:bg-[#1aa34a] text-white text-xs font-bold flex items-center justify-center gap-2"
                >
                  <FaSpotify /> Conectar mi cuenta de Spotify
                </button>
              )}

              <p className="text-[10px] text-slate-400 leading-relaxed">
                El banner muestra lo que suene en <strong>esa</strong> cuenta de Spotify. Si en el local
                ponen música desde otra cuenta o desde otro servicio, no aparecerá nada.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
