import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';

/**
 * Quién trabaja en las cajas y qué puede hacer cada uno.
 *
 * Antes la caja tenía dos roles fijos y no tenía cómo crear más usuarios que
 * el dueño: en la práctica todos entraban con su PIN y la auditoría por cajero
 * no servía de nada. Aquí el dueño define roles a la medida —"cajero de
 * confianza" que devuelve pero no descuenta— y a su gente, una vez, para todas
 * sus cajas. Las cajas lo bajan en su próxima sincronización.
 */
export default function PersonalPos({ businessId }) {
  const [datos, setDatos] = useState(null);
  const [roles, setRoles] = useState([]);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [nuevo, setNuevo] = useState({ nombre: '', pin: '', rol: '' });

  const aplicar = (d) => {
    setDatos(d);
    setRoles(d.roles.map((r) => ({ ...r, permisos: [...r.permisos] })));
    setNuevo((n) => ({ ...n, rol: n.rol || d.roles[0]?.id || '' }));
  };

  const cargar = useCallback(async () => {
    if (!businessId) return;
    try {
      aplicar((await api.get(`/pos-panel/personal?businessId=${businessId}`)).data);
    } catch (e) {
      setError(e.response?.data?.message || 'No se pudo cargar el personal');
    }
  }, [businessId]);

  useEffect(() => { cargar(); }, [cargar]);

  const avisar = (texto) => {
    setAviso(texto);
    setError('');
    window.setTimeout(() => setAviso(''), 4000);
  };

  const llamar = async (promesa, ok) => {
    try {
      aplicar((await promesa).data);
      avisar(ok);
    } catch (e) {
      setError(e.response?.data?.message || 'No se pudo guardar');
      setAviso('');
    }
  };

  if (!datos) return <p className="p-4 text-[13px] text-slate-400">{error || 'Cargando…'}</p>;

  const cambiosEnRoles = JSON.stringify(roles) !== JSON.stringify(datos.roles);
  const nombreRol = (id) => datos.roles.find((r) => r.id === id)?.nombre || id;

  const alternar = (i, clave) => setRoles(roles.map((r, j) => (j !== i ? r : {
    ...r,
    permisos: r.permisos.includes(clave) ? r.permisos.filter((p) => p !== clave) : [...r.permisos, clave],
  })));

  return (
    <div className="space-y-4">
      {aviso && <p className="text-[13px] font-semibold text-emerald-700">{aviso}</p>}
      {error && <p className="text-[13px] font-semibold text-red-600">{error}</p>}

      {/* Personas */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <p className="text-[14px] font-black text-slate-800">Personas</p>
          <p className="text-[12px] text-slate-500">
            Cada quien entra a la caja con su PIN. Así cada venta, descuento y cierre queda a su nombre.
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {datos.usuarios.length === 0 && (
            <div className="p-5 text-center space-y-1">
              <p className="text-[13px] text-slate-500">
                Todavía no hay personas. Mientras no crees ninguna, las cajas siguen con el usuario que se creó en cada una.
              </p>
              {/* Lo que más sorprende: al crear la primera persona, el PIN
                  local del dueño deja de servir en todas las cajas. */}
              <p className="text-[12.5px] font-semibold text-amber-700">
                Agrégate tú primero, con el rol Dueño: desde la primera persona que crees, las cajas solo aceptan a las de esta lista.
              </p>
            </div>
          )}
          {datos.usuarios.map((u) => (
            <div key={u._id} className={`flex flex-wrap items-center gap-3 p-3.5 ${u.activo ? '' : 'opacity-50'}`}>
              <p className="flex-1 min-w-[140px] text-[13.5px] font-bold text-slate-800">{u.nombre}</p>
              <select
                value={u.rol}
                onChange={(e) => llamar(api.patch(`/pos-panel/personal/usuarios/${u._id}?businessId=${businessId}`, { rol: e.target.value }), `${u.nombre} ahora es ${nombreRol(e.target.value)}`)}
                className="h-9 px-2 rounded-lg border border-slate-200 text-[12.5px]"
              >
                {datos.roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
              <button
                onClick={() => {
                  const pin = window.prompt(`Nuevo PIN para ${u.nombre} (4 a 6 números)`);
                  if (pin) llamar(api.patch(`/pos-panel/personal/usuarios/${u._id}?businessId=${businessId}`, { pin }), 'PIN cambiado');
                }}
                className="h-9 px-3 rounded-lg text-[12px] font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cambiar PIN
              </button>
              <button
                onClick={() => llamar(api.patch(`/pos-panel/personal/usuarios/${u._id}?businessId=${businessId}`, { activo: !u.activo }), u.activo ? `${u.nombre} ya no puede entrar` : `${u.nombre} puede volver a entrar`)}
                className={`h-9 px-3 rounded-lg text-[12px] font-semibold ${u.activo ? 'text-slate-400 hover:text-red-600 hover:bg-red-50' : 'text-emerald-700 hover:bg-emerald-50'}`}
              >
                {u.activo ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 p-3.5 bg-slate-50 border-t border-slate-100">
          <input
            value={nuevo.nombre}
            onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
            placeholder="Nombre"
            className="h-10 px-3 rounded-lg border border-slate-200 text-[13px] flex-1 min-w-[140px]"
          />
          <input
            value={nuevo.pin}
            onChange={(e) => setNuevo({ ...nuevo, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
            placeholder="PIN (4 a 6)"
            inputMode="numeric"
            className="h-10 px-3 rounded-lg border border-slate-200 text-[13px] w-32 tabular-nums"
          />
          <select
            value={nuevo.rol}
            onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value })}
            className="h-10 px-2 rounded-lg border border-slate-200 text-[13px]"
          >
            {datos.roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
          <button
            disabled={!nuevo.nombre.trim() || nuevo.pin.length < 4}
            onClick={async () => {
              await llamar(api.post(`/pos-panel/personal/usuarios?businessId=${businessId}`, nuevo), `${nuevo.nombre} agregado`);
              setNuevo({ nombre: '', pin: '', rol: nuevo.rol });
            }}
            className="h-10 px-4 rounded-lg bg-slate-900 text-white text-[13px] font-bold disabled:opacity-30"
          >
            Agregar
          </button>
        </div>
      </div>

      {/* Roles y permisos */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 p-4 border-b border-slate-100">
          <div className="flex-1 min-w-[200px]">
            <p className="text-[14px] font-black text-slate-800">Roles y permisos</p>
            <p className="text-[12px] text-slate-500">
              Si alguien no tiene un permiso, la caja le pide el PIN de alguien que sí lo tenga.
            </p>
          </div>
          <button
            onClick={() => {
              const nombre = window.prompt('Nombre del rol nuevo (ej. Cajero de confianza)');
              if (nombre?.trim()) setRoles([...roles, { id: '', nombre: nombre.trim(), permisos: ['cobrar', 'turno'] }]);
            }}
            className="h-9 px-3 rounded-lg border border-slate-200 text-[12.5px] font-semibold text-slate-700"
          >
            + Rol
          </button>
          <button
            disabled={!cambiosEnRoles}
            onClick={() => llamar(api.put(`/pos-panel/personal/roles?businessId=${businessId}`, { roles }), 'Roles guardados')}
            className="h-9 px-4 rounded-lg bg-slate-900 text-white text-[12.5px] font-bold disabled:opacity-30"
          >
            Guardar roles
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left font-semibold text-slate-500 p-2.5">Permiso</th>
                {roles.map((r, i) => (
                  <th key={r.id || `nuevo-${i}`} className="p-2.5 font-bold text-slate-800 whitespace-nowrap">
                    {r.nombre}
                    {!datos.usuarios.some((u) => u.rol === r.id && u.activo) && (
                      <button
                        onClick={() => setRoles(roles.filter((_, j) => j !== i))}
                        title="Quitar este rol"
                        className="ml-1.5 text-slate-300 hover:text-red-600"
                      >
                        ×
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datos.permisos.map((p) => (
                <tr key={p.clave} className="border-t border-slate-100">
                  <td className="p-2.5 text-slate-700">{p.nombre}</td>
                  {roles.map((r, i) => (
                    <td key={r.id || `nuevo-${i}`} className="p-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={r.permisos.includes(p.clave)}
                        onChange={() => alternar(i, p.clave)}
                        className="w-4 h-4"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
