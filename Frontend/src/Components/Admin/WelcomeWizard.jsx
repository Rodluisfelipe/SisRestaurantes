import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBusinessConfig } from '../../Context/BusinessContext';
import AI from './AdminIcons';

/**
 * WelcomeWizard — Modal de bienvenida que aparece automáticamente
 * para nuevos usuarios, guiándolos paso a paso.
 */

const STEPS = [
  {
    emoji: AI.sparkle('w-16 h-16 text-white'),
    title: '¡Tu menú digital está listo!',
    desc: 'Ya creamos categorías automáticas según tu tipo de negocio. Ahora vamos a configurarlo todo en 3 simples pasos.',
    gradient: 'from-blue-500 to-purple-600',
  },
  {
    emoji: AI.utensils('w-16 h-16 text-white'),
    title: 'Paso 1: Agrega tus productos',
    desc: 'Ve a la sección "Productos", haz clic en "+ Nuevo Producto" y agrega nombre, precio, imagen y categoría. ¡Puedes agregar cuantos quieras!',
    tip: 'Consejo: Empieza con 3-5 productos estrella',
    tab: 'products',
    gradient: 'from-orange-500 to-red-500',
  },
  {
    emoji: AI.cog('w-16 h-16 text-white'),
    title: 'Paso 2: Configura tus pedidos',
    desc: 'En "Configuración del Negocio" elige cómo quieres recibir pedidos: por WhatsApp, directamente en la app, o ambos. También agrega tu horario.',
    tip: 'Consejo: WhatsApp es perfecto para empezar',
    tab: 'business',
    gradient: 'from-emerald-500 to-teal-600',
  },
  {
    emoji: AI.rocket('w-16 h-16 text-white'),
    title: 'Paso 3: ¡Comparte tu menú!',
    desc: 'Este es el paso que trae tu primer pedido. Mándalo por WhatsApp a tus clientes de siempre y súbelo a tu estado.',
    /* Antes decía "cópialo desde la configuración" y mostraba un enlace de
       ejemplo. Era una instrucción para irse a otro sitio, justo en el punto
       donde el 73% que carga su menú se cae al 17% que recibe un pedido:
       cargar el menú no vale nada hasta que alguien lo ve. Ahora el enlace es
       el suyo y se comparte desde acá. */
    compartir: true,
    gradient: 'from-violet-500 to-pink-500',
  },
];

const SERVICE_STEPS = [
  {
    emoji: AI.sparkle('w-16 h-16 text-white'),
    title: '¡Tu catálogo digital está listo!',
    desc: 'Ya creamos categorías automáticas según tu tipo de negocio. Ahora vamos a configurarlo todo en 3 simples pasos.',
    gradient: 'from-blue-500 to-purple-600',
  },
  {
    emoji: AI.sparkle('w-16 h-16 text-white'),
    title: 'Paso 1: Agrega tus servicios',
    desc: 'Ve a la sección "Servicios", haz clic en "+ Nuevo Servicio" y agrega nombre, precio, imagen y categoría. ¡Puedes agregar cuantos quieras!',
    tip: 'Consejo: Empieza con 3-5 servicios principales',
    tab: 'products',
    gradient: 'from-orange-500 to-red-500',
  },
  {
    emoji: AI.cog('w-16 h-16 text-white'),
    title: 'Paso 2: Configura tus citas',
    desc: 'En "Configuración del Negocio" elige cómo quieres recibir citas: por WhatsApp, directamente en la app, o ambos. También agrega tu horario.',
    tip: 'Consejo: WhatsApp es perfecto para empezar',
    tab: 'business',
    gradient: 'from-emerald-500 to-teal-600',
  },
  {
    emoji: AI.rocket('w-16 h-16 text-white'),
    compartir: true,
    title: 'Paso 3: ¡Comparte tu catálogo!',
    desc: 'Este es el paso que trae tu primera cita. Mándalo por WhatsApp a tus clientes de siempre y súbelo a tu estado.',
    gradient: 'from-violet-500 to-pink-500',
  },
];

/**
 * El paso que trae el primer pedido.
 *
 * De 30 negocios registrados, 22 cargaron su menú y solo 5 recibieron un
 * pedido. La diferencia no es el menú: es que nadie lo vio. Este bloque
 * convierte "cópialo desde la configuración" en un toque, con el enlace real
 * del negocio y el mensaje ya escrito.
 */
function CompartirMenu({ businessConfig }) {
  const [copiado, setCopiado] = useState(false);
  const slug = businessConfig?.slug;
  if (!slug) return null;

  const enlace = `https://menuby.tech/${slug}`;
  const nombre = businessConfig?.name || businessConfig?.businessName || 'nuestro negocio';
  const mensaje = `¡Hola! Ya puedes ver el menú de ${nombre} y pedir desde tu celular 👇\n\n${enlace}`;

  const copiar = () => {
    navigator.clipboard?.writeText(enlace);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="space-y-2.5 text-left mb-4">
      <button
        onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener')}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm transition-colors active:scale-[0.98]"
      >
        <span className="text-lg">💬</span> Compartir por WhatsApp
      </button>

      <button
        onClick={copiar}
        className="w-full flex items-center justify-between gap-2 py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[13px] font-medium transition-colors"
      >
        <span className="truncate">menuby.tech/{slug}</span>
        <span className={`shrink-0 font-bold ${copiado ? 'text-emerald-600' : 'text-slate-500'}`}>
          {copiado ? '¡Copiado!' : 'Copiar'}
        </span>
      </button>

      <p className="text-[11.5px] text-slate-500 leading-relaxed pt-0.5">
        Súbelo también a tu estado de WhatsApp: es de donde llega la mayoría de los pedidos.
      </p>
    </div>
  );
}

export default function WelcomeWizard({ onClose, onGoToTab }) {
  const { businessConfig } = useBusinessConfig();
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);
  const steps = isService ? SERVICE_STEPS : STEPS;
  const [step, setStep] = useState(0);
  const current = steps[step];
  const isLast = step === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      setStep(s => s + 1);
    }
  };

  const handleGoToSection = () => {
    if (current.tab) {
      onGoToTab(current.tab);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && step > 0 && onClose()}
      >
        <motion.div
          key={step}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
        >
          {/* Gradient Header */}
          <div className={`bg-gradient-to-br ${current.gradient} p-8 text-center`}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.1 }}
              className="text-7xl mb-4"
            >
              {current.emoji}
            </motion.div>
            <h2 className="text-2xl font-bold text-white mb-2">{current.title}</h2>
          </div>

          {/* Body */}
          <div className="p-6">
            <p className="text-slate-600 text-[15px] leading-relaxed mb-4">
              {current.desc}
            </p>

            {current.compartir && <CompartirMenu businessConfig={businessConfig} />}

            {current.tip && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
                <p className="text-sm text-amber-700 font-medium flex items-center gap-1">{AI.lightbulb('w-4 h-4')} {current.tip}</p>
              </div>
            )}

            {/* Step indicators */}
            <div className="flex items-center justify-center gap-2 mb-6">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === step
                      ? 'w-8 bg-blue-500'
                      : i < step
                        ? 'w-2 bg-green-400'
                        : 'w-2 bg-slate-200'
                  }`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              {current.tab && (
                <button
                  onClick={handleGoToSection}
                  className="flex-1 py-3 px-4 rounded-xl border-2 border-blue-500 text-blue-600 font-semibold text-sm hover:bg-blue-50 transition-colors"
                >
                  Ir ahora →
                </button>
              )}
              <button
                onClick={handleNext}
                className={`flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-colors ${
                  isLast
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-lg'
                    : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:shadow-lg'
                }`}
              >
                {isLast ? '¡Empezar! ✨' : step === 0 ? 'Comenzar →' : 'Siguiente →'}
              </button>
            </div>

            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="w-full mt-2 text-sm text-slate-400 hover:text-slate-600 py-2 transition-colors"
              >
                ← Anterior
              </button>
            )}

            {step === 0 && (
              <button
                onClick={onClose}
                className="w-full mt-2 text-sm text-slate-400 hover:text-slate-600 py-2 transition-colors"
              >
                Omitir guía
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
