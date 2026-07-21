import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/**
 * Score de salud del menú: audita la configuración del negocio y devuelve una
 * calificación 0-100 + checklist accionable (cada punto lleva a la pestaña que
 * lo arregla). Todo se calcula en el cliente con datos ya cargados.
 */
export default function MenuHealthScore({
  products = [], categories = [], toppingGroups = [], businessConfig, setActiveTab,
}) {
  const [expanded, setExpanded] = useState(false);

  const { score, checks } = useMemo(() => {
    const active = (products || []).filter(p => p && p.active !== false);
    const total = active.length;
    const noPhoto = active.filter(p => !p.image).length;
    const noDesc = active.filter(p => !p.description || !String(p.description).trim()).length;
    const featuredCount = active.filter(p => p.isFeatured).length;

    const cats = categories || [];
    const emptyCats = cats.filter(c => !active.some(p => p.category === c._id)).length;

    const hours = businessConfig?.businessHours || {};
    const daysOk = DAYS.filter(d => {
      const h = hours[d];
      return h && (h.isOpen === false || (h.openTime && h.closeTime));
    }).length;

    const ratio = (n, d) => (d > 0 ? n / d : 0);

    const list = [
      {
        id: 'has-products', label: 'Tener productos publicados', weight: 15,
        value: total > 0 ? 1 : 0, tab: 'products',
        detail: total > 0 ? `${total} productos activos` : 'Aún no tienes productos activos',
      },
      {
        id: 'photos', label: 'Fotos en los productos', weight: 20,
        value: total ? ratio(total - noPhoto, total) : 0, tab: 'products',
        detail: total === 0 ? 'Sin productos' : noPhoto === 0 ? 'Todos con foto' : `${noPhoto} producto(s) sin foto`,
      },
      {
        id: 'descriptions', label: 'Descripciones en los productos', weight: 10,
        value: total ? ratio(total - noDesc, total) : 0, tab: 'products',
        detail: total === 0 ? 'Sin productos' : noDesc === 0 ? 'Todas completas' : `${noDesc} producto(s) sin descripción`,
      },
      {
        id: 'featured', label: 'Productos destacados', weight: 10,
        value: featuredCount > 0 ? 1 : 0, tab: 'product-order',
        detail: featuredCount > 0 ? `${featuredCount} destacado(s)` : 'No has destacado ningún producto',
      },
      {
        id: 'categories', label: 'Categorías organizadas', weight: 10,
        value: cats.length > 0 && emptyCats === 0 ? 1 : cats.length > 0 ? 0.5 : 0, tab: 'categories',
        detail: cats.length === 0 ? 'Sin categorías' : emptyCats > 0 ? `${emptyCats} categoría(s) vacías` : `${cats.length} categorías, ninguna vacía`,
      },
      {
        id: 'logo', label: 'Logo del negocio', weight: 10,
        value: businessConfig?.logo ? 1 : 0, tab: 'business',
        detail: businessConfig?.logo ? 'Configurado' : 'Falta subir el logo',
      },
      {
        id: 'biz-desc', label: 'Descripción del negocio', weight: 5,
        value: businessConfig?.description && String(businessConfig.description).trim() ? 1 : 0, tab: 'business',
        detail: businessConfig?.description ? 'Configurada' : 'Ayuda al SEO y a que te encuentren',
      },
      {
        id: 'whatsapp', label: 'WhatsApp configurado', weight: 10,
        value: businessConfig?.whatsappNumber ? 1 : 0, tab: 'whatsapp',
        detail: businessConfig?.whatsappNumber ? 'Configurado' : 'Sin WhatsApp no recibes pedidos por ese canal',
      },
      {
        id: 'hours', label: 'Horarios completos', weight: 10,
        value: ratio(daysOk, 7), tab: 'business',
        detail: daysOk === 7 ? 'Los 7 días configurados' : `${7 - daysOk} día(s) sin configurar`,
      },
      {
        id: 'extras', label: 'Extras / adiciones', weight: 5,
        value: (toppingGroups || []).length > 0 ? 1 : 0, tab: 'toppings',
        detail: (toppingGroups || []).length > 0 ? `${toppingGroups.length} grupo(s)` : 'Los extras suben el ticket promedio',
      },
    ];

    const totalWeight = list.reduce((s, c) => s + c.weight, 0);
    const earned = list.reduce((s, c) => s + c.weight * Math.max(0, Math.min(1, c.value)), 0);
    return { score: Math.round((earned / totalWeight) * 100), checks: list };
  }, [products, categories, toppingGroups, businessConfig]);

  const pending = checks.filter(c => c.value < 1).sort((a, b) => (b.weight * (1 - b.value)) - (a.weight * (1 - a.value)));
  const visible = expanded ? pending : pending.slice(0, 3);

  const tone = score >= 85
    ? { ring: '#10b981', bg: 'from-emerald-500 to-teal-600', label: 'Excelente' }
    : score >= 60
      ? { ring: '#f59e0b', bg: 'from-amber-500 to-orange-600', label: 'Vas bien' }
      : { ring: '#ef4444', bg: 'from-red-500 to-rose-600', label: 'Por mejorar' };

  const R = 26, C = 2 * Math.PI * R;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.04)] overflow-hidden"
    >
      <div className="p-4 flex items-center gap-4">
        {/* Anillo de score */}
        <div className="relative w-[68px] h-[68px] shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r={R} fill="none" stroke="#f1f5f9" strokeWidth="7" />
            <motion.circle
              cx="32" cy="32" r={R} fill="none" stroke={tone.ring} strokeWidth="7" strokeLinecap="round"
              strokeDasharray={C}
              initial={{ strokeDashoffset: C }}
              animate={{ strokeDashoffset: C - (C * score) / 100 }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-extrabold text-slate-900 leading-none tabular-nums">{score}</span>
            <span className="text-[9px] font-semibold text-slate-400">/100</span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800">Salud de tu menú</h3>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white bg-gradient-to-r ${tone.bg}`}>{tone.label}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {pending.length === 0
              ? '¡Todo listo! Tu menú está completo.'
              : `${pending.length} cosa(s) por mejorar para vender más.`}
          </p>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="px-4 pb-4">
          <div className="space-y-1.5">
            <AnimatePresence initial={false}>
              {visible.map(c => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{c.label}</p>
                    <p className="text-[11px] text-slate-400 truncate">{c.detail}</p>
                  </div>
                  {setActiveTab && (
                    <button
                      type="button"
                      onClick={() => setActiveTab(c.tab)}
                      className="shrink-0 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors"
                    >
                      Arreglar →
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {pending.length > 3 && (
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              className="mt-2 text-[11px] font-bold text-slate-500 hover:text-slate-700 transition-colors"
            >
              {expanded ? 'Ver menos' : `Ver ${pending.length - 3} más`}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
