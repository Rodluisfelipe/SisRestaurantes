import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Invita a administrar desde un computador.
 *
 * Mucha gente se registra desde el celular y termina configurando todo ahí:
 * subir fotos, armar categorías, dibujar zonas de domicilio y leer reportes
 * se vuelve lento y se abandona a medias. Este aviso no bloquea nada —el panel
 * móvil sigue funcionando— pero explica qué gana en el computador y le manda
 * el enlace para no tener que teclearlo.
 *
 * Aparece solo en pantallas chicas y se puede posponer, pero vuelve cada día:
 * el objetivo es cambiar una costumbre, y eso no pasa con un aviso que se
 * descarta una vez.
 */

const CLAVE = 'menuby_desktop_nudge_dia';

const VENTAJAS = [
  'Subir las fotos de tus productos desde el computador',
  'Armar el menú y las categorías sin pelear con la pantalla',
  'Dibujar las zonas de domicilio sobre el mapa',
  'Ver los reportes y descargarlos a Excel',
];

/* Se guarda el día en que se descartó, no un plazo de horas: así reaparece en
   la primera entrada de cada día natural. Con un plazo de 24h, quien entra
   cada mañana a la misma hora se lo perdería día por medio. */
const hoy = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

function silenciarHoy() {
  try {
    localStorage.setItem(CLAVE, hoy());
  } catch { /* modo privado: se mostrará de nuevo, no es grave */ }
}

function estaSilenciado() {
  try {
    return localStorage.getItem(CLAVE) === hoy();
  } catch {
    return false;
  }
}

export default function DesktopNudge() {
  const [visible, setVisible] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    // En un computador el aviso no tiene sentido
    if (typeof window === 'undefined' || window.innerWidth >= 1024) return;
    if (estaSilenciado()) return;
    // Se deja respirar un momento para no competir con la carga del panel
    const t = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  const url = typeof window !== 'undefined' ? window.location.href.split('?')[0] : '';
  const mensaje = `Panel de mi negocio en MenuBy — ábrelo en el computador:\n${url}`;

  const posponer = () => { silenciarHoy(); setVisible(false); };

  const porWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener');
    silenciarHoy();
    setVisible(false);
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch { /* sin portapapeles: queda el enlace a la vista para copiarlo a mano */ }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="lg:hidden mb-4 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white overflow-hidden"
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500 text-white flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="13" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-[14px] font-bold text-slate-800 leading-tight">
                Configura tu negocio desde un computador
              </h3>
              <p className="text-[12px] text-slate-500 leading-snug mt-0.5">
                Desde el celular puedes ver pedidos y cobrar sin problema. Pero para dejar el menú listo, un computador o portátil te va a ahorrar mucho tiempo.
              </p>
            </div>
          </div>

          <ul className="mt-3 space-y-1.5">
            {VENTAJAS.map((v) => (
              <li key={v} className="flex items-start gap-2 text-[12px] text-slate-600">
                <svg className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                <span className="leading-snug">{v}</span>
              </li>
            ))}
          </ul>

          {/* El enlace a la vista: si no quiere WhatsApp ni copiar, lo teclea */}
          <p className="mt-3 text-[11px] font-mono text-slate-400 break-all bg-slate-50 rounded-lg px-2.5 py-2 border border-slate-100">
            {url}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={porWhatsApp}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] font-bold transition-colors active:scale-[0.98]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M20.52 3.449C12.831-3.984.106 1.407.101 11.893c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652a11.882 11.882 0 005.667 1.443h.005c9.08 0 14.284-9.834 9.513-17.342zM12.007 21.79a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.981.999-3.648-.235-.374a9.86 9.86 0 01-1.51-5.263c.001-8.712 10.59-13.075 16.749-6.916 6.135 6.093 1.824 16.812-6.87 16.812z" />
              </svg>
              Enviarme el enlace
            </button>
            <button
              onClick={copiar}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-[12px] font-bold hover:bg-slate-50 transition-colors active:scale-[0.98]"
            >
              {copiado ? (
                <><svg className="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>Copiado</>
              ) : (
                <><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>Copiar</>
              )}
            </button>
          </div>
        </div>

        <button
          onClick={posponer}
          className="w-full py-2.5 text-[11px] font-semibold text-slate-400 hover:text-slate-600 border-t border-blue-100 transition-colors"
        >
          Hoy no, seguir desde el celular
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
