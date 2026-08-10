/**
 * Los chats de WhatsApp como pantalla propia, igual que el POS.
 *
 * Se ve como WhatsApp Web a propósito: quien atiende un restaurante ya sabe
 * usar WhatsApp Web: dónde está la lista, dónde el buscador, cómo se lee un
 * chat. Copiar esa disposición ahorra explicar la herramienta.
 *
 * La página no pone cabecera propia. La bandeja ya trae la suya —el número del
 * negocio, buscar, actualizar— y encimarle otra barra dejaba dos franjas
 * apiladas comiéndose la conversación.
 */
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBusinessConfig } from '../Context/BusinessContext';
import AdminSectionErrorBoundary from '../Components/Admin/AdminSectionErrorBoundary';
import WhatsAppInbox from '../Components/Admin/WhatsAppInbox';
import useWhatsAppUnread from '../hooks/useWhatsAppUnread';

export default function WhatsAppPanel() {
  const navigate = useNavigate();
  const { businessId } = useParams();
  const { businessConfig } = useBusinessConfig();
  const sinLeer = useWhatsAppUnread(businessConfig?._id);

  const volver = () => navigate(`/${businessId}/admin`);

  return (
    /* La franja verde de arriba y el fondo gris son de WhatsApp Web: la
       aplicación queda flotando encima, no pegada a los bordes. */
    <div className="h-dvh bg-[#dadbd3] overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-32 bg-[#00a884]" />
      <div className="relative h-full max-w-[1600px] mx-auto lg:py-5 lg:px-6">
        <AdminSectionErrorBoundary sectionName="Chats WhatsApp" onGoBack={volver}>
          {/* Acá sí es navegación: esta pantalla vive fuera del panel, así que
              se entra a Clientes con el teléfono ya en la búsqueda. */}
          <WhatsAppInbox
            pleno
            onSalir={volver}
            onVerPerfil={(telefono) => navigate(
              `/${businessId}/admin?tab=customers&buscar=${encodeURIComponent(String(telefono || '').replace(/^57/, ''))}`
            )}
          />
        </AdminSectionErrorBoundary>
      </div>

      <TituloConContador sinLeer={sinLeer} nombre={businessConfig?.businessName} />
    </div>
  );
}

/**
 * El contador en el título de la pestaña.
 *
 * Es lo que hace que trabajar con esto en su propia pestaña funcione: con la
 * ventana de fondo, el título es la única señal de que entró un mensaje.
 */
function TituloConContador({ sinLeer, nombre }) {
  React.useEffect(() => {
    const base = nombre ? `WhatsApp · ${nombre}` : 'WhatsApp · MenuBy';
    document.title = sinLeer > 0 ? `(${sinLeer}) ${base}` : base;
    return () => { document.title = 'MenuBy'; };
  }, [sinLeer, nombre]);
  return null;
}
