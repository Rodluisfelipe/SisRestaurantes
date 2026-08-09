/**
 * A donde vuelve el restaurante después de conectar su WhatsApp en Meta.
 *
 * El callback del backend redirige acá con el resultado. Sin esta página, el
 * cliente terminaba viendo una respuesta JSON del servidor: justo al final de
 * un trámite que ya le costó, y sin saber si funcionó.
 */
import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';

const RESULTADOS = {
  ok: {
    emoji: '✅',
    titulo: '¡Tu WhatsApp quedó conectado!',
    texto: 'Los mensajes que te escriban van a llegar a tu panel. Ya puedes responderlos desde ahí.',
    accion: 'Ir a mis chats',
  },
  cancelado: {
    emoji: '👋',
    titulo: 'No se completó la conexión',
    texto: 'Cerraste la ventana de Meta antes de terminar. Puedes intentarlo de nuevo cuando quieras.',
    accion: 'Volver a intentar',
  },
  error: {
    emoji: '⚠️',
    titulo: 'Algo salió mal',
    texto: 'No pudimos conectar tu número. Intenta de nuevo, y si sigue igual escríbenos.',
    accion: 'Volver a intentar',
  },
};

export default function WhatsAppConectado() {
  const [params] = useSearchParams();
  const estado = params.get('estado') || 'error';
  const motivo = params.get('motivo');
  const r = RESULTADOS[estado] || RESULTADOS.error;

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 px-5">
      <div className="bg-white rounded-2xl border border-slate-200/70 p-8 max-w-md w-full text-center">
        <div className="text-5xl mb-4">{r.emoji}</div>
        <h1 className="text-xl font-bold text-slate-800">{r.titulo}</h1>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">{r.texto}</p>

        {/* El motivo real de Meta se muestra: es la única pista para arreglarlo,
            y esconderlo obliga a escribir a soporte para saber qué pasó. */}
        {motivo && estado === 'error' && (
          <p className="text-xs text-slate-400 mt-3 bg-slate-50 rounded-lg px-3 py-2 break-words">
            {motivo}
          </p>
        )}

        <Link
          to="/admin"
          className="inline-block mt-6 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold transition-colors"
        >
          {r.accion}
        </Link>
      </div>
    </div>
  );
}
