import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ── Formatters ── */
const fmt = (n) => {
  if (isNaN(n) || !isFinite(n)) return '—';
  return Math.round(n).toLocaleString('es-CO');
};
const pct = (n) => {
  if (isNaN(n) || !isFinite(n)) return '—';
  return n.toFixed(1) + '%';
};

/* ── SVG Icons ── */
const Icons = {
  profit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  ),
  tag: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  ),
  scale: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18M3 9l9-6 9 6M5 21h14" />
      <path d="M5 9l-2 6h4L5 9zM19 9l-2 6h4L19 9z" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  discount: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="2" />
      <circle cx="15" cy="15" r="2" />
      <path d="M21 3L3 21" />
    </svg>
  ),
  target: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  chevron: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 9l-7 7-7-7" />
    </svg>
  ),
};

/* ── Shared Field ── */
function Field({ label, value, onChange, prefix = '$', suffix = '', placeholder = '0', hint }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-[11.5px] font-semibold text-slate-500">{label}</label>
        {hint && <span className="text-[10px] text-slate-400">{hint}</span>}
      </div>
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-slate-400 text-[13px] font-bold pointer-events-none select-none">
            {prefix}
          </span>
        )}
        <input
          type="number"
          min="0"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-900 text-[13px] font-bold py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all ${prefix ? 'pl-7' : 'pl-3'} ${suffix ? 'pr-10' : 'pr-3'}`}
        />
        {suffix && (
          <span className="absolute right-3 text-slate-400 text-[11px] font-bold pointer-events-none select-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Result row ── */
function Res({ label, value, main = false, good, bad }) {
  const base = 'flex items-center justify-between rounded-xl px-3.5 py-2.5 border';
  if (main) {
    const cls = good
      ? 'bg-emerald-50 border-emerald-100'
      : bad
      ? 'bg-rose-50 border-rose-100'
      : 'bg-blue-50 border-blue-100';
    const val = good ? 'text-emerald-700' : bad ? 'text-rose-700' : 'text-blue-700';
    return (
      <div className={`${base} ${cls}`}>
        <span className={`text-[12px] font-semibold ${val}`}>{label}</span>
        <span className={`text-[16px] font-black ${val}`}>{value}</span>
      </div>
    );
  }
  return (
    <div className={`${base} bg-slate-50 border-slate-100`}>
      <span className="text-[12px] font-semibold text-slate-500">{label}</span>
      <span className="text-[13px] font-bold text-slate-800">{value}</span>
    </div>
  );
}

/* ── Divider between inputs and results ── */
function Divider({ label = 'Resultados' }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex-1 h-px bg-slate-100" />
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );
}

/* ── Tool Card shell ── */
function ToolCard({ id, icon, iconBg, iconColor, title, desc, accentColor, children }) {
  const [open, setOpen] = useState(false);

  const accent = {
    emerald: 'border-emerald-200',
    blue:    'border-blue-200',
    amber:   'border-amber-200',
    violet:  'border-violet-200',
    rose:    'border-rose-200',
    sky:     'border-sky-200',
  }[accentColor] ?? 'border-slate-200';

  return (
    <div className={`rounded-2xl border-2 bg-white overflow-hidden transition-colors duration-200 ${open ? accent : 'border-slate-100'}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-slate-50/60 transition-colors"
      >
        <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0 ${iconBg} ${iconColor}`} style={{ minWidth: 36 }}>
          <div className="w-[18px] h-[18px]">{icon}</div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-bold text-slate-800 leading-tight">{title}</p>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">{desc}</p>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.18 }} className="text-slate-300 flex-shrink-0">
          {Icons.chevron}
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ════════════════ CALCULADORAS ════════════════ */

function CalcGanancias() {
  const [ventas, setVentas] = useState('');
  const [gastos, setGastos] = useState('');
  const v = parseFloat(ventas) || 0;
  const g = parseFloat(gastos) || 0;
  const ganancia = v - g;
  const margen   = v > 0 ? (ganancia / v) * 100 : NaN;
  const hasData  = v > 0 || g > 0;
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Ventas del día" value={ventas} onChange={setVentas} placeholder="500000" />
        <Field label="Gastos del día" value={gastos} onChange={setGastos} placeholder="200000" />
      </div>
      {hasData && (
        <>
          <Divider />
          <div className="space-y-2">
            <Res main label="Ganancia neta" value={`$${fmt(ganancia)}`} good={ganancia >= 0} bad={ganancia < 0} />
            <Res label="Margen de ganancia" value={pct(margen)} />
            <Res label="Gastos sobre ventas" value={pct(v > 0 ? (g / v) * 100 : NaN)} />
          </div>
        </>
      )}
    </>
  );
}

function CalcPrecio() {
  const [costo, setCosto]   = useState('');
  const [margen, setMargen] = useState('');
  const c      = parseFloat(costo) || 0;
  const m      = parseFloat(margen) || 0;
  const precio = m < 100 ? c / (1 - m / 100) : NaN;
  const gain   = precio - c;
  const hasData = c > 0 && m > 0;
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Costo del plato" value={costo} onChange={setCosto} placeholder="8000" />
        <Field label="Margen deseado" value={margen} onChange={setMargen} prefix="" suffix="%" placeholder="65" hint="ej. 65%" />
      </div>
      {hasData && (
        <>
          <Divider />
          <div className="space-y-2">
            <Res main label="Precio sugerido" value={`$${fmt(precio)}`} />
            <Res label="Ganancia por unidad" value={`$${fmt(gain)}`} />
            <Res label="Multiplicador" value={c > 0 ? `×${(precio / c).toFixed(2)}` : '—'} />
          </div>
        </>
      )}
    </>
  );
}

function CalcEquilibrio() {
  const [fijos,    setFijos]    = useState('');
  const [precio,   setPrecio]   = useState('');
  const [variable, setVariable] = useState('');
  const f  = parseFloat(fijos) || 0;
  const p  = parseFloat(precio) || 0;
  const v  = parseFloat(variable) || 0;
  const mu = p - v;
  const eq = mu > 0 ? Math.ceil(f / mu) : NaN;
  const hasData = f > 0 && p > 0;
  return (
    <>
      <Field label="Costos fijos mensuales" value={fijos} onChange={setFijos} placeholder="3000000" hint="arriendo, empleados, servicios…" />
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Precio prom. por pedido" value={precio} onChange={setPrecio} placeholder="25000" />
        <Field label="Costo variable/pedido" value={variable} onChange={setVariable} placeholder="10000" />
      </div>
      {hasData && (
        <>
          <Divider />
          <div className="space-y-2">
            <Res main label="Pedidos/mes para no perder" value={isNaN(eq) ? '—' : fmt(eq)} />
            <Res label="Minimo por dia" value={isNaN(eq) ? '—' : `≥ ${Math.ceil(eq / 30)}`} />
            <Res label="Margen por pedido" value={`$${fmt(mu)}`} />
          </div>
        </>
      )}
    </>
  );
}

function CalcPropinas() {
  const [total,     setTotal]     = useState('');
  const [empleados, setEmpleados] = useState('');
  const t      = parseFloat(total) || 0;
  const e      = parseInt(empleados) || 0;
  const porEmp = e > 0 ? t / e : NaN;
  const hasData = t > 0 && e > 0;
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Total propinas del dia" value={total} onChange={setTotal} placeholder="80000" />
        <Field label="Empleados" value={empleados} onChange={setEmpleados} prefix="" placeholder="3" />
      </div>
      {hasData && (
        <>
          <Divider />
          <div className="space-y-2">
            <Res main label="Propina por empleado" value={`$${fmt(porEmp)}`} good />
          </div>
        </>
      )}
    </>
  );
}

function CalcDescuento() {
  const [precio,    setPrecio]    = useState('');
  const [costo,     setCosto]     = useState('');
  const [descuento, setDescuento] = useState('');
  const p  = parseFloat(precio) || 0;
  const c  = parseFloat(costo) || 0;
  const d  = parseFloat(descuento) || 0;
  const pd = p * (1 - d / 100);
  const mo = p  > 0 ? ((p  - c) / p)  * 100 : NaN;
  const md = pd > 0 ? ((pd - c) / pd) * 100 : NaN;
  const go = p  - c;
  const gd = pd - c;
  const extraPct = go > 0 && gd > 0 ? Math.ceil((go / gd - 1) * 100) : NaN;
  const hasData = p > 0 && d > 0;
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Precio actual" value={precio} onChange={setPrecio} placeholder="25000" />
        <Field label="Costo del plato" value={costo} onChange={setCosto} placeholder="8000" />
        <Field label="Descuento" value={descuento} onChange={setDescuento} prefix="" suffix="%" placeholder="15" />
      </div>
      {hasData && (
        <>
          <Divider />
          <div className="space-y-2">
            <Res label="Precio con descuento" value={`$${fmt(pd)}`} />
            <Res label="Ganancia antes" value={`$${fmt(go)}`} />
            <Res main label="Ganancia despues" value={`$${fmt(gd)}`} good={gd >= go * 0.7} bad={gd < 0} />
            <Res label="Margen antes / despues" value={`${pct(mo)} → ${pct(md)}`} />
            {!isNaN(extraPct) && (
              <div className="bg-slate-800 rounded-xl px-3.5 py-3 flex items-center justify-between gap-3">
                <span className="text-[12px] font-semibold text-slate-400 leading-tight">
                  Para compensar el descuento debes vender
                </span>
                <span className="text-[18px] font-black text-white whitespace-nowrap">{extraPct}% mas</span>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

function CalcTicket() {
  const [ventas,   setVentas]   = useState('');
  const [pedidos,  setPedidos]  = useState('');
  const v      = parseFloat(ventas) || 0;
  const p      = parseInt(pedidos) || 0;
  const ticket = p > 0 ? v / p : NaN;
  const meta   = ticket * 1.2;
  const extra  = (meta - ticket) * p;
  const hasData = v > 0 && p > 0;
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Ventas totales" value={ventas} onChange={setVentas} placeholder="1500000" />
        <Field label="Numero de pedidos" value={pedidos} onChange={setPedidos} prefix="" placeholder="60" />
      </div>
      {hasData && (
        <>
          <Divider />
          <div className="space-y-2">
            <Res main label="Ticket promedio" value={`$${fmt(ticket)}`} />
            <Res label="Meta +20% por ticket" value={`$${fmt(meta)}`} />
            <Res label="Ganancia extra si lo logras" value={`$${fmt(extra)}`} />
          </div>
        </>
      )}
    </>
  );
}

/* ════════════════ PANEL PRINCIPAL ════════════════ */

export default function ToolsPanel() {
  const tools = [
    {
      id: 'ganancias',
      icon: Icons.profit,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      accentColor: 'emerald',
      title: 'Calculadora de ganancias',
      desc: 'Ventas del dia menos gastos = cuanto ganaste',
      Component: CalcGanancias,
    },
    {
      id: 'precio',
      icon: Icons.tag,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      accentColor: 'blue',
      title: 'Precio de venta ideal',
      desc: 'Cuanto cobrar para alcanzar tu margen objetivo',
      Component: CalcPrecio,
    },
    {
      id: 'equilibrio',
      icon: Icons.scale,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      accentColor: 'amber',
      title: 'Punto de equilibrio',
      desc: 'Pedidos minimos para cubrir tus costos fijos',
      Component: CalcEquilibrio,
    },
    {
      id: 'propinas',
      icon: Icons.users,
      iconBg: 'bg-violet-100',
      iconColor: 'text-violet-600',
      accentColor: 'violet',
      title: 'Division de propinas',
      desc: 'Reparte las propinas del dia entre tu equipo',
      Component: CalcPropinas,
    },
    {
      id: 'descuentos',
      icon: Icons.discount,
      iconBg: 'bg-rose-100',
      iconColor: 'text-rose-600',
      accentColor: 'rose',
      title: 'Impacto de un descuento',
      desc: 'Que le pasa a tu margen si bajas el precio',
      Component: CalcDescuento,
    },
    {
      id: 'ticket',
      icon: Icons.target,
      iconBg: 'bg-sky-100',
      iconColor: 'text-sky-600',
      accentColor: 'sky',
      title: 'Ticket promedio',
      desc: 'Cuanto gasta un cliente y cuanto puedes crecer',
      Component: CalcTicket,
    },
  ];

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-[18px] font-bold text-slate-900 tracking-tight">Herramientas</h2>
        <p className="text-[13px] text-slate-400 mt-0.5">Calculadoras para tomar mejores decisiones</p>
      </div>

      <div className="space-y-2.5">
        {tools.map(({ id, Component, ...props }) => (
          <ToolCard key={id} {...props}>
            <Component />
          </ToolCard>
        ))}
      </div>
    </div>
  );
}
