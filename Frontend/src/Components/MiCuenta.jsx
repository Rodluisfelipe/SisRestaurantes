import React, { useCallback, useEffect, useState } from 'react';
import { Heart, MapPin, Star, RotateCcw, ChevronRight, Pencil, Trash2, Plus, Receipt, Wallet, CreditCard, ShieldCheck, Clock } from 'lucide-react';
import MenuScreen from './MenuScreen';
import { Boton, Insignia, formatearPesos } from './ui';
import api from '../services/api';
import { toast } from 'sonner';
import { tieneCuenta, olvidarLlave, esSinCuenta, negocioDeLaCuenta } from '../utils/cuentaCliente';
import { getEffectivePrice } from '../utils/promo';

/**
 * "Mi cuenta" del cliente en el menú.
 *
 * Antes mostraba nombre, teléfono y una dirección. Ahora es lo que el cliente
 * viene a buscar: volver a pedir lo de siempre con un toque, sus favoritos,
 * sus puntos, sus direcciones y sus datos para la factura.
 *
 * Todo pasa por la llave del celular (ver utils/cuentaCliente): sin ella, la
 * pantalla explica que la cuenta se activa con el primer pedido.
 */

const ESTADO = {
  pending: 'Recibido',
  pending_payment: 'Esperando pago',
  payment_uploaded: 'Revisando tu pago',
  payment_confirmed: 'Pago confirmado',
  confirmed: 'Confirmado',
  preparing: 'En preparación',
  inProgress: 'En preparación',
  ready: 'Listo',
  delivered: 'Entregado',
  completed: 'Entregado',
  cancelled: 'Cancelado',
};

const fecha = (f) => {
  if (!f) return '';
  try {
    return new Date(f).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  } catch { return ''; }
};

/**
 * Convierte un pedido anterior en ítems del carrito con los productos de hoy:
 * precio actual, y fuera lo que ya no está o se agotó. Las variantes (talla,
 * color) se buscan por sus valores.
 */
export function rearmarPedido(pedido, productos) {
  const porId = new Map((productos || []).map((p) => [String(p._id), p]));
  const items = [];
  let faltan = 0;
  for (const it of pedido.items || []) {
    const p = it.productId && porId.get(String(it.productId));
    const agotado = p && p.trackStock && typeof p.stock === 'number' && p.stock <= 0;
    if (!p || p.available === false || agotado) { faltan += 1; continue; }
    let extra = {};
    if (it.variante?.valores?.length) {
      const v = (p.variantes || []).find((x) => JSON.stringify(x.valores) === JSON.stringify(it.variante.valores));
      if (!v || v.activo === false || (p.trackStock && Number(v.stock) <= 0)) { faltan += 1; continue; }
      extra = {
        price: Number(v.precio ?? p.price),
        name: `${p.name} (${it.variante.valores.join(' · ')})`,
        variante: it.variante,
      };
    }
    items.push({
      ...p,
      price: getEffectivePrice(p),
      ...extra,
      selectedToppings: it.selectedToppings || [],
      selectedOptions: it.selectedOptions || {},
      notes: it.notas || '',
      quantity: Number(it.cantidad) || 1,
    });
  }
  return { items, faltan };
}

export default function MiCuenta({
  open,
  onClose,
  productos,
  onAgregar,
  onAbrirCarrito,
  onVerFavoritos,
  onVerPuntos,
  nombreGuardado = '',
}) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [sinCuenta, setSinCuenta] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const cargar = useCallback(async () => {
    if (!tieneCuenta()) { setSinCuenta(true); setDatos(null); return; }
    setCargando(true);
    setError('');
    try {
      const { data } = await api.get('/cuenta');
      setDatos(data);
      setSinCuenta(false);
    } catch (e) {
      if (esSinCuenta(e)) { olvidarLlave(); setSinCuenta(true); }
      else setError('No pudimos cargar tu cuenta. Revisa tu conexión.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { if (open) cargar(); }, [open, cargar]);

  // Un aviso corto que se va solo ("Agregamos 3 productos a tu carrito").
  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(() => setAviso(''), 3500);
    return () => clearTimeout(t);
  }, [aviso]);

  const pedirDeNuevo = (pedido) => {
    const { items, faltan } = rearmarPedido(pedido, productos);
    if (!items.length) { setAviso('Lo de ese pedido ya no está disponible hoy.'); return; }
    items.forEach((i) => onAgregar?.(i));
    // Se abre el carrito y esta pantalla se cierra: el aviso va en un toast.
    const texto = faltan
      ? `Agregamos ${items.length} al carrito. ${faltan} ya no ${faltan === 1 ? 'está disponible' : 'están disponibles'}.`
      : `Agregamos ${items.length === 1 ? 'tu pedido' : `${items.length} productos`} al carrito.`;
    if (onAbrirCarrito) { toast.success(texto); onAbrirCarrito(); } else setAviso(texto);
  };

  const perfil = datos?.perfil;
  const nombre = perfil?.nombre || nombreGuardado || '';

  return (
    <MenuScreen open={open} onClose={onClose} title="Mi cuenta" subtitle={perfil?.telefono || undefined}>
      <div className="px-4 py-4 space-y-5 pb-10">
        {aviso && (
          <div role="status" className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-semibold text-emerald-800">
            {aviso}
          </div>
        )}

        {sinCuenta ? (
          <SinCuenta nombre={nombre} onClose={onClose} />
        ) : cargando && !datos ? (
          <Cargando />
        ) : error ? (
          <div className="text-center py-10">
            <p className="text-sm text-tinta-2">{error}</p>
            <Boton variante="secundario" className="mt-4" onClick={cargar}>Reintentar</Boton>
          </div>
        ) : datos ? (
          <>
            <Encabezado perfil={perfil} nombre={nombre} puntos={datos.puntos} onVerPuntos={onVerPuntos} />

            {datos.pedidos.activos.length > 0 && (
              <Seccion titulo="Tu pedido en curso">
                {datos.pedidos.activos.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-linea bg-superficie-tarjeta p-4 flex items-center gap-3">
                    <span className="w-10 h-10 rounded-full bg-marca-suave text-marca flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-tinta">Pedido #{p.numero}</p>
                      <p className="text-xs text-tinta-2">{ESTADO[p.estado] || 'En curso'} · {formatearPesos(p.total)}</p>
                    </div>
                  </div>
                ))}
              </Seccion>
            )}

            <Seccion titulo="Pedir de nuevo" icono={<RotateCcw className="w-4 h-4" />}>
              {datos.pedidos.anteriores.length === 0 ? (
                <Vacio texto="Cuando tengas pedidos entregados, aquí los repites con un toque." />
              ) : (
                <div className="space-y-2">
                  {datos.pedidos.anteriores.slice(0, 6).map((p) => (
                    <div key={p.id} className="rounded-2xl border border-linea bg-superficie-tarjeta p-3.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-xs font-bold text-tinta-3 uppercase tracking-wide">{fecha(p.fecha)} · #{p.numero}</p>
                        <p className="text-sm font-black text-tinta tabular-nums">{formatearPesos(p.total)}</p>
                      </div>
                      <p className="mt-1 text-sm text-tinta-2 line-clamp-2">
                        {p.items.map((i) => `${i.cantidad}× ${i.nombre}`).join(', ')}
                      </p>
                      {p.estado !== 'cancelled' && (
                        <Boton
                          variante="secundario"
                          tamano="sm"
                          className="mt-3 h-10 w-full"
                          icono={<RotateCcw className="w-4 h-4" />}
                          onClick={() => pedirDeNuevo(p)}
                        >
                          Pedir de nuevo
                        </Boton>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Seccion>

            <Seccion titulo="Mis favoritos" icono={<Heart className="w-4 h-4" />}>
              <Fila
                titulo={datos.favoritos ? `${datos.favoritos} guardado${datos.favoritos === 1 ? '' : 's'}` : 'Aún no tienes favoritos'}
                detalle={datos.favoritos ? 'Agrégalos al carrito desde aquí' : 'Toca el corazón en cualquier producto para guardarlo'}
                onClick={datos.favoritos ? onVerFavoritos : undefined}
              />
            </Seccion>

            <Direcciones direcciones={perfil.direcciones} onCambio={(direcciones) => setDatos((d) => ({ ...d, perfil: { ...d.perfil, direcciones } }))} />

            <MisDatos perfil={perfil} onGuardado={(p) => setDatos((d) => ({ ...d, perfil: p }))} />

            <BorrarDatos
              onBorrado={() => { olvidarLlave(); setDatos(null); setSinCuenta(true); onClose?.(); }}
            />
          </>
        ) : null}
      </div>
    </MenuScreen>
  );
}

/* ── Piezas ─────────────────────────────────────────────────────────────── */

function Seccion({ titulo, icono, accion, children }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-tinta-2">
          {icono}{titulo}
        </h3>
        {accion}
      </div>
      {children}
    </section>
  );
}

function Fila({ titulo, detalle, onClick, icono }) {
  const Etiqueta = onClick ? 'button' : 'div';
  return (
    <Etiqueta
      {...(onClick ? { type: 'button', onClick } : {})}
      className="w-full text-left rounded-2xl border border-linea bg-superficie-tarjeta p-4 flex items-center gap-3 active:scale-[0.99] transition-transform"
    >
      {icono}
      <div className="min-w-0 flex-1">
        <p className="font-bold text-tinta">{titulo}</p>
        {detalle && <p className="text-xs text-tinta-2 mt-0.5">{detalle}</p>}
      </div>
      {onClick && <ChevronRight className="w-5 h-5 text-tinta-3 shrink-0" />}
    </Etiqueta>
  );
}

function Vacio({ texto }) {
  return <p className="rounded-2xl border border-dashed border-linea px-4 py-5 text-sm text-tinta-2 text-center">{texto}</p>;
}

function Cargando() {
  return (
    <div className="space-y-3" aria-busy="true">
      {[80, 120, 64, 64].map((h, i) => (
        <div key={i} className="rounded-2xl bg-superficie-2 animate-pulse" style={{ height: h }} />
      ))}
    </div>
  );
}

function SinCuenta({ nombre, onClose }) {
  return (
    <div className="text-center py-8 px-2">
      <span className="mx-auto w-16 h-16 rounded-full bg-marca-suave text-marca flex items-center justify-center">
        <Receipt className="w-7 h-7" />
      </span>
      <h3 className="mt-4 text-xl font-black text-tinta">{nombre ? `Hola, ${nombre.split(' ')[0]}` : 'Tu cuenta'}</h3>
      <p className="mt-2 text-sm text-tinta-2 leading-relaxed">
        Tu cuenta se activa en este celular con tu primer pedido. Desde ahí verás aquí tus pedidos para repetirlos con un toque,
        tus favoritos, tus puntos y tus direcciones.
      </p>
      <p className="mt-3 text-xs text-tinta-3 flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-4 h-4" /> Nadie más puede verla, aunque sepa tu número.
      </p>
      <Boton className="mt-6" onClick={onClose}>Ver el menú</Boton>
    </div>
  );
}

function Encabezado({ perfil, nombre, puntos, onVerPuntos }) {
  const inicial = (nombre || '?').trim().charAt(0).toUpperCase();
  const siguiente = puntos?.recompensas
    ?.filter((r) => r.puntos > puntos.puntos)
    .sort((a, b) => a.puntos - b.puntos)[0];
  const canjeables = puntos?.recompensas?.filter((r) => r.puntos <= puntos.puntos).length || 0;
  return (
    <div className="rounded-3xl border border-linea bg-superficie-tarjeta p-4">
      <div className="flex items-center gap-3">
        <span className="w-14 h-14 rounded-full bg-marca text-sobre-marca flex items-center justify-center text-xl font-black shrink-0">{inicial}</span>
        <div className="min-w-0">
          <p className="text-lg font-black text-tinta truncate">{nombre || 'Sin nombre'}</p>
          <p className="text-sm text-tinta-2">{perfil.telefono}</p>
        </div>
      </div>

      {(puntos || perfil.saldoFavor > 0 || perfil.credito) && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {puntos && (
            <button
              type="button"
              onClick={onVerPuntos}
              className="col-span-2 text-left rounded-2xl bg-marca-suave p-3.5 active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-tinta-2"><Star className="w-4 h-4 text-marca" /> Mis puntos</p>
                {canjeables > 0 && <Insignia tono="marca">{canjeables} para canjear</Insignia>}
              </div>
              <p className="mt-1 text-2xl font-black text-tinta tabular-nums">{puntos.puntos.toLocaleString('es-CO')}</p>
              {siguiente && (
                <>
                  <div className="mt-2 h-2 rounded-full bg-white/70 overflow-hidden">
                    <div className="h-full rounded-full bg-marca" style={{ width: `${Math.min(100, (puntos.puntos / siguiente.puntos) * 100)}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-tinta-2">
                    Te faltan {(siguiente.puntos - puntos.puntos).toLocaleString('es-CO')} para <b>{siguiente.nombre}</b>
                  </p>
                </>
              )}
            </button>
          )}
          {perfil.saldoFavor > 0 && (
            <Dato icono={<Wallet className="w-4 h-4" />} etiqueta="Saldo a favor" valor={formatearPesos(perfil.saldoFavor)} />
          )}
          {perfil.credito && (
            <Dato
              icono={<CreditCard className="w-4 h-4" />}
              etiqueta="Crédito disponible"
              valor={formatearPesos(Math.max(0, perfil.credito.cupo - perfil.credito.saldo))}
              nota={perfil.credito.saldo > 0 ? `Debes ${formatearPesos(perfil.credito.saldo)}` : null}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Dato({ icono, etiqueta, valor, nota }) {
  return (
    <div className="rounded-2xl bg-superficie-2 p-3">
      <p className="flex items-center gap-1.5 text-xs font-bold text-tinta-2">{icono}{etiqueta}</p>
      <p className="mt-1 text-lg font-black text-tinta tabular-nums">{valor}</p>
      {nota && <p className="text-xs text-aviso font-semibold">{nota}</p>}
    </div>
  );
}

/* ── Direcciones ────────────────────────────────────────────────────────── */

const ETIQUETAS = ['Casa', 'Oficina', 'Otra'];

function Direcciones({ direcciones, onCambio }) {
  const [editando, setEditando] = useState(null); // null | 'nueva' | id
  const [forma, setForma] = useState({ etiqueta: 'Casa', texto: '', referencia: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const abrir = (d) => {
    setError('');
    if (d) { setEditando(d.id); setForma({ etiqueta: d.etiqueta, texto: d.texto, referencia: d.referencia }); }
    else { setEditando('nueva'); setForma({ etiqueta: direcciones.length ? 'Oficina' : 'Casa', texto: '', referencia: '' }); }
  };

  const guardar = async () => {
    setGuardando(true);
    setError('');
    try {
      const { data } = editando === 'nueva'
        ? await api.post('/cuenta/direcciones', forma)
        : await api.put(`/cuenta/direcciones/${editando}`, forma);
      onCambio(data.direcciones);
      setEditando(null);
    } catch (e) {
      setError(e.response?.data?.message || 'No se pudo guardar la dirección');
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (d) => {
    if (!window.confirm(`¿Borrar la dirección "${d.etiqueta}"?`)) return;
    try {
      const { data } = await api.delete(`/cuenta/direcciones/${d.id}`);
      onCambio(data.direcciones);
    } catch (e) {
      setError(e.response?.data?.message || 'No se pudo borrar la dirección');
    }
  };

  const hacerPrincipal = async (d) => {
    try {
      const { data } = await api.put(`/cuenta/direcciones/${d.id}`, { principal: true });
      onCambio(data.direcciones);
    } catch { /* se queda como estaba */ }
  };

  return (
    <Seccion
      titulo="Mis direcciones"
      icono={<MapPin className="w-4 h-4" />}
      accion={!editando && direcciones.length < 8 && (
        <button type="button" onClick={() => abrir(null)} className="flex items-center gap-1 text-sm font-bold text-marca-fuerte h-9 px-2">
          <Plus className="w-4 h-4" /> Agregar
        </button>
      )}
    >
      <div className="space-y-2">
        {direcciones.length === 0 && !editando && <Vacio texto="Guarda tu casa u oficina y elígela al pedir a domicilio." />}
        {direcciones.map((d) => (editando === d.id ? null : (
          <div key={d.id} className="rounded-2xl border border-linea bg-superficie-tarjeta p-3.5 flex items-start gap-3">
            <MapPin className="w-5 h-5 text-tinta-3 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-bold text-tinta">
                {d.etiqueta}
                {d.principal && <Insignia tono="suave">Principal</Insignia>}
              </p>
              <p className="text-sm text-tinta-2 break-words">{d.texto}</p>
              {d.referencia && <p className="text-xs text-tinta-3 mt-0.5">{d.referencia}</p>}
              {!d.principal && (
                <button type="button" onClick={() => hacerPrincipal(d)} className="mt-1.5 text-xs font-bold text-marca-fuerte">
                  Usar como principal
                </button>
              )}
            </div>
            <div className="flex shrink-0">
              <button type="button" onClick={() => abrir(d)} className="w-10 h-10 rounded-full flex items-center justify-center text-tinta-2 hover:bg-superficie-2" aria-label={`Editar ${d.etiqueta}`}>
                <Pencil className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => borrar(d)} className="w-10 h-10 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50" aria-label={`Borrar ${d.etiqueta}`}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )))}

        {editando && (
          <div className="rounded-2xl border-2 border-marca bg-superficie-tarjeta p-4 space-y-3">
            <div className="flex gap-2">
              {ETIQUETAS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setForma((f) => ({ ...f, etiqueta: e }))}
                  className={`h-9 px-4 rounded-full text-sm font-bold border-2 ${forma.etiqueta === e ? 'border-marca bg-marca-suave text-tinta' : 'border-linea text-tinta-2'}`}
                >
                  {e}
                </button>
              ))}
            </div>
            <Campo etiqueta="Dirección" valor={forma.texto} onCambio={(v) => setForma((f) => ({ ...f, texto: v }))} placeholder="Calle 10 # 5-20, apto 301" autoFocus />
            <Campo etiqueta="Indicaciones (opcional)" valor={forma.referencia} onCambio={(v) => setForma((f) => ({ ...f, referencia: v }))} placeholder="Torre 2, portería, casa esquinera…" />
            {error && <p className="text-sm font-semibold text-peligro">{error}</p>}
            <div className="flex gap-2">
              <Boton variante="fantasma" className="flex-1" onClick={() => setEditando(null)}>Cancelar</Boton>
              <Boton className="flex-1" cargando={guardando} disabled={forma.texto.trim().length < 5} onClick={guardar}>Guardar</Boton>
            </div>
          </div>
        )}
      </div>
    </Seccion>
  );
}

/* ── Mis datos ─────────────────────────────────────────────────────────── */

function MisDatos({ perfil, onGuardado }) {
  const [editando, setEditando] = useState(false);
  const [forma, setForma] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const abrir = () => {
    setForma({ nombre: perfil.nombre, email: perfil.email, documento: perfil.documento, tipoDocumento: perfil.tipoDocumento || 'CC' });
    setError('');
    setEditando(true);
  };

  const guardar = async () => {
    setGuardando(true);
    setError('');
    try {
      const { data } = await api.put('/cuenta/perfil', forma);
      onGuardado(data.perfil);
      try { localStorage.setItem('customerName', data.perfil.nombre); } catch { /* nada */ }
      setEditando(false);
    } catch (e) {
      setError(e.response?.data?.message || 'No se pudieron guardar tus datos');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Seccion
      titulo="Mis datos"
      accion={!editando && (
        <button type="button" onClick={abrir} className="flex items-center gap-1 text-sm font-bold text-marca-fuerte h-9 px-2">
          <Pencil className="w-4 h-4" /> Editar
        </button>
      )}
    >
      {!editando ? (
        <div className="rounded-2xl border border-linea bg-superficie-tarjeta divide-y divide-linea">
          <Linea etiqueta="Nombre" valor={perfil.nombre} />
          <Linea etiqueta="Teléfono" valor={perfil.telefono} nota="Es tu cuenta: no se puede cambiar" />
          <Linea etiqueta="Correo" valor={perfil.email} vacio="Para recibir tu factura" />
          <Linea etiqueta="Documento" valor={perfil.documento ? `${perfil.tipoDocumento} ${perfil.documento}` : ''} vacio="Para la factura, sin dictarlo cada vez" />
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-marca bg-superficie-tarjeta p-4 space-y-3">
          <Campo etiqueta="Nombre" valor={forma.nombre} onCambio={(v) => setForma((f) => ({ ...f, nombre: v }))} autoFocus />
          <Campo etiqueta="Correo (opcional)" tipo="email" valor={forma.email} onCambio={(v) => setForma((f) => ({ ...f, email: v }))} placeholder="tu@correo.com" />
          <div className="flex gap-2">
            <label className="w-24 shrink-0">
              <span className="block text-xs font-bold text-tinta-2 mb-1">Tipo</span>
              <select
                value={forma.tipoDocumento}
                onChange={(e) => setForma((f) => ({ ...f, tipoDocumento: e.target.value }))}
                className="w-full h-12 rounded-xl border border-linea bg-white px-2 text-base text-tinta"
              >
                {['CC', 'NIT', 'CE', 'PP'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <div className="flex-1">
              <Campo etiqueta="Documento (opcional)" valor={forma.documento} onCambio={(v) => setForma((f) => ({ ...f, documento: v }))} inputMode="numeric" />
            </div>
          </div>
          {error && <p className="text-sm font-semibold text-peligro">{error}</p>}
          <div className="flex gap-2">
            <Boton variante="fantasma" className="flex-1" onClick={() => setEditando(false)}>Cancelar</Boton>
            <Boton className="flex-1" cargando={guardando} disabled={!forma.nombre || forma.nombre.trim().length < 2} onClick={guardar}>Guardar</Boton>
          </div>
        </div>
      )}
    </Seccion>
  );
}

function Linea({ etiqueta, valor, nota, vacio }) {
  return (
    <div className="px-4 py-3">
      <p className="text-xs font-bold text-tinta-3">{etiqueta}</p>
      <p className={`text-[15px] ${valor ? 'text-tinta font-semibold' : 'text-tinta-3'}`}>{valor || vacio || '—'}</p>
      {nota && <p className="text-xs text-tinta-3">{nota}</p>}
    </div>
  );
}

function Campo({ etiqueta, valor, onCambio, placeholder, tipo = 'text', autoFocus, inputMode }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-tinta-2 mb-1">{etiqueta}</span>
      {/* 16 px: con menos, el iPhone hace zoom al tocar el campo. */}
      <input
        type={tipo}
        value={valor || ''}
        onChange={(e) => onCambio(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        inputMode={inputMode}
        className="w-full h-12 rounded-xl border border-linea bg-white px-3.5 text-base text-tinta outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
      />
    </label>
  );
}

/* ── Borrar mis datos ──────────────────────────────────────────────────── */

function BorrarDatos({ onBorrado }) {
  const [error, setError] = useState('');
  const borrar = async () => {
    const ok = window.confirm(
      'Se borrarán tus datos, direcciones, favoritos y puntos en este negocio. Tus pedidos quedan en sus registros contables. ¿Continuar?',
    );
    if (!ok) return;
    try {
      await api.delete('/cuenta');
      onBorrado();
    } catch (e) {
      setError(e.response?.data?.message || 'No se pudieron borrar tus datos');
    }
  };
  return (
    <div className="pt-2 text-center">
      <button type="button" onClick={borrar} className="text-sm font-semibold text-tinta-3 underline underline-offset-4 h-11 px-3">
        Borrar mis datos
      </button>
      {error && <p className="text-sm font-semibold text-peligro">{error}</p>}
      <p className="text-xs text-tinta-3">{negocioDeLaCuenta() ? 'Solo en este negocio.' : ''}</p>
    </div>
  );
}
