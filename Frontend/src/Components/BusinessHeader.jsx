import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';
import { socket } from '../services/api';
import { useNavigate, useLocation } from 'react-router-dom';

const BusinessHeader = () => {
  const [businessConfig, setBusinessConfig] = useState({
    businessName: '',
    logo: '',
    coverImage: '',
    isOpen: true,
    whatsappNumber: '',
    address: '',
    googleMapsUrl: '',
    socialMedia: {
      facebook: { url: '', isVisible: true },
      instagram: { url: '', isVisible: true },
      tiktok: { url: '', isVisible: true }
    },
    extraLink: { url: '', isVisible: true }
  });
  const [logoError, setLogoError] = useState(false);
  const [coverError, setCoverError] = useState(false);
  const { businessId } = useBusinessConfig();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determinar si estamos en la ruta de administración
  const isAdminRoute = location.pathname.includes('/admin');

  useEffect(() => {
    const fetchBusinessConfig = async () => {
      try {
        const response = await api.get(`/business-config?businessId=${businessId}`);
        if (response.data && typeof response.data === 'object') {
          console.log("Datos recibidos del servidor:", response.data);
          setBusinessConfig(prevConfig => ({
            ...prevConfig,
            ...response.data,
            coverImage: response.data.coverImage || '',
            isOpen: response.data.isOpen !== undefined ? response.data.isOpen : true,
            whatsappNumber: response.data.whatsappNumber || '',
            address: response.data.address || '',
            googleMapsUrl: response.data.googleMapsUrl || '',
            socialMedia: {
              facebook: { url: '', isVisible: false, ...response.data?.socialMedia?.facebook },
              instagram: { url: '', isVisible: false, ...response.data?.socialMedia?.instagram },
              tiktok: { url: '', isVisible: false, ...response.data?.socialMedia?.tiktok }
            },
            extraLink: {
              url: '',
              isVisible: false,
              ...response.data?.extraLink
            }
          }));
          console.log("Dirección cargada:", response.data.address);
          console.log("URL de Google Maps cargada:", response.data.googleMapsUrl);
        }
      } catch (error) {
        console.error('Error fetching business config:', error);
      }
    };
    fetchBusinessConfig();
    // --- WebSocket: Conexión y listeners ---
    socket.connect();
    socket.emit('joinBusiness', businessId);
    socket.on('business_config_update', (data) => {
      console.log("Actualización recibida por WebSocket:", data);
      setBusinessConfig(prevConfig => ({
        ...prevConfig,
        ...data,
        coverImage: data.coverImage || '',
        isOpen: data.isOpen !== undefined ? data.isOpen : true,
        whatsappNumber: data.whatsappNumber || '',
        address: data.address || '',
        googleMapsUrl: data.googleMapsUrl || '',
        socialMedia: {
          facebook: { url: '', isVisible: false, ...data?.socialMedia?.facebook },
          instagram: { url: '', isVisible: false, ...data?.socialMedia?.instagram },
          tiktok: { url: '', isVisible: false, ...data?.socialMedia?.tiktok }
        },
        extraLink: {
          url: '',
          isVisible: false,
          ...data?.extraLink
        }
      }));
    });
    return () => {
      socket.emit('leaveBusiness', businessId);
      socket.off('business_config_update');
      socket.disconnect();
    };
    // Reducir la frecuencia de actualización a cada 5 minutos
    // const intervalId = setInterval(fetchBusinessConfig, 5 * 60 * 1000);
    // return () => clearInterval(intervalId);
  }, [businessId]);

  const defaultLogo = 'https://placehold.co/150x150?text=Logo';
  const defaultCover = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgODAwIDIwMCI+PHJlY3Qgd2lkdGg9IjgwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNlNWU3ZWIiLz48L3N2Zz4=';

  console.log('Estado del negocio:', businessConfig.isOpen ? 'Abierto' : 'Cerrado');

  // Navegar al POS
  const handleGoToPOS = () => {
    navigate(`/${businessId}/pos`);
  };

  return (
    <div className="w-full text-center relative">
      {/* Cover Image Container */}
      <div className="w-full h-20 relative overflow-hidden bg-gray-100">
        <img 
          src={businessConfig.coverImage || defaultCover}
          alt="Portada del negocio"
          className="w-full h-full object-cover"
          onError={(e) => {
            if (!coverError) {
              setCoverError(true);
              e.target.src = defaultCover;
            }
          }}
        />
        
        {/* POS Button - Solo visible en la ruta de administración */}
        {isAdminRoute && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20">
            <button
              onClick={handleGoToPOS}
              className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-md hover:bg-blue-700 transition-colors flex items-center"
              title="Punto de Venta"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              POS
            </button>
          </div>
        )}
      </div>

      {/* Status Indicator */}
      <div className="absolute left-2 top-30 -translate-y-1/2 z-20">
        <div 
          className={`px-4 py-2 rounded-full text-sm font-bold shadow-md ${
            businessConfig.isOpen 
              ? 'bg-green-500 text-white' 
              : 'bg-red-500 text-white'
          }`}
        >
          {businessConfig.isOpen ? 'Abierto' : 'Cerrado'}
        </div>
      </div>

      {/* Logo Container */}
      <div className="absolute left-1/2 top-20 -translate-x-1/2 -translate-y-1/2 flex justify-center items-center">
        <div className="w-64 h-64 rounded-full overflow-hidden bg-transparent shadow-xl" style={{ width: '10rem', height: '10rem' }}>
          <img 
            src={businessConfig.logo || defaultLogo}
            alt="Logo del negocio"
            className="w-full h-full object-cover"
            onError={(e) => {
              if (!logoError) {
                setLogoError(true);
                e.target.src = defaultLogo;
              }
            }}
          />
        </div>
      </div>

      {/* Content Container */}
      <div className="pt-20 pb-3 bg-white flex flex-col items-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-0.5">
          {businessConfig.businessName || 'Mi Restaurante'}
        </h1>
        
        {/* Address that links to Google Maps */}
        {businessConfig?.address && (
          <a 
            href={businessConfig?.googleMapsUrl || `https://maps.google.com/?q=${encodeURIComponent(businessConfig.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-gray-700 text-base mb-1 hover:text-blue-600 transition-colors"
          >
            <svg className="w-5 h-5 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <span className="font-medium">{businessConfig.address}</span>
          </a>
        )}
        
        {/* Social Media Icons */}
        <div className="flex justify-center items-center gap-4">
          {businessConfig?.socialMedia?.facebook?.isVisible && businessConfig?.socialMedia?.facebook?.url && (
            <a 
              href={businessConfig?.socialMedia?.facebook?.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-blue-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.77 7.46H14.5v-1.9c0-.9.6-1.1 1-1.1h3V.5h-4.33C10.24.5 9.5 3.44 9.5 5.32v2.15h-3v4h3v12h5v-12h3.85l.42-4z"/>
              </svg>
            </a>
          )}
          
          {businessConfig?.socialMedia?.instagram?.isVisible && businessConfig?.socialMedia?.instagram?.url && (
            <a 
              href={businessConfig?.socialMedia?.instagram?.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-pink-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </a>
          )}
          
          {businessConfig?.socialMedia?.tiktok?.isVisible && businessConfig?.socialMedia?.tiktok?.url && (
            <a 
              href={businessConfig?.socialMedia?.tiktok?.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-black transition-colors"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 00-1-.08A6.34 6.34 0 003 15.66a6.34 6.34 0 0010.86 4.49v.02h3.45v-9.4a7.29 7.29 0 004.28 1.38V8.7a4.78 4.78 0 01-2-2.01z"/>
              </svg>
            </a>
          )}
          
          {businessConfig?.extraLink?.isVisible && businessConfig?.extraLink?.url && (
            <a 
              href={businessConfig?.extraLink?.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-blue-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default BusinessHeader; 