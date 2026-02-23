import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';

const WHATSAPP_NUMBER = '3138178003';
const WHATSAPP_URL = `https://wa.me/57${WHATSAPP_NUMBER}?text=Hola%2C%20necesito%20ayuda%20con%20MenuBy`;

const SUGGESTIONS = [
  { icon: '📦', text: '¿Cómo agrego un producto?' },
  { icon: '🛒', text: '¿Cómo configuro los pedidos?' },
  { icon: '🎨', text: '¿Cómo personalizo mi menú?' },
  { icon: '🏷️', text: '¿Cómo creo un cupón?' },
  { icon: '📍', text: '¿Cómo configuro zonas de entrega?' },
  { icon: '📱', text: '¿Cómo comparto mi menú?' },
];

// MenuBy logo "M" icon
function MenuByIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V6l4 6 4-6 4 6 4-6v14" />
    </svg>
  );
}

// Typing indicator
function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shrink-0">
        <MenuByIcon className="w-3 h-3 text-white" />
      </div>
      <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3.5 py-2.5">
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 bg-red-400 rounded-full"
              animate={{ y: [0, -5, 0], opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function FloatingHelpChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPulse, setShowPulse] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatContainerRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, loading, scrollToBottom]);
  useEffect(() => { if (isOpen && inputRef.current) setTimeout(() => inputRef.current?.focus(), 300); }, [isOpen]);
  useEffect(() => { const t = setTimeout(() => setShowPulse(false), 10000); return () => clearTimeout(t); }, []);

  const sendMessage = async (text) => {
    const userMsg = text || input.trim();
    if (!userMsg || loading) return;

    setInput('');
    setHasInteracted(true);
    setMessages(prev => [...prev, { role: 'user', text: userMsg, time: new Date() }]);
    setLoading(true);

    try {
      const res = await api.post('/help-chat/message', { message: userMsg });
      setMessages(prev => [...prev, { role: 'assistant', text: res.data.reply, time: new Date() }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: 'No pude responder. Contacta soporte por WhatsApp 📱',
        time: new Date(),
        error: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const formatTime = (date) => date ? new Date(date).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '';

  const showWelcome = !hasInteracted && messages.length === 0;

  return (
    <>
      {/* ===== FAB ===== */}
      <div className="fixed bottom-4 right-4 z-[9999]">
        <AnimatePresence>
          {!isOpen && showPulse && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="absolute bottom-full right-0 mb-3 pointer-events-none"
            >
              <div className="relative bg-white rounded-2xl shadow-xl shadow-black/10 px-3.5 py-2.5 flex items-center gap-2.5 border border-gray-100">
                {/* MenuBy logo */}
                <img src="/logo.jpeg" alt="MenuBy" className="w-7 h-7 rounded-lg object-cover" />
                {/* Text */}
                <div className="pr-1">
                  <p className="text-[12px] font-semibold text-gray-800 leading-tight">Usa nuestra IA</p>
                  <p className="text-[10px] text-gray-400 leading-tight">Resuelve tus dudas al instante</p>
                </div>
                {/* AI badge */}
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-sm border-2 border-white">
                  <span className="text-[8px] text-white font-bold">IA</span>
                </div>
                {/* Arrow */}
                <div className="absolute -bottom-1.5 right-5 w-3 h-3 bg-white rotate-45 border-r border-b border-gray-100" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          onClick={() => { setIsOpen(!isOpen); setShowPulse(false); }}
          className="relative w-12 h-12 rounded-full shadow-lg flex items-center justify-center"
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.93 }}
          title="Asistente MenuBy"
          style={{ background: isOpen ? '#991b1b' : '#DC2626' }}
        >
          {!isOpen && showPulse && (
            <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-25" />
          )}
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.svg key="x" className="w-5 h-5 text-white" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </motion.svg>
            ) : (
              <motion.div key="icon" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.15 }}>
                <MenuByIcon className="w-6 h-6 text-white" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* ===== CHAT WINDOW ===== */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed bottom-[72px] right-3 z-[9999] w-[340px] max-w-[calc(100vw-1rem)] flex flex-col bg-white overflow-hidden"
            style={{
              maxHeight: 'min(520px, calc(100dvh - 90px))',
              borderRadius: '16px',
              boxShadow: '0 8px 40px -8px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)',
            }}
          >
            {/* ── Header ── */}
            <div className="bg-red-600 px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <MenuByIcon className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-[1.5px] border-red-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-white text-sm leading-tight truncate">Asistente MenuBy</h3>
                  <p className="text-[10px] text-red-200 leading-tight">IA en línea</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors shrink-0"
              >
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* ── Messages Area ── */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto bg-gray-50 overscroll-contain"
              style={{ minHeight: 0 }}
            >
              {/* Welcome */}
              {showWelcome && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 space-y-3">
                  <div className="text-center py-2">
                    <div className="w-12 h-12 mx-auto bg-red-50 rounded-2xl flex items-center justify-center mb-2">
                      <MenuByIcon className="w-6 h-6 text-red-500" />
                    </div>
                    <h4 className="font-semibold text-gray-800 text-sm">¡Hola! Soy tu asistente</h4>
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
                      Pregúntame sobre cómo usar MenuBy
                    </p>
                  </div>

                  <div className="space-y-1">
                    {SUGGESTIONS.map((s, i) => (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 + i * 0.04 }}
                        onClick={() => sendMessage(s.text)}
                        className="flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-xl hover:bg-white hover:shadow-sm transition-all group"
                      >
                        <span className="text-sm shrink-0">{s.icon}</span>
                        <span className="text-xs text-gray-600 group-hover:text-red-600 font-medium transition-colors truncate">{s.text}</span>
                        <svg className="w-3 h-3 text-gray-300 group-hover:text-red-400 ml-auto shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Conversation */}
              {messages.length > 0 && (
                <div className="p-3 space-y-3">
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'items-end gap-2'}`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                          <MenuByIcon className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <div className="max-w-[78%]">
                        <div
                          className={`px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap ${
                            msg.role === 'user'
                              ? 'bg-red-600 text-white rounded-2xl rounded-br-sm'
                              : `bg-white ${msg.error ? 'border border-red-100' : 'border border-gray-100'} text-gray-700 rounded-2xl rounded-bl-sm shadow-sm`
                          }`}
                        >
                          {msg.text}
                        </div>
                        <p className={`text-[9px] mt-0.5 ${msg.role === 'user' ? 'text-right' : 'ml-0.5'} text-gray-400`}>
                          {formatTime(msg.time)}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                  {loading && <TypingIndicator />}
                  <div ref={messagesEndRef} />
                </div>
              )}

              {/* Quick suggestions after first exchange */}
              {hasInteracted && messages.length >= 2 && messages.length <= 4 && !loading && (
                <div className="px-3 pb-2">
                  <div className="flex flex-wrap gap-1">
                    {SUGGESTIONS.slice(0, 3).map((s, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(s.text)}
                        className="text-[10px] bg-white text-red-600 px-2.5 py-1 rounded-full hover:bg-red-50 transition-colors font-medium border border-gray-100"
                      >
                        {s.text}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Input ── */}
            <div className="border-t border-gray-100 bg-white p-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe tu pregunta..."
                  className="flex-1 min-w-0 px-3 py-2 bg-gray-50 rounded-full text-[13px] focus:outline-none focus:ring-1 focus:ring-red-300 focus:bg-white border border-transparent focus:border-red-200 transition-all placeholder:text-gray-400"
                  disabled={loading}
                  maxLength={500}
                />
                <motion.button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading}
                  className="w-9 h-9 bg-red-600 text-white rounded-full flex items-center justify-center disabled:opacity-25 disabled:cursor-not-allowed hover:bg-red-700 transition-colors shrink-0"
                  whileTap={input.trim() && !loading ? { scale: 0.92 } : {}}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </motion.button>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-1.5 px-1">
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] text-green-600 hover:text-green-700 font-medium transition-colors"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492l4.624-1.467A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-2.16 0-4.163-.69-5.798-1.862l-.415-.285-2.742.87.913-2.659-.314-.444A9.706 9.706 0 012.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75z" />
                  </svg>
                  Soporte humano
                </a>
                <span className="text-[9px] text-gray-300">Powered by IA</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
