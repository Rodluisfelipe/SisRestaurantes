import React, { useState, useRef } from 'react';
import { Link, useLocation, Navigate } from 'react-router-dom';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import useLandingSEO from '../../hooks/useLandingSEO';
import { getNichePageBySlug, getAllNichePages } from '../../data/nichePages';

const BRAND = '#E31E24';

/* ── Animated Counter ── */
const useCounter = (end, duration = 2000, active = false) => {
  const [count, setCount] = React.useState(0);
  const num = parseInt(String(end).replace(/[^0-9]/g, ''), 10) || 0;
  React.useEffect(() => {
    if (!active) return;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setCount(Math.floor((1 - Math.pow(1 - p, 3)) * num));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [active, num, duration]);
  return count;
};

/* ── Section ── */
const Section = ({ children, className = '', id }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.section
      id={id}
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.section>
  );
};

/* ── Stat Card ── */
const StatCard = ({ value, label }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const count = useCounter(value, 2000, inView);
  const suffix = String(value).replace(/[0-9]/g, '');
  return (
    <div ref={ref} className="text-center px-2">
      <p className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white leading-none">
        {count}{suffix}
      </p>
      <p className="text-xs sm:text-sm text-red-100 mt-1.5">{label}</p>
    </div>
  );
};

const Check = () => <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>;

/* ── FAQ Accordion ── */
function FAQAccordion({ items }) {
  const [open, setOpen] = useState(null);
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 text-left gap-4"
          >
            <span className="text-sm sm:text-base font-semibold text-gray-800 leading-snug">{item.q}</span>
            <svg className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-300 ${open === i ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <p className="px-5 sm:px-6 pb-5 text-sm sm:text-base text-gray-500 leading-relaxed">{item.a}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

/* ── Related Niche Pages ── */
function RelatedNiches({ currentSlug }) {
  const all = getAllNichePages().filter(p => p.slug !== currentSlug).slice(0, 6);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {all.map(p => (
        <Link
          key={p.slug}
          to={`/${p.slug}`}
          className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-4 hover:border-red-200 hover:shadow-md transition-all group"
        >
          <span className="text-2xl">{p.emoji}</span>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-bold text-gray-800 group-hover:text-red-600 transition-colors truncate">{p.h1.replace('Menú Digital para ', '')}</p>
            <p className="text-[10px] text-gray-400">Ver más</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════ */
/* ═══════ NICHE PAGE COMPONENT ══════ */
/* ═══════════════════════════════════ */
export default function NichePage() {
  const location = useLocation();
  const nicheSlug = location.pathname.replace(/^\//, '');
  const page = getNichePageBySlug(nicheSlug);

  if (!page) {
    return <Navigate to="/" replace />;
  }

  useLandingSEO({
    title: page.seo.title,
    description: page.seo.description,
    canonical: `/${page.slug}`,
    keywords: page.seo.keywords,
  });

  // Build FAQ schema
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": page.faq.map(f => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": { "@type": "Answer", "text": f.a }
    }))
  };

  return (
    <div className="bg-white overflow-x-hidden">

      {/* ═══ HERO ═══ */}
      <section className="relative min-h-[70vh] sm:min-h-[75vh] flex items-center pt-20 sm:pt-24 pb-12 sm:pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-red-50/30 to-white" />
        <div className="absolute top-10 -right-32 w-72 sm:w-[500px] h-72 sm:h-[500px] bg-red-100/40 rounded-full blur-3xl" />
        <div className="absolute bottom-0 -left-32 w-60 sm:w-[400px] h-60 sm:h-[400px] bg-red-50/50 rounded-full blur-3xl" />

        <div className="relative w-full max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }} className="text-center lg:text-left">
              {/* Breadcrumb */}
              <nav className="flex items-center gap-2 text-xs text-gray-400 mb-4 justify-center lg:justify-start" aria-label="Breadcrumb">
                <Link to="/" className="hover:text-red-500 transition-colors">Inicio</Link>
                <span>/</span>
                <span className="text-gray-600 font-medium">{page.h1}</span>
              </nav>

              <div className="inline-flex items-center gap-2 bg-red-50 text-red-600 text-xs font-semibold px-4 py-2 rounded-full mb-5">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                Sin comisiones · 7 días gratis
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 leading-[1.1] tracking-tight">
                {page.h1.split('para')[0]}para{' '}
                <span className="bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent">
                  {page.h1.split('para ')[1]}
                </span>
              </h1>

              <p className="mt-5 text-base sm:text-lg text-gray-600 max-w-lg mx-auto lg:mx-0 leading-relaxed">
                {page.subtitle}
              </p>

              <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 px-6 py-4 sm:py-3.5 rounded-2xl sm:rounded-xl text-white font-bold text-base sm:text-sm shadow-lg shadow-red-500/25 hover:shadow-xl transition-all active:scale-[0.98] hover:-translate-y-0.5"
                  style={{ backgroundColor: BRAND }}
                >
                  Crear Mi Menú Gratis
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </Link>
                <Link
                  to="/demo"
                  className="inline-flex items-center justify-center gap-2 px-6 py-4 sm:py-3.5 rounded-2xl sm:rounded-xl bg-white text-gray-700 font-semibold text-base sm:text-sm border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all active:scale-[0.98]"
                >
                  Ver Demo
                </Link>
              </div>
            </motion.div>

            {/* Right - Large emoji + stats preview */}
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.3 }} className="flex justify-center order-first lg:order-last">
              <div className="relative">
                <div className="w-48 h-48 sm:w-64 sm:h-64 rounded-3xl bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center shadow-xl shadow-red-100/50">
                  <span className="text-7xl sm:text-9xl">{page.emoji}</span>
                </div>
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="hidden sm:flex absolute -right-4 top-8 bg-white rounded-2xl shadow-xl px-4 py-3 items-center gap-2 border border-gray-100"
                >
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-sm">✅</div>
                  <div>
                    <p className="text-[11px] font-bold text-gray-800">Nuevo pedido</p>
                    <p className="text-[10px] text-gray-500">hace 1 min</p>
                  </div>
                </motion.div>
                <motion.div
                  animate={{ y: [0, 8, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, delay: 1.5 }}
                  className="hidden sm:flex absolute -left-4 bottom-8 bg-white rounded-2xl shadow-xl px-4 py-3 items-center gap-2 border border-gray-100"
                >
                  <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-sm">⭐</div>
                  <div>
                    <p className="text-[11px] font-bold text-gray-800">5 estrellas</p>
                    <p className="text-[10px] text-gray-500">reseña nueva</p>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ STATS ═══ */}
      <section className="relative py-12 sm:py-16 overflow-hidden" style={{ background: 'linear-gradient(135deg, #E31E24 0%, #b81a1f 100%)' }}>
        <div className="relative max-w-5xl mx-auto px-5 sm:px-6 grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
          {page.stats.map((s, i) => <StatCard key={i} {...s} />)}
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <Section className="py-16 sm:py-20 lg:py-28 bg-white" id="features">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-16">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-red-500">Funcionalidades</span>
            <h2 className="mt-3 text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900">
              Todo lo que Necesitas para tu {page.h1.split('para ')[1]}
            </h2>
            <p className="mt-3 text-sm sm:text-base text-gray-500">
              Herramientas profesionales diseñadas para {page.keyword}. Sin comisiones, sin contratos.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {page.features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="group bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 hover:border-red-100 hover:shadow-lg hover:shadow-red-50 transition-all"
              >
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-red-50 flex items-center justify-center text-lg sm:text-xl mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                  {f.icon}
                </div>
                <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-1.5">{f.title}</h3>
                <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ═══ USE CASES ═══ */}
      <Section className="py-16 sm:py-20 lg:py-28 bg-gray-50" id="use-cases">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-12">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-red-500">Casos de uso</span>
            <h2 className="mt-3 text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900">
              ¿Para Quién es Menuby?
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {page.useCases.map((uc, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="flex items-start gap-3 bg-white rounded-xl border border-gray-100 p-5"
              >
                <Check />
                <p className="text-sm text-gray-700 leading-relaxed">{uc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ═══ PRICING MINI ═══ */}
      <Section className="py-16 sm:py-20 lg:py-28 bg-white" id="pricing">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 text-center">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-red-500">Precio</span>
          <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold text-gray-900 mb-2">
            {page.keyword.charAt(0).toUpperCase() + page.keyword.slice(1)} con planes desde Gratis
          </h2>
          <p className="text-sm text-gray-500 mb-8">Elige entre Gratis, Starter, Pro o Pro Max y escala sin comisiones por pedido.</p>

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 text-left">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Gratis</p>
              <p className="mt-1 text-3xl font-extrabold text-gray-900">$0</p>
              <p className="text-xs text-gray-500">siempre</p>
              <p className="mt-3 text-xs text-gray-600">20 productos · 30 pedidos/mes · 5 mesas · 1 usuario</p>
            </div>

            <div className="bg-white rounded-2xl border border-red-200 p-5 shadow-lg shadow-red-100/50">
              <p className="text-xs font-bold uppercase tracking-wide text-red-500">Starter</p>
              <p className="mt-1 text-3xl font-extrabold text-gray-900">$39.900</p>
              <p className="text-xs text-gray-500">/mes · anual $34.900/mes</p>
              <p className="mt-3 text-xs text-gray-600">60 productos · 350 pedidos/mes · 15 mesas · 3 usuarios · verificado rojo en menu</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-900/20 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-700">Pro</p>
              <p className="mt-1 text-3xl font-extrabold text-gray-900">$59.900</p>
              <p className="text-xs text-gray-500">/mes · anual $49.900/mes</p>
              <p className="mt-3 text-xs text-gray-600">Ilimitado en todo · reservas + IA · verificado azul en menu</p>
            </div>

            <div className="bg-white rounded-2xl border border-amber-300 p-5 shadow-lg shadow-amber-100/60">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Pro Max</p>
              <p className="mt-1 text-3xl font-extrabold text-gray-900">$89.900</p>
              <p className="text-xs text-gray-500">/mes · anual $74.900/mes</p>
              <p className="mt-3 text-xs text-gray-600">Ilimitado en todo · eventos exclusivos · tutoriales premium · acceso anticipado · verificado dorado en menu</p>
            </div>
          </div>

          <div className="mt-7">
            <Link
              to="/register"
              className="inline-flex w-full sm:w-auto justify-center px-8 py-4 rounded-2xl sm:rounded-xl text-white font-bold shadow-lg shadow-red-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all"
              style={{ backgroundColor: BRAND }}
            >
              Empezar Gratis →
            </Link>
            <p className="text-center text-xs text-gray-400 mt-3">Sin compromisos · Cancela cuando quieras</p>
          </div>
        </div>
      </Section>

      {/* ═══ FAQ ═══ */}
      <Section className="py-16 sm:py-20 lg:py-28 bg-gray-50" id="faq">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-12">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-red-500">FAQ</span>
            <h2 className="mt-3 text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900">
              Preguntas Frecuentes — {page.h1}
            </h2>
          </div>
          <FAQAccordion items={page.faq} />
          {/* Inject FAQ schema */}
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
        </div>
      </Section>

      {/* ═══ LONG-FORM SEO CONTENT ═══ */}
      <Section className="py-16 sm:py-20 lg:py-28 bg-white">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 lg:px-8">
          <article className="prose prose-lg max-w-none text-gray-600 prose-headings:text-gray-900 prose-strong:text-gray-800 prose-a:text-red-500 prose-a:font-bold hover:prose-a:text-red-600">
            <div dangerouslySetInnerHTML={{ __html: markdownToHtml(page.longContent) }} />
            <p className="mt-8">
              <Link to="/register" className="text-red-500 font-bold hover:text-red-600 transition-colors">
                Crea tu {page.keyword} gratis →
              </Link>
              {' '}o conoce todas nuestras{' '}
              <Link to="/features" className="text-red-500 font-bold hover:text-red-600 transition-colors">
                funcionalidades
              </Link>.
            </p>
          </article>
        </div>
      </Section>

      {/* ═══ RELATED NICHES ═══ */}
      <Section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-red-500">Soluciones</span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold text-gray-900">
              Menú Digital para Otros Tipos de Negocio
            </h2>
          </div>
          <RelatedNiches currentSlug={page.slug} />
        </div>
      </Section>

      {/* ═══ CTA ═══ */}
      <section className="relative py-16 sm:py-20 bg-gray-900 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-3xl mx-auto px-5 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white leading-tight">
            ¿Listo para digitalizar tu{' '}
            <span className="bg-gradient-to-r from-red-400 to-red-500 bg-clip-text text-transparent">
              {page.h1.split('para ')[1]?.toLowerCase() || 'negocio'}
            </span>?
          </h2>
          <p className="mt-4 text-gray-400 text-base sm:text-lg max-w-xl mx-auto">
            Empieza gratis hoy. Crea tu {page.keyword} en 5 minutos con Menuby.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl sm:rounded-xl text-white font-bold shadow-lg shadow-red-500/30 hover:shadow-xl transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: BRAND }}
            >
              Crear Mi Menú Gratis
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>
            <a
              href="https://wa.me/573028181520?text=Hola%2C%20quiero%20saber%20m%C3%A1s%20sobre%20Menuby"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl sm:rounded-xl bg-white/10 text-white font-semibold backdrop-blur-sm border border-white/10 hover:bg-white/20 transition-all"
            >
              Hablar por WhatsApp
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ── Simple markdown → HTML (for longContent) ── */
function markdownToHtml(md) {
  if (!md) return '';
  let html = md.trim();
  // Tables
  html = html.replace(/\n\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)+)/g, (_, header, rows) => {
    const ths = header.split('|').filter(Boolean).map(h => `<th class="border border-gray-200 px-3 py-2 bg-gray-50 text-left text-xs font-bold text-gray-700">${h.trim()}</th>`).join('');
    const trs = rows.trim().split('\n').map(row => {
      const tds = row.split('|').filter(Boolean).map(c => `<td class="border border-gray-200 px-3 py-2 text-sm">${c.trim()}</td>`).join('');
      return `<tr>${tds}</tr>`;
    }).join('');
    return `<div class="overflow-x-auto my-6"><table class="w-full border-collapse border border-gray-200 rounded-lg text-sm"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`;
  });
  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-xl font-bold text-gray-900 mt-10 mb-4">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-2xl font-extrabold text-gray-900 mb-6">$1</h2>');
  // Lists
  html = html.replace(/^- \*\*(.+?)\*\*: (.+)$/gm, '<li><strong>$1:</strong> $2</li>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul class="space-y-2 my-4 list-disc pl-5">${match}</ul>`);
  // Numbered lists
  html = html.replace(/^\d+\. \*\*(.+?)\*\* — (.+)$/gm, '<li><strong>$1</strong> — $2</li>');
  html = html.replace(/^\d+\. \*\*(.+?)\*\*(.+)$/gm, '<li><strong>$1</strong>$2</li>');
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Paragraphs
  html = html.replace(/^(?!<[hluotd])(.+)$/gm, (match) => {
    if (match.trim() && !match.startsWith('<')) return `<p>${match.trim()}</p>`;
    return match;
  });
  return html;
}
