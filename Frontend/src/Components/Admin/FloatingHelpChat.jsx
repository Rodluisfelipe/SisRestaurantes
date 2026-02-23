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

// Sparkle SVG for the AI badge
function SparkleIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z" />
    </svg>
  );
}

// AI Avatar with animated gradient
function AIAvatar({ size = 'md' }) {
  const sizes = { sm: 'w-7 h-7', md: 'w-9 h-9', lg: 'w-12 h-12' };
  const iconSizes = { sm: 'w-3.5 h-3.5', md: 'w-4.5 h-4.5', lg: 'w-6 h-6' };
  return (
    <div className={`${sizes[size]} rounded-xl bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20 shrink-0`}>
      <SparkleIcon className={`${iconSizes[size]} text-white drop-shadow`} />
    </div>
  );
}

// Typing indicator with smooth animation
function TypingIndicator() {
  return (
    <div className="flex items-end gap-2.5">
      <AIAvatar size="sm" />
      <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="w-2 h-2 bg-gradient-to-br from-violet-400 to-purple-500 rounded-full"
              animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
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

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, [isOpen]);

  useEffect(() => {
    const timer = setTimeout(() => setShowPulse(false), 12000);
    return () => clearTimeout(timer);
  }, []);

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
        text: 'No pude responder en este momento. Contacta soporte por WhatsApp al 3138178003 📱',
        time: new Date(),
        error: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  };

  const showWelcome = !hasInteracted && messages.length === 0;

  return (
    <>
      {/* ===== FLOATING BUTTON ===== */}
      <div className="fixed bottom-5 right-5 z-[9999]">
        {/* Tooltip */}
        <AnimatePresence>
          {!isOpen && showPulse && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="absolute bottom-full right-0 mb-3 whitespace-nowrap"
            >
              <div className="bg-slate-900 text-white text-xs font-medium px-3 py-2 rounded-lg shadow-xl">
                <span className="mr-1">✨</span> ¿Necesitas ayuda? Pregúntale a la IA
                <div className="absolute -bottom-1 right-5 w-2 h-2 bg-slate-900 rotate-45" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Button */}
        <motion.button
          onClick={() => { setIsOpen(!isOpen); setShowPulse(false); }}
          className="relative w-14 h-14 rounded-full shadow-2xl flex items-center justify-center overflow-hidden group"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          title="Asistente IA MenuBy"
          style={{
            background: isOpen
              ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
              : 'linear-gradient(135deg, #7c3aed, #6366f1, #4f46e5)'
          }}
        >
          {/* Animated glow ring */}
          {!isOpen && showPulse && (
            <>
              <span className="absolute inset-0 rounded-full bg-violet-500 animate-ping opacity-30" />
              <span className="absolute -inset-1 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 opacity-20 animate-pulse" />
            </>
          )}

          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.div>
            ) : (
              <motion.div
                key="ai"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="relative"
              >
                <SparkleIcon className="w-7 h-7 text-white drop-shadow-lg" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* ===== CHAT WINDOW ===== */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="fixed bottom-[88px] right-4 z-[9999] w-[380px] max-w-[calc(100vw-1.5rem)] flex flex-col overflow-hidden"
            style={{
              maxHeight: 'min(600px, calc(100vh - 110px))',
              borderRadius: '20px',
              boxShadow: '0 25px 60px -15px rgba(99, 102, 241, 0.25), 0 12px 30px -10px rgba(0,0,0,0.15)',
            }}
          >
            {/* ── Header ── */}
            <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 px-5 py-4">
              {/* Decorative circles */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-16 translate-x-10" />
              <div className="absolute bottom-0 left-8 w-20 h-20 bg-white/5 rounded-full translate-y-10" />
              
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-11 h-11 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20">
                      <SparkleIcon className="w-6 h-6 text-white" />
                    </div>
                    {/* Online indicator */}
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-purple-600">
                      <span className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-60" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-[15px] tracking-tight">Asistente MenuBy</h3>
                    <p className="text-[11px] text-purple-200 flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                      IA en línea · Responde al instante
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* ── Messages Area ── */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-white"
              style={{ minHeight: '240px' }}
            >
              {/* Welcome Screen */}
              {showWelcome && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 space-y-4"
                >
                  {/* AI Intro Card */}
                  <div className="text-center space-y-3 pt-2 pb-1">
                    <div className="w-16 h-16 mx-auto bg-gradient-to-br from-violet-100 to-indigo-100 rounded-3xl flex items-center justify-center">
                      <SparkleIcon className="w-8 h-8 text-violet-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-base">¡Hola! Soy tu asistente IA</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-[260px] mx-auto leading-relaxed">
                        Te ayudo a configurar y usar MenuBy. Pregúntame lo que necesites sobre tu negocio.
                      </p>
                    </div>
                  </div>

                  {/* Quick Actions Grid */}
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-2.5 px-1">
                      Preguntas frecuentes
                    </p>
                    <div className="grid grid-cols-1 gap-1.5">
                      {SUGGESTIONS.map((s, i) => (
                        <motion.button
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 + i * 0.05 }}
                          onClick={() => sendMessage(s.text)}
                          className="flex items-center gap-3 w-full text-left p-3 rounded-xl bg-white border border-slate-100 hover:border-violet-200 hover:bg-violet-50/50 transition-all group shadow-sm hover:shadow"
                        >
                          <span className="text-base shrink-0 group-hover:scale-110 transition-transform">{s.icon}</span>
                          <span className="text-[13px] text-slate-700 group-hover:text-violet-700 font-medium transition-colors">{s.text}</span>
                          <svg className="w-4 h-4 text-slate-300 group-hover:text-violet-400 ml-auto shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Conversation Messages */}
              {messages.length > 0 && (
                <div className="p-4 space-y-4">
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'items-end gap-2.5'}`}
                    >
                      {msg.role === 'assistant' && <AIAvatar size="sm" />}
                      
                      <div className={`max-w-[80%] ${msg.role === 'user' ? '' : ''}`}>
                        <div
                          className={`px-4 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
                            msg.role === 'user'
                              ? 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white rounded-2xl rounded-br-md shadow-md shadow-violet-500/10'
                              : `bg-white border ${msg.error ? 'border-red-200 bg-red-50/50' : 'border-slate-100'} text-slate-700 rounded-2xl rounded-bl-md shadow-sm`
                          }`}
                        >
                          {msg.text}
                        </div>
                        <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-right text-slate-400' : 'text-slate-400 ml-1'}`}>
                          {formatTime(msg.time)}
                        </p>
                      </div>
                    </motion.div>
                  ))}

                  {/* Typing indicator */}
                  {loading && <TypingIndicator />}
                  
                  <div ref={messagesEndRef} />
                </div>
              )}

              {/* Inline suggestions after first exchange */}
              {hasInteracted && messages.length >= 2 && messages.length <= 4 && !loading && (
                <div className="px-4 pb-3">
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTIONS.slice(0, 3).map((s, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(s.text)}
                        className="text-[11px] bg-violet-50 text-violet-600 px-3 py-1.5 rounded-full hover:bg-violet-100 transition-colors font-medium border border-violet-100"
                      >
                        {s.text}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Input Area ── */}
            <div className="border-t border-slate-100 bg-white p-3">
              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Escribe tu pregunta..."
                    className="w-full px-4 py-3 bg-slate-50 rounded-2xl text-[13px] focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:bg-white border border-transparent focus:border-violet-200 transition-all placeholder:text-slate-400"
                    disabled={loading}
                    maxLength={500}
                  />
                </div>
                <motion.button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading}
                  className="w-11 h-11 bg-gradient-to-br from-violet-500 to-indigo-600 text-white rounded-2xl flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20 hover:shadow-xl hover:shadow-violet-500/30 transition-all shrink-0"
                  whileHover={input.trim() && !loading ? { scale: 1.05 } : {}}
                  whileTap={input.trim() && !loading ? { scale: 0.95 } : {}}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </motion.button>
              </div>

              {/* Footer with WhatsApp + Powered by */}
              <div className="flex items-center justify-between mt-2 px-1">
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[11px] text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492l4.624-1.467A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-2.16 0-4.163-.69-5.798-1.862l-.415-.285-2.742.87.913-2.659-.314-.444A9.706 9.706 0 012.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75z" />
                  </svg>
                  Soporte humano
                </a>
                <span className="text-[10px] text-slate-300 flex items-center gap-1">
                  <SparkleIcon className="w-2.5 h-2.5" /> Powered by IA
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
