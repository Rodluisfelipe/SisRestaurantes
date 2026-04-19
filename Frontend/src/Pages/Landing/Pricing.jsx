import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import useLandingSEO from '../../hooks/useLandingSEO';
import './pricing-pro.css';

const PLAN_DATA = [
  {
    id: 'free',
    name: 'Gratis',
    tag: 'Comienza sin costo',
    persona: 'Ideal para validar tu menu digital sin riesgo',
    level: 28,
    verifiedMenuBadge: null,
    monthly: 0,
    annualMonthly: 0,
    annualTotal: 0,
    recommended: false,
    capacity: ['20 productos', '5 categorias', '30 pedidos/mes', '5 mesas', '1 usuario'],
    stack: ['Menu QR', 'Carrito basico', 'Logo y portada', '1 zona de entrega', 'Resenas', 'Google OAuth'],
    extras: ['Autoprint: 1 impresora', 'Lealtad: puntos basicos sin tiers'],
  },
  {
    id: 'starter',
    name: 'Starter',
    tag: 'Mas vendido',
    persona: 'Ideal para crecer con automatizacion real',
    level: 64,
    verifiedMenuBadge: 'Rojo',
    monthly: 39900,
    annualMonthly: 34900,
    annualTotal: 418800,
    recommended: true,
    capacity: ['60 productos', '12 categorias', '350 pedidos/mes', '15 mesas', '3 usuarios'],
    stack: ['Todo Gratis + push notifications', 'Zonas de entrega ilimitadas', 'Toppings/extras', '3 cupones', '1 banner', 'KDS basico'],
    extras: ['Autoprint: 2 impresoras', 'Lealtad: puntos + recompensas canjeables'],
  },
  {
    id: 'pro',
    name: 'Pro',
    tag: 'Escala completa',
    persona: 'Ideal para operaciones exigentes y multi-equipo',
    level: 82,
    verifiedMenuBadge: 'Azul',
    monthly: 59900,
    annualMonthly: 49900,
    annualTotal: 598800,
    recommended: false,
    capacity: ['Ilimitado en todo'],
    stack: ['Todo Starter + pedidos ilimitados', 'Reservas y recordatorios automaticos', 'Tiers de lealtad', 'Cupones ilimitados', '3 banners', 'Carritos abandonados'],
    extras: ['Analytics completo', 'IA', 'Autoprint: impresoras ilimitadas', 'Lealtad: tiers completos'],
  },
  {
    id: 'pro_max',
    name: 'Pro Max',
    tag: 'Nivel enterprise',
    persona: 'Ideal para marcas con alto volumen y atencion prioritaria',
    level: 100,
    verifiedMenuBadge: 'Dorado',
    monthly: 89900,
    annualMonthly: 74900,
    annualTotal: 898800,
    recommended: false,
    capacity: ['Ilimitado en todo'],
    stack: ['Todo Pro + soporte prioritario', 'Acceso a eventos exclusivos', 'Tutoriales premium', 'Nuevas funciones con acceso anticipado'],
    extras: ['Distintivo verificado dorado', 'Autoprint: impresoras ilimitadas', 'IA avanzada', 'Operacion multi-equipo sin limite'],
  },
];

const PLAN_TONE = {
  free: {
    mark: 'FREE',
    emblem: 'FR',
    cardClass: 'plan-free',
    badgeClass: 'plan-badge-free',
    ctaClass: 'plan-cta-free',
  },
  starter: {
    mark: 'START',
    emblem: 'ST',
    cardClass: 'plan-starter',
    badgeClass: 'plan-badge-starter',
    ctaClass: 'plan-cta-starter',
  },
  pro: {
    mark: 'PRO',
    emblem: 'PR',
    cardClass: 'plan-pro',
    badgeClass: 'plan-badge-pro',
    ctaClass: 'plan-cta-pro',
  },
  pro_max: {
    mark: 'MAX',
    emblem: 'MX',
    cardClass: 'plan-pro-max',
    badgeClass: 'plan-badge-pro-max',
    ctaClass: 'plan-cta-pro-max',
  },
};

const TRUST_STATS = [
  { label: 'Negocios activos', value: '+500' },
  { label: 'Comision por pedido', value: '0%' },
  { label: 'Tiempo de setup', value: '5 min' },
  { label: 'Soporte', value: 'WhatsApp' },
];

const COMPARISON_ROWS = [
  { label: 'Productos', free: '20', starter: '60', pro: 'Ilimitado', proMax: 'Ilimitado' },
  { label: 'Pedidos por mes', free: '30', starter: '350', pro: 'Ilimitado', proMax: 'Ilimitado' },
  { label: 'Mesas', free: '5', starter: '15', pro: 'Ilimitado', proMax: 'Ilimitado' },
  { label: 'Usuarios de staff', free: '1', starter: '3', pro: 'Ilimitado', proMax: 'Ilimitado' },
  { label: 'Reservas', free: 'No', starter: 'No', pro: 'Si', proMax: 'Si' },
  { label: 'Herramientas IA', free: 'No', starter: 'No', pro: 'Si', proMax: 'Si' },
  { label: 'Autoprint', free: '1 impresora', starter: '2 impresoras', pro: 'Ilimitado', proMax: 'Ilimitado' },
  { label: 'Soporte prioritario', free: 'No', starter: 'No', pro: 'No', proMax: 'Si' },
  { label: 'Eventos exclusivos', free: 'No', starter: 'No', pro: 'No', proMax: 'Si' },
  { label: 'Tutoriales premium', free: 'No', starter: 'No', pro: 'No', proMax: 'Si' },
  { label: 'Acceso anticipado a funciones', free: 'No', starter: 'No', pro: 'No', proMax: 'Si' },
  { label: 'Verificado en menu', free: 'No', starter: 'Rojo', pro: 'Azul', proMax: 'Dorado' },
];

const BENEFITS = [
  { metric: '+40%', title: 'Aumento en ventas', desc: 'Los menus digitales elevan el ticket promedio con menos friccion.' },
  { metric: '5 min', title: 'Setup real', desc: 'Registro, carga de menu y QR listos el mismo dia.' },
  { metric: '1 mes', title: 'ROI temprano', desc: 'La inversion se recupera rapido con pedidos directos.' },
  { metric: '0%', title: 'Sin comisiones', desc: 'Tarifa fija mensual, sin castigo por crecer.' },
];

const COP_FORMATTER = new Intl.NumberFormat('es-CO');

const formatCOP = (value) => `$${COP_FORMATTER.format(value)}`;

const featureBadgeClass = (value) => (
  value === 'Si'
    ? 'bg-emerald-500/15 text-emerald-700 border-emerald-300/60'
    : value === 'No'
      ? 'bg-slate-300/20 text-slate-600 border-slate-300/70'
      : 'bg-slate-100 text-slate-700 border-slate-200'
);

const Pricing = () => {
  const [billingCycle, setBillingCycle] = useState('monthly');

  useLandingSEO({
    title: 'Precios Menú Digital - Gratis, Starter, Pro y Pro Max | Menuby Colombia',
    description: 'Planes para restaurantes desde $0. Gratis, Starter, Pro y Pro Max con límites claros, anualidades con descuento y escalamiento sin comisiones por pedido.',
    canonical: '/pricing',
    keywords: 'planes menú digital, precio menú digital colombia, software restaurantes planes, menú QR gratis, plataforma restaurantes precio',
  });

  const plans = useMemo(() => {
    return PLAN_DATA.map((plan) => {
      const pricePerMonth = billingCycle === 'annual' ? plan.annualMonthly : plan.monthly;
      const annualSavings = plan.id === 'free' ? 0 : (plan.monthly * 12) - plan.annualTotal;

      return {
        ...plan,
        priceLabel: formatCOP(pricePerMonth),
        periodLabel: plan.id === 'free'
          ? 'siempre'
          : billingCycle === 'annual'
            ? '/mes (facturado anual)'
            : '/mes',
        annualInfo: plan.id === 'free' ? null : `Total anual ${formatCOP(plan.annualTotal)}`,
        savingsInfo: annualSavings > 0 ? `Ahorras ${formatCOP(annualSavings)} al ano` : null,
      };
    });
  }, [billingCycle]);

  return (
    <div className="pricing-pro-page pricing-body min-h-screen overflow-x-hidden text-[#10131A]">
      {/* Hero */}
      <section className="pricing-hero relative isolate pt-24 sm:pt-28 pb-14 sm:pb-20">
        <div className="pricing-hero-noise absolute inset-0 pointer-events-none" aria-hidden="true" />
        <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-3xl"
          >
            <div className="inline-flex items-center gap-2 bg-white/80 border border-white/70 text-[#A31A1E] text-[11px] sm:text-xs font-bold tracking-[0.18em] uppercase px-4 py-2 rounded-full mb-5 sm:mb-7">
              Pricing MenuBy 2026
            </div>
            <h1 className="pricing-display text-4xl sm:text-5xl lg:text-6xl leading-[0.95] text-[#11131A] mb-5">
              Planes MenuBy: Gratis, Starter, Pro y Pro Max
            </h1>
            <p className="text-base sm:text-lg text-slate-700 max-w-2xl leading-relaxed">
              Empieza gratis y sube de nivel cuando tu operación crezca. Sin comisiones por pedido y con opción anual más económica.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 sm:mt-10">
              {TRUST_STATS.map((stat) => (
                <div key={stat.label} className="bg-white/70 border border-white rounded-2xl px-3 py-3 sm:px-4 backdrop-blur-sm">
                  <p className="text-lg sm:text-2xl font-extrabold text-[#10131A] tracking-tight">{stat.value}</p>
                  <p className="text-[10px] sm:text-[11px] text-slate-600 uppercase tracking-[0.12em] mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-14 sm:pb-20">
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <div className="flex justify-center mb-8 sm:mb-10">
            <div className="inline-flex bg-white border border-slate-200 rounded-2xl p-1.5 shadow-[0_8px_30px_rgba(15,23,42,0.08)]">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${billingCycle === 'monthly' ? 'bg-[#10131A] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Mensual
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${billingCycle === 'annual' ? 'bg-[#10131A] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Anual
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6 lg:gap-7 items-stretch">
            {plans.map((plan, index) => {
              const tone = PLAN_TONE[plan.id];

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.08 * index }}
                  className={`pricing-plan-card ${tone.cardClass} relative rounded-3xl border p-6 sm:p-7 ${plan.recommended ? 'recommended md:-mt-4 md:scale-[1.03]' : ''}`}
                >
                  <div className="plan-noise" aria-hidden="true" />
                  <div className="plan-watermark" aria-hidden="true">{tone.mark}</div>

                  <div className="relative z-[2]">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`plan-badge ${tone.badgeClass}`}>{plan.tag}</span>
                      <span className="plan-emblem">{tone.emblem}</span>
                    </div>

                    <div className="mt-4 mb-5">
                      <h2 className="pricing-display text-3xl sm:text-[2rem] leading-none">{plan.name}</h2>
                      <p className="plan-persona mt-1.5 text-xs sm:text-sm">{plan.persona}</p>
                      {plan.verifiedMenuBadge && (
                        <div className="plan-verified-chip mt-2">
                          <span className="plan-verified-dot" />
                          <span>Verificado en menu: {plan.verifiedMenuBadge}</span>
                        </div>
                      )}

                      <div className="mt-3 flex items-end gap-2">
                        <span className="text-4xl sm:text-5xl font-black tracking-tight">{plan.priceLabel}</span>
                        <span className="plan-period text-xs sm:text-sm pb-1">{plan.periodLabel}</span>
                      </div>

                      {plan.annualInfo && <p className="plan-annual mt-2 text-xs">{plan.annualInfo}</p>}
                      {billingCycle === 'annual' && plan.savingsInfo && <p className="plan-saving mt-1 text-xs font-semibold">{plan.savingsInfo}</p>}
                    </div>

                    <div className="plan-level-box rounded-2xl border p-3 sm:p-4">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em]">
                        <span>Potencia operativa</span>
                        <span>{plan.level}%</span>
                      </div>
                      <div className="plan-level-track mt-2.5 h-2 rounded-full overflow-hidden">
                        <span className="plan-level-fill h-full block rounded-full" style={{ width: `${plan.level}%` }} />
                      </div>
                    </div>

                    <div className="plan-capacity-box rounded-2xl border p-3 sm:p-4 mt-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] mb-2">Capacidad incluida</p>
                      <div className="space-y-1.5">
                        {plan.capacity.map((item) => (
                          <div key={item} className="text-xs sm:text-sm rounded-lg px-2.5 py-1.5 border plan-capacity-item">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-5">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] mb-2">Funciones destacadas</p>
                      <ul className="space-y-2">
                        {plan.stack.map((feature) => (
                          <li key={feature} className="plan-feature-item text-xs sm:text-sm leading-relaxed flex items-start gap-2.5">
                            <span className="plan-dot mt-1.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-5 border-t pt-4 space-y-1.5 plan-extras">
                      {plan.extras.map((extra) => (
                        <p key={extra} className="text-xs">{extra}</p>
                      ))}
                    </div>

                    <Link to="/register" className={`plan-cta mt-6 block w-full text-center py-3.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98] ${tone.ctaClass}`}>
                      {plan.id === 'free' ? 'Crear Cuenta Gratis' : 'Elegir Plan'}
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="pb-12 sm:pb-16">
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
            <div className="px-5 py-5 sm:px-8 sm:py-6 border-b border-slate-200 bg-slate-50/70">
              <h3 className="pricing-display text-2xl sm:text-3xl">Comparativa instantanea</h3>
              <p className="text-sm text-slate-600 mt-1">Misma plataforma, distinta profundidad operativa.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px]">
                <thead>
                  <tr className="text-left border-b border-slate-200">
                    <th className="px-5 sm:px-8 py-4 text-xs uppercase tracking-[0.12em] text-slate-500">Caracteristica</th>
                    <th className="px-5 py-4 text-xs uppercase tracking-[0.12em] text-slate-500">Gratis</th>
                    <th className="px-5 py-4 text-xs uppercase tracking-[0.12em] text-slate-500">Starter</th>
                    <th className="px-5 sm:px-8 py-4 text-xs uppercase tracking-[0.12em] text-slate-500">Pro</th>
                    <th className="px-5 sm:px-8 py-4 text-xs uppercase tracking-[0.12em] text-slate-500">Pro Max</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row) => (
                    <tr key={row.label} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-5 sm:px-8 py-4 text-sm font-semibold text-slate-700">{row.label}</td>
                      <td className="px-5 py-4"><span className={`inline-flex px-2.5 py-1 rounded-full border text-xs font-semibold ${featureBadgeClass(row.free)}`}>{row.free}</span></td>
                      <td className="px-5 py-4"><span className={`inline-flex px-2.5 py-1 rounded-full border text-xs font-semibold ${featureBadgeClass(row.starter)}`}>{row.starter}</span></td>
                      <td className="px-5 sm:px-8 py-4"><span className={`inline-flex px-2.5 py-1 rounded-full border text-xs font-semibold ${featureBadgeClass(row.pro)}`}>{row.pro}</span></td>
                      <td className="px-5 sm:px-8 py-4"><span className={`inline-flex px-2.5 py-1 rounded-full border text-xs font-semibold ${featureBadgeClass(row.proMax)}`}>{row.proMax}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-12 sm:py-16 bg-[#F2EFE8] border-y border-black/5">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 lg:px-8">
          <h2 className="pricing-display text-3xl sm:text-4xl text-[#11131A] text-center mb-8 sm:mb-12">Beneficios comprobados</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {BENEFITS.map((b, i) => (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 text-center shadow-[0_8px_20px_rgba(15,23,42,0.06)]"
              >
                <div className="text-2xl sm:text-3xl font-black text-[#11131A] mb-2 sm:mb-3">{b.metric}</div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 mb-1">{b.title}</h3>
                <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed">{b.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20">
        <div className="max-w-2xl mx-auto px-5 sm:px-6 text-center">
          <div className="bg-[#11131A] text-white rounded-3xl px-6 py-8 sm:px-10 sm:py-10 shadow-[0_24px_50px_rgba(15,23,42,0.25)]">
            <h2 className="pricing-display text-3xl sm:text-4xl mb-3">¿Tienes dudas?</h2>
            <p className="text-sm sm:text-base text-slate-300 mb-6 sm:mb-8">Escribenos por WhatsApp y te ayudamos a elegir el plan correcto para tu operacion.</p>
            <a
              href="https://wa.me/573028181520?text=Hola%2C%20quiero%20saber%20mas%20sobre%20MenuBy"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-7 py-4 sm:py-3.5 rounded-2xl sm:rounded-xl bg-[#E31E24] text-white font-bold text-base sm:text-sm shadow-[0_16px_30px_rgba(227,30,36,0.35)] hover:-translate-y-0.5 transition-all active:scale-[0.98]"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
              Hablar con Ventas
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Pricing;
