import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaQuestionCircle, FaTimes, FaWhatsapp, FaBookOpen, FaRocket } from 'react-icons/fa';

const WHATSAPP_NUMBER = '573138178003';
const WHATSAPP_MESSAGE = encodeURIComponent('Hola, necesito ayuda con mi menú digital en Menuby 🍔');

const HELP_ITEMS = [
  {
    icon: FaWhatsapp,
    label: 'Soporte WhatsApp',
    desc: 'Chatea con nuestro equipo',
    color: 'bg-green-500 hover:bg-green-600',
    iconColor: 'text-green-500',
    action: 'whatsapp',
  },
  {
    icon: FaBookOpen,
    label: '¿Cómo funciona?',
    desc: 'Guía rápida del panel',
    color: 'bg-blue-500 hover:bg-blue-600',
    iconColor: 'text-blue-500',
    action: 'guide',
  },
  {
    icon: FaRocket,
    label: 'Primeros pasos',
    desc: 'Wizard de configuración',
    color: 'bg-purple-500 hover:bg-purple-600',
    iconColor: 'text-purple-500',
    action: 'wizard',
  },
];

export default function FloatingHelpButton({ onShowWizard }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showQuickGuide, setShowQuickGuide] = useState(false);

  const handleAction = (action) => {
    setIsOpen(false);
    switch (action) {
      case 'whatsapp':
        window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`, '_blank');
        break;
      case 'guide':
        setShowQuickGuide(true);
        break;
      case 'wizard':
        onShowWizard?.();
        break;
    }
  };

  return (
    <>
      {/* Floating Button + Menu */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* Menu items */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden w-64 mb-2"
            >
              <div className="p-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                <h3 className="font-bold text-sm">¿Necesitas ayuda? 💬</h3>
                <p className="text-xs text-blue-100 mt-0.5">Estamos para apoyarte</p>
              </div>
              <div className="p-2">
                {HELP_ITEMS.map((item) => (
                  <button
                    key={item.action}
                    onClick={() => handleAction(item.action)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left group"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center bg-slate-100 group-hover:bg-slate-200 transition-colors`}>
                      <item.icon className={`text-base ${item.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                      <p className="text-[11px] text-slate-400">{item.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
              <div className="px-4 pb-3 pt-1">
                <p className="text-[10px] text-center text-slate-300">
                  WhatsApp: 313 817 8003
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FAB Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 ${
            isOpen
              ? 'bg-slate-700 hover:bg-slate-800'
              : 'bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
          }`}
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <FaTimes className="text-white text-xl" />
              </motion.div>
            ) : (
              <motion.div
                key="help"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="relative"
              >
                <FaQuestionCircle className="text-white text-2xl" />
                {/* Pulse ring */}
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Quick Guide Modal */}
      <AnimatePresence>
        {showQuickGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setShowQuickGuide(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-auto"
            >
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 rounded-t-2xl text-white">
                <h2 className="text-xl font-bold">📖 Guía rápida del panel</h2>
                <p className="text-blue-100 text-sm mt-1">Todo lo que necesitas saber</p>
              </div>

              <div className="p-5 space-y-4">
                {[
                  { emoji: '🍔', title: 'Productos', text: 'Agrega tus platos con foto, precio y categoría. Marca como destacados los más vendidos.' },
                  { emoji: '📂', title: 'Categorías', text: 'Organiza tu menú (Hamburguesas, Bebidas, etc). Se crean automáticas según tu tipo de negocio.' },
                  { emoji: '🧀', title: 'Extras / Toppings', text: 'Crea opciones extra como salsas, acompañamientos o tamaños con precio adicional.' },
                  { emoji: '📋', title: 'Pedidos', text: 'Recibe y gestiona pedidos en tiempo real. Cambia el estado de cada uno.' },
                  { emoji: '⚙️', title: 'Configuración', text: 'Horarios, modo de pedidos (WhatsApp/App), logo, datos del negocio.' },
                  { emoji: '🎨', title: 'Tema', text: 'Personaliza colores y estilo de tu menú digital.' },
                  { emoji: '📍', title: 'Ubicación', text: 'Agrega tu dirección para que los clientes te encuentren.' },
                  { emoji: '🎫', title: 'Cupones', text: 'Crea descuentos por porcentaje o monto fijo para tus clientes.' },
                  { emoji: '💰', title: 'Pagos', text: 'Configura si aceptas efectivo, transferencia o Nequi.' },
                ].map((item, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="text-2xl shrink-0">{item.emoji}</span>
                    <div>
                      <h4 className="font-semibold text-slate-800 text-sm">{item.title}</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-slate-100 flex gap-3">
                <button
                  onClick={() => {
                    setShowQuickGuide(false);
                    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`, '_blank');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <FaWhatsapp /> Soporte
                </button>
                <button
                  onClick={() => setShowQuickGuide(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors"
                >
                  Entendido ✓
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
