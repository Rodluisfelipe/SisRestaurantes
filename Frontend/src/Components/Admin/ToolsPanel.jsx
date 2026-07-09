import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const fmt = (n) => {
  if (isNaN(n) || !isFinite(n)) return '—';
  return Math.round(n).toLocaleString('es-CO');
};

const pct = (n) => {
  if (isNaN(n) || !isFinite(n)) return '—';
  return n.toFixed(1) + '%';
};

function Card({ emoji, title, desc, color, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-2xl border-2 overflow-hidden transition-all ${open ? `border-${color}-200 bg-${color}-50/30` : 'border-slate-100 bg-white'}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${open ? `bg-${color}-100` : 'bg-slate-100'}`}>
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-slate-800">{title}</p>
          <p className="text-[11px] text-slate-400 truncate">{desc}</p>
        </div>
        <motion.svg
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="w-4 h-4 text-slate-400 flex-shrink-0"
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-slate-100">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, value, onChange, prefix = '$', suffix = '', placeholder = '0' }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      <div className="relative flex items-center">
        {prefix && <span className="absolute left-3 text-slate-400 text-sm font-semibold pointer-events-none">{prefix}</span>}
        <input
          type="number"
          min="0"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-xl border border-slate-200 bg-white text-slate-900 text-sm font-semibold py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all ${prefix ? 'pl-8' : 'pl-3'} ${suffix ? 'pr-10' : 'pr-3'}`}
        />
        {suffix && <span className="absolute right-3 text-slate-400 text-xs font-semibold pointer-events-none">{suffix}</span>}
      </div>
    </div>
  );
}

function Result({ label, value, highlight = false, color = 'blue' }) {
  const colors = {
    blue:  'bg-blue-50  border-blue-100  text-blue-700',
    green: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    rose:  'bg-rose-50  border-rose-100  text-rose-700',
  };
  return (
    <div className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 ${highlight ? colors[color] : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
      <span className="text-[12px] font-semibold">{label}</span>
      <span className={`text-[15px] font-black ${highlight ? '' : 'text-slate-800'}`}>{value}</span>
    </div>
  );
}

/* ───────────────────────── CALCULADORAS ───────────────────────── */

function CalcGanancias() {
  const [ventas, setVentas] = useState('');
  const [gastos, setGastos] = useState('');
  const v = parseFloat(ventas) || 0;
  const g = parseFloat(gastos) || 0;
  const ganancia = v - g;
  const margen = v > 0 ? (ganancia / v) * 100 : NaN;
  const color = ganancia >= 0 ? 'green' : 'rose';
  return (
    <div className="space-y-3 mt-2">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Ventas del día" value={ventas} onChange={setVentas} placeholder="500.000" />
        <Field label="Gastos del día" value={gastos} onChange={setGastos} placeholder="200.000" />
      </div>
      <div className="space-y-2 mt-3">
        <Result label="Ganancia neta" value={`$${fmt(ganancia)}`} highlight color={color} />
        <Result label="Margen de ganancia" value={pct(margen)} />
        <Result label="Gastos sobre ventas" value={pct(v > 0 ? (g / v) * 100 : NaN)} />
      </div>
    </div>
  );
}

function CalcPrecio() {
  const [costo, setCosto] = useState('');
  const [margen, setMargen] = useState('');
  const c = parseFloat(costo) || 0;
  const m = parseFloat(margen) || 0;
  const precio = m < 100 ? c / (1 - m / 100) : NaN;
  const gananciaUnd = precio - c;
  return (
    <div className="space-y-3 mt-2">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Costo del plato" value={costo} onChange={setCosto} placeholder="8.000" />
        <Field label="Margen deseado" value={margen} onChange={setMargen} prefix="" suffix="%" placeholder="65" />
      </div>
      <div className="space-y-2 mt-3">
        <Result label="Precio de venta sugerido" value={`$${fmt(precio)}`} highlight color="blue" />
        <Result label="Ganancia por unidad" value={`$${fmt(gananciaUnd)}`} />
        <Result label="Multiplicador sobre costo" value={c > 0 ? `×${(precio / c).toFixed(2)}` : '—'} />
      </div>
    </div>
  );
}

function CalcEquilibrio() {
  const [fijos, setFijos] = useState('');
  const [precio, setPrecio] = useState('');
  const [variable, setVariable] = useState('');
  const f = parseFloat(fijos) || 0;
  const p = parseFloat(precio) || 0;
  const v = parseFloat(variable) || 0;
  const margenUnit = p - v;
  const equilibrio = margenUnit > 0 ? Math.ceil(f / margenUnit) : NaN;
  const porDia = equilibrio / 30;
  return (
    <div className="space-y-3 mt-2">
      <Field label="Costos fijos mensuales (arriendo, empleados…)" value={fijos} onChange={setFijos} placeholder="3.000.000" />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Precio promedio por pedido" value={precio} onChange={setPrecio} placeholder="25.000" />
        <Field label="Costo variable por pedido" value={variable} onChange={setVariable} placeholder="10.000" />
      </div>
      <div className="space-y-2 mt-3">
        <Result label="Pedidos para cubrir costos / mes" value={isNaN(equilibrio) ? '—' : fmt(equilibrio)} highlight color="amber" />
        <Result label="Pedidos mínimos por día" value={isNaN(porDia) ? '—' : `≥ ${Math.ceil(porDia)}`} />
        <Result label="Margen por pedido" value={`$${fmt(margenUnit)}`} />
      </div>
    </div>
  );
}

function CalcPropinas() {
  const [total, setTotal] = useState('');
  const [empleados, setEmpleados] = useState('');
  const t = parseFloat(total) || 0;
  const e = parseInt(empleados) || 0;
  const porEmp = e > 0 ? t / e : NaN;
  return (
    <div className="space-y-3 mt-2">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Total propinas del día" value={total} onChange={setTotal} placeholder="80.000" />
        <Field label="Número de empleados" value={empleados} onChange={setEmpleados} prefix="" placeholder="3" />
      </div>
      <div className="space-y-2 mt-3">
        <Result label="Propina por empleado" value={`$${fmt(porEmp)}`} highlight color="green" />
        <Result label="Empleados contados" value={e > 0 ? e : '—'} />
      </div>
    </div>
  );
}

function CalcDescuento() {
  const [precio, setPrecio] = useState('');
  const [costo, setCosto] = useState('');
  const [descuento, setDescuento] = useState('');
  const p = parseFloat(precio) || 0;
  const c = parseFloat(costo) || 0;
  const d = parseFloat(descuento) || 0;
  const precioDesc = p * (1 - d / 100);
  const margenOrig = p > 0 ? ((p - c) / p) * 100 : NaN;
  const margenDesc = precioDesc > 0 ? ((precioDesc - c) / precioDesc) * 100 : NaN;
  const gananciaOrig = p - c;
  const gananciaDesc = precioDesc - c;
  // Cuántas unidades extra necesitas para igualar ganancia
  const extra = gananciaOrig > 0 && gananciaDesc > 0 ? Math.ceil((gananciaOrig / gananciaDesc - 1) * 100) : NaN;
  return (
    <div className="space-y-3 mt-2">
      <div className="grid grid-cols-3 gap-2">
        <Field label="Precio actual" value={precio} onChange={setPrecio} placeholder="25.000" />
        <Field label="Costo del plato" value={costo} onChange={setCosto} placeholder="8.000" />
        <Field label="Descuento" value={descuento} onChange={setDescuento} prefix="" suffix="%" placeholder="15" />
      </div>
      <div className="space-y-2 mt-3">
        <Result label="Precio con descuento" value={`$${fmt(precioDesc)}`} />
        <Result label="Ganancia sin descuento" value={`$${fmt(gananciaOrig)}`} />
        <Result label="Ganancia con descuento" value={`$${fmt(gananciaDesc)}`} highlight color={gananciaDesc >= 0 ? 'amber' : 'rose'} />
        <Result label="Margen original → con desc." value={`${pct(margenOrig)} → ${pct(margenDesc)}`} />
        {!isNaN(extra) && (
          <div className="bg-slate-800 rounded-xl px-3.5 py-2.5 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-slate-300">Necesitas vender</span>
            <span className="text-[14px] font-black text-white">{extra}% más unidades</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CalcTicketPromedio() {
  const [ventas, setVentas] = useState('');
  const [pedidos, setPedidos] = useState('');
  const v = parseFloat(ventas) || 0;
  const p = parseInt(pedidos) || 0;
  const ticket = p > 0 ? v / p : NaN;
  const ticketMeta = ticket * 1.2;
  return (
    <div className="space-y-3 mt-2">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Ventas totales" value={ventas} onChange={setVentas} placeholder="1.500.000" />
        <Field label="Número de pedidos" value={pedidos} onChange={setPedidos} prefix="" placeholder="60" />
      </div>
      <div className="space-y-2 mt-3">
        <Result label="Ticket promedio" value={`$${fmt(ticket)}`} highlight color="blue" />
        <Result label="Meta +20% por ticket" value={`$${fmt(ticketMeta)}`} />
        <Result label="Si logras la meta, ganarías extra" value={`$${fmt((ticketMeta - ticket) * p)}`} />
      </div>
    </div>
  );
}

/* ─────────────────────────── PANEL ─────────────────────────── */

export default function ToolsPanel() {
  return (
    <div className="max-w-2xl mx-auto space-y-3">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-lg font-bold text-slate-900">Herramientas</h2>
        <p className="text-sm text-slate-500 mt-0.5">Calculadoras rápidas para tomar mejores decisiones</p>
      </div>

      <Card emoji="💰" title="Calculadora de ganancias" desc="Ventas menos gastos = cuánto ganaste hoy" color="emerald">
        <CalcGanancias />
      </Card>

      <Card emoji="🏷️" title="Precio de venta ideal" desc="Cuánto cobrar para alcanzar tu margen deseado" color="blue">
        <CalcPrecio />
      </Card>

      <Card emoji="⚖️" title="Punto de equilibrio" desc="Cuántos pedidos necesitas para cubrir tus costos fijos" color="amber">
        <CalcEquilibrio />
      </Card>

      <Card emoji="🤝" title="Calculadora de propinas" desc="Divide las propinas del día entre tu equipo" color="violet">
        <CalcPropinas />
      </Card>

      <Card emoji="📉" title="Impacto de descuentos" desc="Qué pasa con tu margen si ofreces un descuento" color="rose">
        <CalcDescuento />
      </Card>

      <Card emoji="🎯" title="Ticket promedio" desc="Cuánto gasta un cliente por pedido y cuánto podrías crecer" color="sky">
        <CalcTicketPromedio />
      </Card>
    </div>
  );
}
