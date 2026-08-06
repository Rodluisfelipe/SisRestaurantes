import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Calculadora del panel.
 *
 * Varios negocios estaban usando la calculadora de Windows encima del panel.
 * Esta vive dentro, funciona con el teclado y guarda una cinta de las últimas
 * operaciones — que es justo lo que se pierde al alternar entre ventanas.
 */

const OPS = { '+': (a, b) => a + b, '-': (a, b) => a - b, '×': (a, b) => a * b, '÷': (a, b) => (b === 0 ? NaN : a / b) };

// Se muestra con separadores de miles, pero sin forzar decimales que no hay:
// en pesos, "45.000" se lee mejor que "45.000,00".
function formatear(valor) {
  if (valor === '' || valor === null || valor === undefined) return '0';
  const s = String(valor);
  if (s === 'Error') return s;
  const negativo = s.startsWith('-');
  const limpio = negativo ? s.slice(1) : s;
  const [ent, dec] = limpio.split('.');
  const entFmt = Number(ent || 0).toLocaleString('es-CO');
  return (negativo ? '-' : '') + entFmt + (dec !== undefined ? ',' + dec : '');
}

export default function Calculator({ open, onClose }) {
  const [actual, setActual] = useState('0');   // lo que se está escribiendo
  const [previo, setPrevio] = useState(null);  // operando izquierdo
  const [op, setOp] = useState(null);
  const [reemplazar, setReemplazar] = useState(true); // el próximo dígito pisa la pantalla
  const [cinta, setCinta] = useState([]);
  const panelRef = useRef(null);

  const num = (s) => parseFloat(String(s).replace(',', '.')) || 0;

  const escribir = useCallback((d) => {
    setActual((prev) => {
      if (reemplazar) return d === '.' ? '0.' : d;
      if (d === '.' && prev.includes('.')) return prev;
      if (prev === '0' && d !== '.') return d;
      return (prev + d).slice(0, 15);   // sin esto se puede escribir hasta romper el layout
    });
    setReemplazar(false);
  }, [reemplazar]);

  const calcular = useCallback(() => {
    if (op === null || previo === null) return null;
    const a = num(previo);
    const b = num(actual);
    const r = OPS[op](a, b);
    if (!Number.isFinite(r)) return 'Error';
    // Se recorta a 4 decimales y se quitan los ceros sobrantes: dividir suele
    // dar colas largas que no aportan nada en una cuenta de restaurante.
    return String(parseFloat(r.toFixed(4)));
  }, [op, previo, actual]);

  const igual = useCallback(() => {
    const r = calcular();
    if (r === null) return;
    setCinta((c) => [{ texto: `${formatear(previo)} ${op} ${formatear(actual)}`, resultado: r }, ...c].slice(0, 8));
    setActual(r);
    setPrevio(null);
    setOp(null);
    setReemplazar(true);
  }, [calcular, previo, op, actual]);

  const ponerOp = useCallback((nuevaOp) => {
    // Encadenar (2+3+4) resuelve lo pendiente antes de seguir
    if (op !== null && !reemplazar) {
      const r = calcular();
      if (r === 'Error') { setActual('Error'); setPrevio(null); setOp(null); return; }
      setPrevio(r);
      setActual(r);
    } else {
      setPrevio(actual);
    }
    setOp(nuevaOp);
    setReemplazar(true);
  }, [op, reemplazar, calcular, actual]);

  /* El % se comporta como espera un cajero, y no igual en las cuatro
     operaciones:

       45000 - 10 %  ->  descuenta el 10% DE 45000  ->  40.500
       60000 × 10 %  ->  el 10% de 60000            ->   6.000

     Con + y − el porcentaje se calcula sobre la base; con × y ÷ el número se
     convierte en fracción. Tratarlos igual daba 360 millones al sacar una
     propina del 10%. */
  const porcentaje = useCallback(() => {
    if ((op === '+' || op === '-') && previo !== null) {
      setActual(String(parseFloat(((num(previo) * num(actual)) / 100).toFixed(4))));
    } else {
      setActual(String(parseFloat((num(actual) / 100).toFixed(6))));
    }
    setReemplazar(false);
  }, [op, previo, actual]);

  const limpiar = useCallback(() => {
    setActual('0'); setPrevio(null); setOp(null); setReemplazar(true);
  }, []);

  const borrarUno = useCallback(() => {
    setActual((p) => (p.length <= 1 || p === 'Error' ? '0' : p.slice(0, -1)));
  }, []);

  // Teclado: es lo que hace que reemplace de verdad a la de Windows
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      const k = e.key;
      if (k >= '0' && k <= '9') { escribir(k); e.preventDefault(); return; }
      if (k === '.' || k === ',') { escribir('.'); e.preventDefault(); return; }
      if (k === '+' || k === '-') { ponerOp(k); e.preventDefault(); return; }
      if (k === '*' || k === 'x' || k === 'X') { ponerOp('×'); e.preventDefault(); return; }
      if (k === '/') { ponerOp('÷'); e.preventDefault(); return; }
      if (k === 'Enter' || k === '=') { igual(); e.preventDefault(); return; }
      if (k === 'Backspace') { borrarUno(); e.preventDefault(); return; }
      if (k === 'Escape') { onClose(); return; }
      if (k === '%') { porcentaje(); e.preventDefault(); return; }
      if (k.toLowerCase() === 'c') { limpiar(); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, escribir, ponerOp, igual, borrarUno, porcentaje, limpiar, onClose]);

  const copiar = async () => {
    try { await navigator.clipboard.writeText(String(num(actual))); } catch { /* sin portapapeles */ }
  };

  if (!open) return null;

  const Tecla = ({ children, onClick, className = '', ancho = '' }) => (
    <button
      onClick={onClick}
      className={`h-12 rounded-xl font-bold text-[15px] transition-colors active:scale-95 ${ancho} ${className}`}
    >
      {children}
    </button>
  );

  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="fixed bottom-24 right-6 z-[110] w-[280px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50">
        <span className="text-[12px] font-bold text-slate-600">Calculadora</span>
        <div className="flex items-center gap-1">
          <button onClick={copiar} title="Copiar resultado" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
          </button>
          <button onClick={onClose} title="Cerrar (Esc)" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* Cinta: lo que uno pierde al usar la calculadora del sistema */}
      {cinta.length > 0 && (
        <div className="max-h-[92px] overflow-y-auto px-3 py-1.5 bg-slate-50/60 border-b border-slate-100 space-y-0.5">
          {cinta.map((c, i) => (
            <button
              key={i}
              onClick={() => { setActual(c.resultado); setReemplazar(true); }}
              className="w-full text-right text-[11px] text-slate-400 hover:text-slate-700 transition-colors leading-tight"
              title="Usar este resultado"
            >
              {c.texto} = <span className="font-semibold">{formatear(c.resultado)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Pantalla */}
      <div className="px-3 py-3 text-right">
        <div className="h-4 text-[11px] text-slate-400 tabular-nums">
          {previo !== null && op ? `${formatear(previo)} ${op}` : ''}
        </div>
        <div className="text-[26px] font-black text-slate-900 tabular-nums leading-tight truncate">
          {formatear(actual)}
        </div>
      </div>

      {/* Teclado */}
      <div className="grid grid-cols-4 gap-1.5 p-2.5 pt-0">
        <Tecla onClick={limpiar} className="bg-red-50 text-red-600 hover:bg-red-100">C</Tecla>
        <Tecla onClick={borrarUno} className="bg-slate-100 text-slate-600 hover:bg-slate-200">⌫</Tecla>
        <Tecla onClick={porcentaje} className="bg-slate-100 text-slate-600 hover:bg-slate-200">%</Tecla>
        <Tecla onClick={() => ponerOp('÷')} className="bg-slate-800 text-white hover:bg-slate-700">÷</Tecla>

        {['7', '8', '9'].map(d => <Tecla key={d} onClick={() => escribir(d)} className="bg-slate-50 text-slate-800 hover:bg-slate-100">{d}</Tecla>)}
        <Tecla onClick={() => ponerOp('×')} className="bg-slate-800 text-white hover:bg-slate-700">×</Tecla>

        {['4', '5', '6'].map(d => <Tecla key={d} onClick={() => escribir(d)} className="bg-slate-50 text-slate-800 hover:bg-slate-100">{d}</Tecla>)}
        <Tecla onClick={() => ponerOp('-')} className="bg-slate-800 text-white hover:bg-slate-700">−</Tecla>

        {['1', '2', '3'].map(d => <Tecla key={d} onClick={() => escribir(d)} className="bg-slate-50 text-slate-800 hover:bg-slate-100">{d}</Tecla>)}
        <Tecla onClick={() => ponerOp('+')} className="bg-slate-800 text-white hover:bg-slate-700">+</Tecla>

        <Tecla onClick={() => escribir('0')} ancho="col-span-2" className="bg-slate-50 text-slate-800 hover:bg-slate-100">0</Tecla>
        <Tecla onClick={() => escribir('.')} className="bg-slate-50 text-slate-800 hover:bg-slate-100">,</Tecla>
        <Tecla onClick={igual} className="bg-emerald-500 text-white hover:bg-emerald-600">=</Tecla>
      </div>
    </motion.div>
  );
}

/** Botón flotante + calculadora. Se monta una vez en el panel. */
export function CalculatorLauncher() {
  const [open, setOpen] = useState(false);

  // Atajo global: la calculadora sirve de poco si hay que ir a buscarla
  useEffect(() => {
    const onKey = (e) => {
      if ((e.altKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        setOpen((o) => !o);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <AnimatePresence>
        {open && <Calculator open={open} onClose={() => setOpen(false)} />}
      </AnimatePresence>

      <button
        onClick={() => setOpen((o) => !o)}
        title="Calculadora (Alt+C)"
        className={`fixed bottom-6 right-6 z-[105] w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-90 ${
          open ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900'
        }`}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <line x1="8" y1="6" x2="16" y2="6" />
          <line x1="8" y1="10" x2="8" y2="10" /><line x1="12" y1="10" x2="12" y2="10" /><line x1="16" y1="10" x2="16" y2="10" />
          <line x1="8" y1="14" x2="8" y2="14" /><line x1="12" y1="14" x2="12" y2="14" /><line x1="16" y1="14" x2="16" y2="18" />
          <line x1="8" y1="18" x2="12" y2="18" />
        </svg>
      </button>
    </>
  );
}
