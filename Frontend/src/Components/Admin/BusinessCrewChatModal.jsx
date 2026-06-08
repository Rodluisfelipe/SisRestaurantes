/**
 * BusinessCrewChatModal — chat 1:1 negocio ↔ trabajador para el panel admin.
 *
 * Se abre desde CrewPanel (postulantes aceptados) o desde CrewWorkerProfileModal
 * (perfil completo del trabajador). Crea la conversación si no existe y la
 * suscribe al socket para entregar mensajes en tiempo real.
 *
 * Props:
 *   workerId, businessId  — obligatorios
 *   workerName, workerPhoto — opcional para el header
 *   bookingId — opcional, para asociar el thread a un booking en particular
 *   onClose
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../../config';
import { subscribeCrewConversation } from '../../services/crewSocket';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
  };
}

export default function BusinessCrewChatModal({ workerId, businessId, workerName, workerPhoto, bookingId, onClose }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const endRef = useRef(null);

  // Bloquear scroll del body mientras está abierto
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Paso 1: arrancar/recuperar la conversación
  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        const r = await fetch(`${API_URL}/crew/conversations/start`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ workerId, businessId, bookingId: bookingId || null }),
        });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'No se pudo abrir el chat');
        const data = await r.json();
        if (!cancelled) setConversation(data.conversation);
      } catch (e) {
        if (!cancelled) setError(e.message);
        if (!cancelled) setLoading(false);
      }
    };
    start();
    return () => { cancelled = true; };
  }, [workerId, businessId, bookingId]);

  // Paso 2: cargar histórico cuando ya tenemos conversation
  useEffect(() => {
    if (!conversation?._id) return;
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`${API_URL}/crew/conversations/${conversation._id}/messages`, { headers: authHeaders() });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'Error al cargar mensajes');
        const data = await r.json();
        if (!cancelled) setMessages(data.messages || []);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [conversation?._id]);

  // Paso 3: subscribirse al socket para mensajes nuevos del worker
  useEffect(() => {
    if (!conversation?._id) return;
    const unsubscribe = subscribeCrewConversation(conversation._id, (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => String(m._id) === String(msg._id))) return prev;
        return [...prev, msg];
      });
    });
    return unsubscribe;
  }, [conversation?._id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = useCallback(async () => {
    if (!text.trim() || !conversation?._id) return;
    setSending(true);
    try {
      const r = await fetch(`${API_URL}/crew/conversations/${conversation._id}/messages`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ body: text.trim() }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'No se pudo enviar');
      const data = await r.json();
      setMessages((prev) => (prev.some((m) => String(m._id) === String(data.message._id)) ? prev : [...prev, data.message]));
      setText('');
    } catch (e) {
      setError(e.message);
    } finally { setSending(false); }
  }, [text, conversation?._id]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full sm:max-w-md h-[85vh] sm:h-[80vh] bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <header className="px-4 py-3 border-b border-slate-200 bg-white flex items-center gap-3 shrink-0">
            {workerPhoto ? (
              <img src={workerPhoto} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-200" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-[14px] font-extrabold text-white">
                {(workerName || '?').slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-extrabold text-slate-900 truncate">{workerName || 'Trabajador'}</p>
              <p className="text-[10px] text-slate-500">Conversación directa · Crew MenuBy</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition" aria-label="Cerrar">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </header>

          {/* Body */}
          <main className="flex-1 overflow-y-auto bg-slate-50 px-4 py-4 space-y-2">
            {loading && <p className="text-center text-[12px] text-slate-400">Abriendo conversación…</p>}
            {error && <p className="text-center text-[12px] text-red-600 font-bold">{error}</p>}
            {!loading && !error && messages.length === 0 && (
              <div className="text-center mt-12 px-6">
                <div className="w-12 h-12 mx-auto rounded-full bg-white border border-slate-200 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                </div>
                <p className="text-[13px] font-bold text-slate-700">Envía el primer mensaje</p>
                <p className="text-[11px] text-slate-500 mt-1">Coordina horario, ubicación o cualquier detalle del turno con el trabajador.</p>
              </div>
            )}
            {messages.map((m, i) => {
              const mine = m.senderKind === 'business';
              return (
                <motion.div
                  key={m._id || i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`max-w-[78%] px-3.5 py-2 rounded-2xl ${
                    mine
                      ? 'self-end ml-auto bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-br-md'
                      : 'self-start bg-white border border-slate-200 text-slate-900 rounded-bl-md'
                  }`}
                >
                  <p className="text-[14px] leading-relaxed whitespace-pre-line">{m.body}</p>
                  <p className={`text-[9px] mt-0.5 text-right ${mine ? 'text-white/60' : 'text-slate-400'}`}>
                    {new Date(m.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </motion.div>
              );
            })}
            <div ref={endRef} />
          </main>

          {/* Composer */}
          <footer className="bg-white border-t border-slate-200 px-3 py-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
                placeholder="Escribe un mensaje…"
                disabled={!conversation || sending}
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-[14px] focus:outline-none focus:border-slate-900 focus:bg-white transition disabled:opacity-50"
              />
              <button
                onClick={send}
                disabled={sending || !text.trim() || !conversation}
                className="shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-slate-900 to-slate-800 text-white flex items-center justify-center disabled:opacity-40 shadow-md shadow-slate-900/20 active:scale-95 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
              </button>
            </div>
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
