/**
 * CrewChat — lista de conversaciones + vista de chat.
 * Usado por el lado worker y reutilizable por el business.
 *
 * Props:
 *   role: 'worker' | 'business'
 *   apiBase: instancia configurada para hablar con /api/crew/*
 *   tokenKey: localStorage key para el JWT (crew_token o accessToken)
 *   onBack: callback opcional
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import crewApi from '../../services/crewApi';
import { subscribeCrewConversation } from '../../services/crewSocket';

function formatRelative(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

export default function CrewChat() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openConv, setOpenConv] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await crewApi.get('/workers/me/conversations');
      setConversations(data.conversations || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (openConv) {
    return <ChatThread conversation={openConv} onBack={() => { setOpenConv(null); load(); }} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-geist pb-24">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-md mx-auto px-5 py-4">
          <h1 className="text-[20px] font-extrabold">Mensajes</h1>
          <p className="text-[12px] text-slate-500 mt-0.5">Conversa con los negocios que te han contratado</p>
        </div>
      </header>

      <main className="max-w-md mx-auto px-5 pt-4 space-y-2">
        {loading && (
          <div className="space-y-2 animate-pulse">
            {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-white border border-slate-200 rounded-xl" />)}
          </div>
        )}
        {!loading && conversations.length === 0 && (
          <div className="text-center py-12 px-5 bg-white border border-slate-200 rounded-2xl">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            </div>
            <p className="text-[14px] font-bold text-slate-700">Aún no tienes mensajes</p>
            <p className="text-[12px] text-slate-500 mt-1">Aparecerán aquí cuando un negocio te acepte en un turno</p>
          </div>
        )}
        {conversations.map((c) => (
          <button
            key={c._id}
            onClick={() => setOpenConv(c)}
            className="w-full text-left p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition flex items-center gap-3"
          >
            <div className="shrink-0 w-11 h-11 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[14px] font-extrabold text-slate-600">
              {(c.businessId?.businessName || 'M').slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-[13px] font-extrabold text-slate-900 truncate">{c.businessId?.businessName || 'Negocio'}</p>
                <span className="text-[10px] text-slate-400 shrink-0 ml-2">{formatRelative(c.lastMessageAt)}</span>
              </div>
              <p className="text-[12px] text-slate-500 truncate">{c.lastMessagePreview || 'Sin mensajes aún'}</p>
            </div>
            {c.workerUnread > 0 && (
              <span className="shrink-0 min-w-[20px] h-5 px-1.5 bg-red-600 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center">
                {c.workerUnread}
              </span>
            )}
          </button>
        ))}
      </main>
    </div>
  );
}

function ChatThread({ conversation, onBack }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await crewApi.get(`/conversations/${conversation._id}/messages`);
      setMessages(data.messages || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [conversation._id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Realtime: escucha mensajes nuevos enviados por la contraparte.
  // El servidor emite a `crew-conv-<id>` cada vez que llega un mensaje POST.
  useEffect(() => {
    const unsubscribe = subscribeCrewConversation(conversation._id, (msg) => {
      setMessages((prev) => {
        // Evita duplicar el eco de nuestros propios envíos (ya los insertamos en send()).
        if (prev.some((m) => String(m._id) === String(msg._id))) return prev;
        return [...prev, msg];
      });
    });
    return unsubscribe;
  }, [conversation._id]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const { data } = await crewApi.post(`/conversations/${conversation._id}/messages`, { body: text.trim() });
      setMessages((m) => (m.some((x) => String(x._id) === String(data.message._id)) ? m : [...m, data.message]));
      setText('');
    } catch (e) {
      console.error(e);
    } finally { setSending(false); }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-geist">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="text-slate-500 hover:text-slate-900" aria-label="Volver">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[13px] font-extrabold text-slate-700">
            {(conversation.businessId?.businessName || 'M').slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-extrabold truncate">{conversation.businessId?.businessName || 'Negocio'}</p>
            <p className="text-[10px] text-slate-500">Conversación activa</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto max-w-md w-full mx-auto px-4 py-4 space-y-2">
        {loading && <p className="text-center text-[12px] text-slate-400">Cargando mensajes…</p>}
        {!loading && messages.length === 0 && (
          <p className="text-center text-[12px] text-slate-400 mt-12">Sin mensajes aún. Envía el primero.</p>
        )}
        {messages.map((m, i) => {
          const mine = m.senderKind === 'worker';
          return (
            <motion.div
              key={m._id || i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`max-w-[78%] px-3.5 py-2 rounded-2xl ${
                mine
                  ? 'self-end ml-auto bg-gradient-to-br from-red-500 to-red-600 text-white rounded-br-md'
                  : 'self-start bg-white border border-slate-200 text-slate-900 rounded-bl-md'
              }`}
            >
              <p className="text-[14px] leading-relaxed whitespace-pre-line">{m.body}</p>
              <p className={`text-[9px] mt-0.5 text-right ${mine ? 'text-white/70' : 'text-slate-400'}`}>
                {new Date(m.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </motion.div>
          );
        })}
        <div ref={endRef} />
      </main>

      <footer className="bg-white border-t border-slate-200 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
            placeholder="Escribe un mensaje…"
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-[14px] focus:outline-none focus:border-red-500 focus:bg-white transition"
          />
          <button
            onClick={send}
            disabled={sending || !text.trim()}
            className="shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center disabled:opacity-40 shadow-md shadow-red-500/25 active:scale-95 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          </button>
        </div>
      </footer>
    </div>
  );
}
