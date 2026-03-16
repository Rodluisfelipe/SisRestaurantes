import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBusinessConfig } from '../../Context/BusinessContext';

/**
 * WelcomeWizard — Modal de bienvenida que aparece automáticamente
 * para nuevos usuarios, guiándolos paso a paso.
 */

const STEPS = [
  {
    emoji: '🎉',
    title: '¡Tu menú digital está listo!',
    desc: 'Ya creamos categorías automáticas según tu tipo de negocio. Ahora vamos a configurarlo todo en 3 simples pasos.',
    gradient: 'from-blue-500 to-purple-600',
  },
  {
    emoji: '🍔',
    title: 'Paso 1: Agrega tus productos',
    desc: 'Ve a la sección "Productos", haz clic en "+ Nuevo Producto" y agrega nombre, precio, imagen y categoría. ¡Puedes agregar cuantos quieras!',
    tip: 'Consejo: Empieza con 3-5 productos estrella',
    tab: 'products',
    gradient: 'from-orange-500 to-red-500',
  },
  {
    emoji: '⚙️',
    title: 'Paso 2: Configura tus pedidos',
    desc: 'En "Configuración del Negocio" elige cómo quieres recibir pedidos: por WhatsApp, directamente en la app, o ambos. También agrega tu horario.',
    tip: 'Consejo: WhatsApp es perfecto para empezar',
    tab: 'business',
    gradient: 'from-emerald-500 to-teal-600',
  },
  {
    emoji: '🚀',
    title: 'Paso 3: ¡Comparte tu menú!',
    desc: 'Tu menú ya tiene un link único. Cópialo desde la configuración y compártelo en tus redes sociales, WhatsApp o imprímelo en un QR.',
    tip: 'Tu link: menuby.tech/tu-negocio',
    gradient: 'from-violet-500 to-pink-500',
  },
];

const SERVICE_STEPS = [
  {
    emoji: '🎉',
    title: '¡Tu catálogo digital está listo!',
    desc: 'Ya creamos categorías automáticas según tu tipo de negocio. Ahora vamos a configurarlo todo en 3 simples pasos.',
    gradient: 'from-blue-500 to-purple-600',
  },
  {
    emoji: '💆',
    title: 'Paso 1: Agrega tus servicios',
    desc: 'Ve a la sección "Servicios", haz clic en "+ Nuevo Servicio" y agrega nombre, precio, imagen y categoría. ¡Puedes agregar cuantos quieras!',
    tip: 'Consejo: Empieza con 3-5 servicios principales',
    tab: 'products',
    gradient: 'from-orange-500 to-red-500',
  },
  {
    emoji: '⚙️',
    title: 'Paso 2: Configura tus citas',
    desc: 'En "Configuración del Negocio" elige cómo quieres recibir citas: por WhatsApp, directamente en la app, o ambos. También agrega tu horario.',
    tip: 'Consejo: WhatsApp es perfecto para empezar',
    tab: 'business',
    gradient: 'from-emerald-500 to-teal-600',
  },
  {
    emoji: '🚀',
    title: 'Paso 3: ¡Comparte tu catálogo!',
    desc: 'Tu catálogo ya tiene un link único. Cópialo desde la configuración y compártelo en tus redes sociales, WhatsApp o imprímelo en un QR.',
    tip: 'Tu link: menuby.tech/tu-negocio',
    gradient: 'from-violet-500 to-pink-500',
  },
];

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

            {current.tip && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
                <p className="text-sm text-amber-700 font-medium">💡 {current.tip}</p>
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
