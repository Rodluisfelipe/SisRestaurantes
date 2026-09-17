import { useState, useEffect, useCallback } from 'react';
import superadminApi from '../../services/superadminApi';

const fecha = (valor) =>
  valor ? new Date(valor).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : 'Nunca';

// Pendiente y pausada comparten activo=false; las distingue aprobadoEn.
function estadoDe(cuenta) {
  if (cuenta.activo) return { texto: 'Activa', punto: 'bg-green-400', accion: 'Pausar' };
  if (!cuenta.aprobadoEn) return { texto: 'Pendiente', punto: 'bg-amber-400', accion: 'Aprobar', destacar: true };
  return { texto: 'Pausada', punto: 'bg-slate-300', accion: 'Reactivar' };
}

export default function PanelLiveAccesos() {
  const [cuentas, setCuentas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [email, setEmail] = useState('');
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState('');

  const cargar = useCallback(async () => {
    try {
      const res = await superadminApi.get('/panel-live/accesos');
      setCuentas(res.data.accesos || []);
    } catch (e) {
      setMsg(e.response?.data?.message || 'No se pudieron cargar las cuentas');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const pendientes = cuentas.filter((c) => !c.activo && !c.aprobadoEn).length;

  const agregar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setMsg('');
    try {
      await superadminApi.post('/panel-live/accesos', { email, nota });
      setEmail('');
      setNota('');
      await cargar();
    } catch (err) {
      setMsg(err.response?.data?.message || 'No se pudo dar el acceso');
    } finally {
      setGuardando(false);
    }
  };

  const cambiarActivo = async (cuenta) => {
    setMsg('');
    try {
      await superadminApi.patch(`/panel-live/accesos/${cuenta._id}`, { activo: !cuenta.activo });
      await cargar();
    } catch (err) {
      setMsg(err.response?.data?.message || 'No se pudo cambiar la cuenta');
    }
  };

  const borrar = async (cuenta) => {
    if (!confirm(`¿Borrar la cuenta de ${cuenta.email}? Si está dentro del panel, sale en menos de un minuto y tendrá que registrarse de nuevo.`)) return;
    setMsg('');
    try {
      await superadminApi.delete(`/panel-live/accesos/${cuenta._id}`);
      await cargar();
    } catch (err) {
      setMsg(err.response?.data?.message || 'No se pudo borrar la cuenta');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-1">
        <p className="text-sm font-semibold text-slate-900">
          Cuentas del Panel LIVE
          {pendientes > 0 && (
            <span className="ml-2 px-2 py-0.5 text-[11px] font-semibold text-amber-700 bg-amber-50 rounded-full">
              {pendientes} por aprobar
            </span>
          )}
        </p>
        <p className="text-xs text-slate-500">
          Tus amigos crean su cuenta en el panel con correo y contraseña, y no pueden entrar hasta que la apruebes aquí.
          Si agregas un correo antes, al registrarse entra directo. Si alguien olvida su contraseña, borra su cuenta y
          que se registre otra vez.
        </p>
      </div>

      <form onSubmit={agregar} className="p-5 bg-white border border-slate-200 rounded-xl space-y-3">
        <p className="text-sm font-semibold text-slate-900">Aprobar un correo por adelantado</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@gmail.com"
            aria-label="Correo"
            className="flex-1 min-w-0 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
          <input
            type="text"
            value={nota}
            maxLength={120}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Nota (opcional)"
            aria-label="Nota"
            className="sm:w-44 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
          <button
            type="submit"
            disabled={guardando}
            className="px-4 py-2 text-sm font-semibold text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {guardando ? 'Guardando…' : 'Aprobar'}
          </button>
        </div>
      </form>

      {msg && <div className="text-sm text-center text-red-500 py-1">{msg}</div>}

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {cargando ? (
          <p className="p-5 text-sm text-slate-400">Cargando…</p>
        ) : cuentas.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">Todavía no hay cuentas.</p>
        ) : (
          cuentas.map((cuenta) => {
            const estado = estadoDe(cuenta);
            return (
              <div key={cuenta._id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${estado.punto}`} />
                    <p className="text-sm font-medium text-slate-900 truncate">{cuenta.nombre || cuenta.email}</p>
                    <span className="text-[11px] text-slate-400 shrink-0">{estado.texto}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {cuenta.nombre ? `${cuenta.email} · ` : ''}
                    {cuenta.registrado ? `Último ingreso: ${fecha(cuenta.ultimoIngreso)}` : 'Aún no se registra'}
                    {cuenta.nota ? ` · ${cuenta.nota}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => cambiarActivo(cuenta)}
                    className={estado.destacar
                      ? 'px-3 py-1.5 text-xs font-semibold text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition-colors'
                      : 'text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors'}
                  >
                    {estado.accion}
                  </button>
                  <button
                    onClick={() => borrar(cuenta)}
                    className="text-xs text-red-500 hover:text-red-700 hover:underline transition-colors"
                  >
                    Borrar
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
