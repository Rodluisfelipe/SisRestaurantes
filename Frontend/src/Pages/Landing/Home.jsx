import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, useScroll, useTransform, AnimatePresence } from 'framer-motion';

/* ─── Animated Counter Hook ─── */
const useCounter = (end, duration = 2000, inView = false) => {
  const [count, setCount] = useState(0);
  const numericEnd = parseInt(String(end).replace(/[^0-9]/g, ''), 10) || 0;

  useEffect(() => {
    if (!inView) return;
    let startTime = null;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * numericEnd));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, numericEnd, duration]);

  return count;
};

/* ─── Floating Phone Mockup ─── */
const PhoneMockup = () => (
  <div className="relative mx-auto w-[260px] h-[520px] md:w-[280px] md:h-[560px]">
    {/* Phone frame */}
    <div className="absolute inset-0 bg-gray-900 rounded-[3rem] shadow-2xl shadow-red-500/20 border-4 border-gray-800 overflow-hidden">
      {/* Notch */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-gray-900 rounded-b-2xl z-20" />
      {/* Screen */}
      <div className="absolute inset-2 rounded-[2.5rem] overflow-hidden bg-white">
        {/* Status bar */}
        <div className="h-10 bg-red-500 flex items-end justify-center pb-1">
          <span className="text-[10px] text-white/90 font-medium">menuby.tech</span>
        </div>
        {/* App content mockup */}
        <div className="p-3">
          {/* Search bar */}
          <div className="bg-gray-100 rounded-xl px-3 py-2 mb-3 flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-gray-300" />
            <div className="h-2 bg-gray-300 rounded-full flex-1" />
          </div>
          {/* Categories */}
          <div className="flex gap-2 mb-3 overflow-hidden">
            {['🍔', '🍕', '🌮', '🍣'].map((e, i) => (
              <div key={i} className={`flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-lg ${i === 0 ? 'bg-red-500 text-white' : 'bg-gray-100'}`}>
                {e}
              </div>
            ))}
          </div>
          {/* Restaurant cards */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="mb-2.5 rounded-xl overflow-hidden shadow-sm border border-gray-100">
              <div className={`h-16 ${i === 1 ? 'bg-gradient-to-r from-red-400 to-red-500' : i === 2 ? 'bg-gradient-to-r from-amber-400 to-orange-400' : 'bg-gradient-to-r from-emerald-400 to-teal-400'}`} />
              <div className="p-2">
                <div className="h-2 bg-gray-200 rounded-full w-3/4 mb-1.5" />
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <div className="h-1.5 bg-gray-100 rounded-full w-8" />
                  <div className="h-1.5 bg-gray-100 rounded-full w-12 ml-auto" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    {/* Floating elements around phone */}
    <motion.div
      animate={{ y: [-8, 8, -8] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      className="absolute -top-4 -right-8 bg-white rounded-2xl shadow-xl p-3 border border-gray-100"
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        </div>
        <div>
          <div className="text-[10px] font-bold text-gray-900">Nuevo pedido</div>
          <div className="text-[9px] text-gray-500">Mesa 5 - $45,000</div>
        </div>
      </div>
    </motion.div>
    <motion.div
      animate={{ y: [6, -6, 6] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      className="absolute -bottom-2 -left-10 bg-white rounded-2xl shadow-xl p-3 border border-gray-100"
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-sm">📈</div>
        <div>
          <div className="text-[10px] font-bold text-gray-900">+45% ventas</div>
          <div className="text-[9px] text-green-600 font-medium">Este mes</div>
        </div>
      </div>
    </motion.div>
    <motion.div
      animate={{ y: [-5, 5, -5] }}
      transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      className="absolute top-1/3 -left-12 bg-white rounded-full shadow-lg p-2 border border-gray-100"
    >
      <span className="text-lg">⭐</span>
    </motion.div>
  </div>
);

/* ─── Stat Card with Counter ─── */
const StatCard = ({ icon, value, suffix, label, inView, delay }) => {
  const count = useCounter(value, 2000, inView);
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay }}
      className="text-center"
    >
      <div className="w-14 h-14 mx-auto mb-4 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center text-2xl">
        {icon}
      </div>
      <div className="text-4xl md:text-5xl font-black text-white mb-1">
        {suffix === '%' && value === '0' ? '0' : count}{suffix}
      </div>
      <div className="text-sm text-red-100 font-medium">{label}</div>
    </motion.div>
  );
};

const Home = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const heroRef = useRef(null);
  const featuresRef = useRef(null);
  const howItWorksRef = useRef(null);
  const statsRef = useRef(null);
  const testimonialsRef = useRef(null);
  const pricingRef = useRef(null);

  const isHeroInView = useInView(heroRef, { once: true, amount: 0.2 });
  const isFeaturesInView = useInView(featuresRef, { once: true, amount: 0.15 });
  const isHowItWorksInView = useInView(howItWorksRef, { once: true, amount: 0.2 });
  const isStatsInView = useInView(statsRef, { once: true, amount: 0.3 });
  const isTestimonialsInView = useInView(testimonialsRef, { once: true, amount: 0.15 });
  const isPricingInView = useInView(pricingRef, { once: true, amount: 0.2 });

  const { scrollYProgress } = useScroll();
  const heroParallax = useTransform(scrollYProgress, [0, 0.3], ["0%", "15%"]);

  useEffect(() => { setIsLoaded(true); }, []);

  /* ─── Data ─── */
  const features = [
    {
      icon: "📱",
      title: "Menú Digital QR",
      description: "Menús interactivos con fotos HD, descripciones y precios actualizados al instante. Escanea y ordena.",
      color: "from-red-500 to-rose-600",
      lightColor: "bg-red-50",
    },
    {
      icon: "🛒",
      title: "Pedidos Directos",
      description: "Sin intermediarios ni comisiones. Tus clientes ordenan desde la mesa directo a tu cocina.",
      color: "from-orange-500 to-amber-600",
      lightColor: "bg-orange-50",
    },
    {
      icon: "📊",
      title: "Analytics Inteligente",
      description: "Dashboard completo con métricas de ventas, productos estrella y tendencias en tiempo real.",
      color: "from-violet-500 to-purple-600",
      lightColor: "bg-violet-50",
    },
    {
      icon: "👨‍🍳",
      title: "Pantalla de Cocina",
      description: "Sistema KDS dedicado: órdenes organizadas, tiempos de preparación y alertas automáticas.",
      color: "from-emerald-500 to-teal-600",
      lightColor: "bg-emerald-50",
    },
    {
      icon: "⚡",
      title: "Setup en 5 Minutos",
      description: "Configura tu menú digital completo en minutos. Sin técnicos, sin complicaciones.",
      color: "from-blue-500 to-cyan-600",
      lightColor: "bg-blue-50",
    },
    {
      icon: "🔒",
      title: "Seguridad Total",
      description: "Datos encriptados, backups automáticos y cumplimiento con estándares de seguridad.",
      color: "from-slate-600 to-gray-700",
      lightColor: "bg-gray-50",
    },
  ];

  const steps = [
    {
      num: "01",
      title: "Regístrate Gratis",
      description: "Crea tu cuenta en 30 segundos. Sin tarjeta de crédito, sin compromisos.",
      icon: "✨",
    },
    {
      num: "02",
      title: "Sube tu Menú",
      description: "Agrega tus platos con fotos y precios. Nuestra IA te ayuda a optimizar las descripciones.",
      icon: "📸",
    },
    {
      num: "03",
      title: "Recibe Pedidos",
      description: "Comparte tu QR y empieza a recibir pedidos directos al instante. ¡Así de fácil!",
      icon: "🚀",
    },
  ];

  const stats = [
    { icon: "🏪", value: "500", suffix: "+", label: "Restaurantes activos" },
    { icon: "📈", value: "40", suffix: "%", label: "Aumento en ventas" },
    { icon: "⏱️", value: "5", suffix: " min", label: "Tiempo de setup" },
    { icon: "💰", value: "0", suffix: "%", label: "Comisiones" },
  ];

  const testimonials = [
    {
      name: "María González",
      role: "Propietaria",
      restaurant: "Restaurante El Buen Sabor",
      content: "En solo 2 semanas aumentamos nuestras ventas un 45%. Los clientes están fascinados con el menú digital. Es la mejor inversión que hemos hecho.",
      rating: 5,
      metric: "+45% ventas",
    },
    {
      name: "Carlos Rodríguez",
      role: "Gerente",
      restaurant: "Café Central",
      content: "Antes perdíamos clientes por las largas esperas. Ahora los pedidos llegan directo a la cocina. Nuestros ingresos se dispararon y el servicio mejoró.",
      rating: 5,
      metric: "-60% esperas",
    },
    {
      name: "Ana Martínez",
      role: "Chef Ejecutiva",
      restaurant: "Bistro Moderno",
      content: "La facilidad de actualizar precios y agregar productos es increíble. Sin comisiones ocultas, todo transparente. Lo recomiendo al 100%.",
      rating: 5,
      metric: "100% satisfecha",
    },
  ];

  const pricingFeatures = [
    "Menú digital ilimitado",
    "Códigos QR para todas las mesas",
    "Pedidos en tiempo real",
    "Pantalla de cocina dedicada",
    "Analytics y reportes",
    "Soporte técnico 24/7",
    "Actualizaciones automáticas",
    "Backup de datos diario",
  ];

  const fadeUp = {
    hidden: { opacity: 0, y: 40 },
    visible: (i = 0) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, delay: i * 0.1, ease: [0.25, 0.1, 0.25, 1] },
    }),
  };

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ═══════════════════════════════════════════
          HERO SECTION
      ═══════════════════════════════════════════ */}
      <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden pt-20 pb-12">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-white via-red-50/60 to-white" />
        <motion.div style={{ y: heroParallax }} className="absolute inset-0 z-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-red-200/40 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-red-100/50 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-red-100/30 to-transparent rounded-full" />
        </motion.div>
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #E31E24 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            {/* Left: Text content */}
            <div className="text-center lg:text-left max-w-2xl mx-auto lg:mx-0">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={isHeroInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6 }}
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-200 rounded-full text-sm font-semibold text-red-700 mb-6">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
                  </span>
                  +500 restaurantes ya confían en nosotros
                </div>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={isHeroInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.7, delay: 0.15 }}
                className="text-4xl sm:text-5xl md:text-6xl lg:text-[3.5rem] xl:text-6xl font-black text-gray-900 leading-[1.1] mb-6"
              >
                Tu restaurante,{' '}
                <span className="relative">
                  <span className="bg-gradient-to-r from-red-600 via-red-500 to-rose-500 bg-clip-text text-transparent">
                    10x más digital
                  </span>
                  <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
                    <path d="M2 8 C50 2, 100 2, 150 6 S250 2, 298 8" stroke="#E31E24" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
                  </svg>
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 30 }}
                animate={isHeroInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.7, delay: 0.3 }}
                className="text-lg md:text-xl text-gray-600 leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0"
              >
                Crea tu menú digital con QR en <strong className="text-gray-900">5 minutos</strong>, recibe pedidos directo en cocina y <strong className="text-gray-900">aumenta tus ventas hasta un 40%</strong>.{' '}
                <span className="text-red-600 font-semibold">Sin comisiones. Sin complicaciones.</span>
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={isHeroInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.7, delay: 0.45 }}
                className="flex flex-col sm:flex-row items-center gap-4 mb-8 justify-center lg:justify-start"
              >
                <Link
                  to="/register"
                  className="group relative w-full sm:w-auto px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl transition-all duration-300 shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30 hover:-translate-y-0.5 flex items-center justify-center gap-2 text-lg"
                >
                  Crear Mi Menú Gratis
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </Link>
                <Link
                  to="/demo"
                  className="group w-full sm:w-auto px-8 py-4 bg-white hover:bg-gray-50 text-gray-800 font-semibold rounded-2xl border-2 border-gray-200 hover:border-red-200 transition-all duration-300 hover:-translate-y-0.5 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  Ver Demo
                </Link>
              </motion.div>

              {/* Trust row */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={isHeroInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.8, delay: 0.7 }}
                className="flex items-center gap-4 justify-center lg:justify-start text-sm text-gray-500"
              >
                <div className="flex -space-x-2">
                  {['bg-red-400', 'bg-amber-400', 'bg-emerald-400', 'bg-blue-400'].map((bg, i) => (
                    <div key={i} className={`w-8 h-8 rounded-full ${bg} border-2 border-white flex items-center justify-center text-[10px] text-white font-bold`}>
                      {['MG', 'CR', 'AM', 'JL'][i]}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-0.5 text-amber-400">
                    {[...Array(5)].map((_, i) => <span key={i}>★</span>)}
                  </div>
                  <span className="text-gray-500 text-xs">500+ restaurantes satisfechos</span>
                </div>
              </motion.div>
            </div>

            {/* Right: Phone mockup */}
            <motion.div
              initial={{ opacity: 0, x: 60 }}
              animate={isHeroInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.9, delay: 0.3, ease: "easeOut" }}
              className="hidden lg:flex justify-center"
            >
              <PhoneMockup />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          BRAND MARQUEE
      ═══════════════════════════════════════════ */}
      <section className="py-8 border-y border-gray-100 bg-gray-50/50">
        <div className="container mx-auto px-4">
          <p className="text-center text-xs uppercase tracking-widest text-gray-400 font-semibold mb-6">
            Tecnología que impulsa restaurantes en toda Colombia
          </p>
          <div className="flex items-center justify-center gap-8 md:gap-16 flex-wrap opacity-40 grayscale">
            {['🍔 Hamburguesas', '🍕 Pizzerías', '🌮 Comida Mexicana', '🍣 Sushi', '☕ Cafeterías', '🥘 Comida Casera'].map((item, i) => (
              <span key={i} className="text-sm md:text-base font-semibold text-gray-600 whitespace-nowrap">{item}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          HOW IT WORKS
      ═══════════════════════════════════════════ */}
      <section ref={howItWorksRef} className="py-24 bg-white relative">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isHowItWorksInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7 }}
            className="text-center mb-20"
          >
            <span className="inline-block px-4 py-1.5 bg-red-50 text-red-600 text-sm font-bold rounded-full mb-4 uppercase tracking-wide">
              Súper fácil
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
              3 pasos y listo
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              No necesitas ser experto en tecnología. Si sabes usar WhatsApp, puedes usar Menuby.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 relative">
            {/* Connection line */}
            <div className="hidden md:block absolute top-20 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-red-200 via-red-300 to-red-200" />

            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                animate={isHowItWorksInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: i * 0.2 }}
                className="relative text-center"
              >
                {/* Number circle */}
                <div className="relative mx-auto mb-6">
                  <div className="w-20 h-20 mx-auto bg-gradient-to-br from-red-500 to-red-600 rounded-3xl flex items-center justify-center text-3xl shadow-lg shadow-red-500/20 rotate-3 hover:rotate-0 transition-transform duration-300">
                    {step.icon}
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-black">
                    {step.num}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-500 leading-relaxed max-w-xs mx-auto">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          FEATURES — BENTO GRID
      ═══════════════════════════════════════════ */}
      <section ref={featuresRef} className="py-24 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isFeaturesInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <span className="inline-block px-4 py-1.5 bg-red-50 text-red-600 text-sm font-bold rounded-full mb-4 uppercase tracking-wide">
              Todo incluido
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
              Todo lo que tu restaurante necesita
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Una plataforma completa para modernizar tu negocio y multiplicar tus ingresos.
            </p>
          </motion.div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                animate={isFeaturesInView ? "visible" : "hidden"}
                whileHover={{ y: -6, transition: { duration: 0.25 } }}
                className={`group relative bg-white rounded-3xl p-8 border border-gray-100 hover:border-red-100 shadow-sm hover:shadow-xl hover:shadow-red-500/5 transition-all duration-300 ${
                  i === 0 ? 'md:col-span-2 lg:col-span-1' : ''
                }`}
              >
                {/* Gradient accent on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-[0.03] rounded-3xl transition-opacity duration-300`} />

                <div className={`w-14 h-14 ${feature.lightColor} rounded-2xl flex items-center justify-center text-2xl mb-5 group-hover:scale-110 transition-transform duration-300`}>
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-500 leading-relaxed text-sm">{feature.description}</p>

                {/* Arrow link */}
                <div className="mt-4 flex items-center text-red-500 text-sm font-semibold opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                  Saber más
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          STATS — DARK RED SECTION
      ═══════════════════════════════════════════ */}
      <section ref={statsRef} className="relative py-24 bg-gradient-to-br from-red-600 via-red-700 to-red-800 overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-red-900/50 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isStatsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              Números que hablan solos
            </h2>
            <p className="text-lg text-red-100/80 max-w-2xl mx-auto">
              Resultados reales de restaurantes que ya usan Menuby
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            {stats.map((stat, i) => (
              <StatCard
                key={i}
                icon={stat.icon}
                value={stat.value}
                suffix={stat.suffix}
                label={stat.label}
                inView={isStatsInView}
                delay={i * 0.15}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          TESTIMONIALS
      ═══════════════════════════════════════════ */}
      <section ref={testimonialsRef} className="py-24 bg-white">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isTestimonialsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <span className="inline-block px-4 py-1.5 bg-red-50 text-red-600 text-sm font-bold rounded-full mb-4 uppercase tracking-wide">
              Testimonios
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
              Lo que dicen nuestros clientes
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Historias reales de restaurantes que transformaron su negocio
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                animate={isTestimonialsInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: i * 0.15 }}
                className="group relative bg-gray-50 hover:bg-white rounded-3xl p-8 border border-gray-100 hover:border-red-100 hover:shadow-xl hover:shadow-red-500/5 transition-all duration-300"
              >
                {/* Quote mark */}
                <div className="absolute top-6 right-6 text-5xl text-red-100 font-serif leading-none select-none">"</div>

                {/* Stars */}
                <div className="flex items-center gap-0.5 mb-4">
                  {[...Array(t.rating)].map((_, j) => (
                    <svg key={j} className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>

                {/* Content */}
                <p className="text-gray-600 leading-relaxed mb-6 relative z-10">
                  "{t.content}"
                </p>

                {/* Author */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                      {t.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 text-sm">{t.name}</div>
                      <div className="text-gray-400 text-xs">{t.role} · {t.restaurant}</div>
                    </div>
                  </div>
                  <div className="px-3 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full">
                    {t.metric}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          COMPARISON — WHY MENUBY
      ═══════════════════════════════════════════ */}
      <section className="py-24 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <span className="inline-block px-4 py-1.5 bg-red-50 text-red-600 text-sm font-bold rounded-full mb-4 uppercase tracking-wide">
              Compara
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
              ¿Por qué Menuby?
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Compara y descubre por qué somos la mejor opción para tu restaurante
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="max-w-3xl mx-auto"
          >
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-3 bg-gray-900 text-white">
                <div className="p-4 md:p-6 font-semibold text-sm md:text-base">Característica</div>
                <div className="p-4 md:p-6 text-center font-bold text-sm md:text-base">
                  <span className="text-red-400">Menuby</span>
                </div>
                <div className="p-4 md:p-6 text-center font-semibold text-gray-400 text-sm md:text-base">Otros</div>
              </div>
              {/* Rows */}
              {[
                ["Comisiones por pedido", "0%", "15-30%"],
                ["Tiempo de setup", "5 min", "2-4 semanas"],
                ["Soporte 24/7", true, false],
                ["Menú ilimitado", true, false],
                ["QR personalizado", true, false],
                ["Pantalla de cocina", true, false],
                ["Datos del cliente", "100% tuyos", "De la app"],
                ["Costo mensual", "$30,000", "$80,000+"],
              ].map(([feature, menuby, others], i) => (
                <div key={i} className={`grid grid-cols-3 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} border-b border-gray-100 last:border-0`}>
                  <div className="p-4 md:p-5 text-sm text-gray-700 font-medium">{feature}</div>
                  <div className="p-4 md:p-5 text-center">
                    {typeof menuby === 'boolean' ? (
                      menuby ? (
                        <span className="inline-flex w-7 h-7 bg-green-100 rounded-full items-center justify-center">
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </span>
                      ) : (
                        <span className="inline-flex w-7 h-7 bg-red-100 rounded-full items-center justify-center">
                          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                        </span>
                      )
                    ) : (
                      <span className="text-sm font-bold text-green-700">{menuby}</span>
                    )}
                  </div>
                  <div className="p-4 md:p-5 text-center">
                    {typeof others === 'boolean' ? (
                      others ? (
                        <span className="inline-flex w-7 h-7 bg-green-100 rounded-full items-center justify-center">
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </span>
                      ) : (
                        <span className="inline-flex w-7 h-7 bg-red-100 rounded-full items-center justify-center">
                          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                        </span>
                      )
                    ) : (
                      <span className="text-sm text-gray-400">{others}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          PRICING
      ═══════════════════════════════════════════ */}
      <section ref={pricingRef} className="py-24 bg-white relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isPricingInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <span className="inline-block px-4 py-1.5 bg-red-50 text-red-600 text-sm font-bold rounded-full mb-4 uppercase tracking-wide">
              Pricing
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
              Un plan. Todo incluido.
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Sin sorpresas, sin letra pequeña. Todo lo que necesitas por un precio justo.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={isPricingInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="max-w-lg mx-auto"
          >
            <div className="relative bg-white rounded-[2rem] border-2 border-red-100 shadow-2xl shadow-red-500/10 overflow-hidden">
              {/* Top banner */}
              <div className="bg-gradient-to-r from-red-600 to-red-500 px-8 py-4 text-center">
                <span className="text-white/80 text-sm font-medium">🔥 14 días gratis · Sin tarjeta de crédito</span>
              </div>

              <div className="p-8 md:p-10">
                {/* Price */}
                <div className="text-center mb-8">
                  <div className="text-sm text-gray-400 font-medium uppercase tracking-wide mb-2">Plan Completo</div>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-2xl text-gray-400 font-medium">$</span>
                    <span className="text-6xl md:text-7xl font-black text-gray-900">30,000</span>
                    <span className="text-gray-400 font-medium">/mes</span>
                  </div>
                  <p className="text-sm text-gray-400 mt-2">COP · Sin IVA · Sin costos ocultos</p>
                </div>

                {/* Features list */}
                <div className="space-y-3 mb-8">
                  {pricingFeatures.map((f, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <span className="text-gray-700 text-sm">{f}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <Link
                  to="/register"
                  className="group block w-full py-4 bg-gray-900 hover:bg-red-600 text-white font-bold rounded-2xl text-center transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-red-500/20 text-lg"
                >
                  Empezar Gratis
                  <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
                </Link>
                <p className="text-center text-xs text-gray-400 mt-4">
                  Cancela cuando quieras · Sin permanencia
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          FINAL CTA
      ═══════════════════════════════════════════ */}
      <section className="relative py-24 bg-gray-900 overflow-hidden">
        {/* Background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-600/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-red-500/10 rounded-full blur-3xl" />
        </div>
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/10 rounded-full text-sm text-red-300 font-medium mb-8 backdrop-blur-sm">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Únete a +500 restaurantes exitosos
            </div>

            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-6 leading-tight">
              ¿Listo para{' '}
              <span className="bg-gradient-to-r from-red-400 to-rose-400 bg-clip-text text-transparent">
                transformar
              </span>{' '}
              tu restaurante?
            </h2>

            <p className="text-lg text-gray-400 mb-10 max-w-xl mx-auto leading-relaxed">
              Empieza tu prueba gratuita de 14 días. Sin tarjeta de crédito, sin compromisos. Configura tu menú digital en minutos.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/register"
                className="group w-full sm:w-auto px-10 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-2xl transition-all duration-300 shadow-lg shadow-red-600/30 hover:shadow-xl hover:shadow-red-500/40 hover:-translate-y-0.5 flex items-center justify-center gap-2 text-lg"
              >
                Crear Mi Menú Gratis
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </Link>
              <Link
                to="/contact"
                className="w-full sm:w-auto px-10 py-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-300 backdrop-blur-sm flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                Hablar con Ventas
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Home;