/**
 * Los chats de WhatsApp como pantalla propia, igual que el POS.
 *
 * Antes eran una pestaña dentro del panel, y eso obligaba a elegir: o los
 * chats o cualquier otra cosa. Con su propia dirección puede quedarse abierta
 * en una pestaña del navegador toda la jornada, sin que ir al POS o a los
 * pedidos la cierre.
 */
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaWhatsapp, FaSignOutAlt } from 'react-icons/fa';
import { useBusinessConfig } from '../Context/BusinessContext';
import PanelesRapidos from '../Components/Admin/PanelesRapidos';
import AdminSectionErrorBoundary from '../Components/Admin/AdminSectionErrorBoundary';
import WhatsAppInbox from '../Components/Admin/WhatsAppInbox';
import useWhatsAppUnread from '../hooks/useWhatsAppUnread';

export default function WhatsAppPanel() {
  const navigate = useNavigate();
  const { businessId } = useParams();
  const { businessConfig } = useBusinessConfig();
  const sinLeer = useWhatsAppUnread(businessConfig?._id);

  const irA = (panel) => {
    if (panel.id === 'pos') return navigate(`/${businessId}/pos`);
    if (panel.id === 'dashboard') return navigate(`/${businessId}/admin`);
  };

  return (
    <div className="h-dvh flex flex-col bg-slate-100 overflow-hidden">
      <header className="h-14 shrink-0 bg-slate-900 flex items-center gap-3 px-3 lg:px-4">
        {businessConfig?.logo ? (
          <img src={businessConfig.logo} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
        ) : (
          <span className="w-8 h-8 rounded-lg bg-emerald-500 grid place-items-center text-white shrink-0">
            <FaWhatsapp />
          </span>
        )}
        <div className="hidden sm:block min-w-0">
          <p className="text-white text-sm font-bold leading-tight truncate">
            {businessConfig?.businessName || 'WhatsApp'}
          </p>
          <p className="text-slate-400 text-xs font-medium">Chats de WhatsApp</p>
        </div>

        <div className="ml-1 lg:ml-3">
          <PanelesRapidos
            activo="whatsapp"
            onIr={irA}
            tono="oscuro"
            posDisponible={!!businessConfig?.features?.posBetaEnabled}
          />
        </div>

        <button
          onClick={() => navigate(`/${businessId}/admin`)}
          title="Volver al panel"
          className="ml-auto w-9 h-9 shrink-0 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 grid place-items-center transition-colors"
        >
          <FaSignOutAlt className="text-sm" />
        </button>
      </header>

      {/* `pleno`: la bandeja toma el alto del contenedor en vez de calcularlo
          descontando el armazón del panel, que acá no existe. */}
      <div className="flex-1 min-h-0 p-2 sm:p-3">
        <AdminSectionErrorBoundary
          sectionName="Chats WhatsApp"
          onGoBack={() => navigate(`/${businessId}/admin`)}
        >
          <WhatsAppInbox pleno />
        </AdminSectionErrorBoundary>
      </div>

      {/* El contador vive en el título de la pestaña: con la ventana de fondo,
          es la única señal de que entró un mensaje. */}
      <TituloConContador sinLeer={sinLeer} nombre={businessConfig?.businessName} />
    </div>
  );
}

function TituloConContador({ sinLeer, nombre }) {
  React.useEffect(() => {
    const base = nombre ? `WhatsApp · ${nombre}` : 'WhatsApp · MenuBy';
    document.title = sinLeer > 0 ? `(${sinLeer}) ${base}` : base;
    return () => { document.title = 'MenuBy'; };
  }, [sinLeer, nombre]);
  return null;
}
