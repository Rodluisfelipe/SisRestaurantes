import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';
import { socket } from '../services/socket';
import BusinessHoursSettings from './BusinessHoursSettings';
import ImageUploader from './Admin/ImageUploader';
import {
  FaCog, FaStore, FaImage, FaWhatsapp, FaMapMarkerAlt, FaMap,
  FaInfoCircle, FaShareAlt, FaFacebook, FaInstagram, FaMusic, FaLink,
  FaEye, FaEyeSlash, FaWrench, FaSave, FaSyncAlt, FaCheckCircle,
  FaExclamationCircle, FaFileAlt, FaBell, FaCalendarAlt, FaEnvelope,
  FaChevronDown
} from 'react-icons/fa';
import { COUNTRY_CODES, CURRENCIES, getCurrencyForDialCode } from '../utils/currency';

const BusinessSettings = () => {
  const initialSettings = {
    businessName: '',
    description: '',
    logo: '',
    coverImage: '',
    isOpen: true,
    whatsappNumber: '',
    phoneCountryCode: '+57',
    currency: 'COP',
    address: '',
    nit: '',
    googleMapsUrl: '',
    socialMedia: {
      facebook: { url: '', isVisible: true },
      instagram: { url: '', isVisible: true },
      tiktok: { url: '', isVisible: true }
    },
    extraLink: { url: '', isVisible: true }
  };

  const [settings, setSettings] = useState(initialSettings);
  const [originalSettings, setOriginalSettings] = useState(initialSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [previewLogo, setPreviewLogo] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const { businessId } = useBusinessConfig();
  const [isEditingLogo, setIsEditingLogo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [emailSettings, setEmailSettings] = useState({
    enabled: false,
    sendOnBookingConfirmed: true,
    sendOnBookingCancelled: true
  });
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailTesting, setEmailTesting] = useState(false);
  const [emailMsg, setEmailMsg] = useState({ type: '', text: '' });

  const fetchBusinessConfig = async () => {
    try {
      const response = await api.get(`/business-config?businessId=${businessId}`);
      if (response.data) {
        const data = {
          ...initialSettings,
          ...response.data,
          description: response.data.description || 'Deliciosa comida casera con ingredientes frescos y servicio de calidad.',
          coverImage: response.data.coverImage || '',
          isOpen: response.data.isOpen !== undefined ? response.data.isOpen : true,
          whatsappNumber: response.data.whatsappNumber || '',
          phoneCountryCode: response.data.phoneCountryCode || '+57',
          currency: response.data.currency || 'COP',
          address: response.data.address || '',
          nit: response.data.nit || '',
          googleMapsUrl: response.data.googleMapsUrl || '',
          socialMedia: {
            ...initialSettings.socialMedia,
            ...(response.data.socialMedia || {})
          },
          extraLink: {
            ...initialSettings.extraLink,
            ...(response.data.extraLink || {})
          }
        };
        console.log('Datos cargados:', data);
        if (!isEditingLogo) {
          setSettings(data);
          setOriginalSettings(data);
        }
        if (!isEditingLogo) setPreviewLogo(response.data?.logo || '');
        // Load email settings from response
        if (response.data.emailSettings) {
          setEmailSettings(prev => ({
            ...prev,
            enabled: response.data.emailSettings.enabled || false,
            sendOnBookingConfirmed: response.data.emailSettings.sendOnBookingConfirmed !== false,
            sendOnBookingCancelled: response.data.emailSettings.sendOnBookingCancelled !== false
          }));
        }
      }
    } catch (error) {
      console.error('Error al cargar la configuración:', error);
      setError('Error al cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinessConfig();
    if (socket) {
      socket.connect();
      socket.emit('joinBusiness', businessId);

      // Debounce para evitar bucles si el backend emite muchos eventos
      let debounceTimeout = null;
      const handler = (data) => {
        if (debounceTimeout) clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
          if (!isEditingLogo) setSettings(prev => ({ ...prev, ...data }));
          if (!isEditingLogo) setPreviewLogo(data.logo || '');
        }, 300);
      };

      socket.on('business_config_update', handler);

      return () => {
        socket.emit('leaveBusiness', businessId);
        socket.off('business_config_update', handler);
        socket.disconnect();
        if (debounceTimeout) clearTimeout(debounceTimeout);
      };
    }
  }, [businessId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (name === 'logo') {
      setPreviewLogo(value);
    }
  };

  // Detectar si hay cambios pendientes
  const hasChanges = () => {
    return JSON.stringify(settings) !== JSON.stringify(originalSettings);
  };

  // Calcular progreso del contador de descripción
  const getDescriptionProgress = () => {
    const length = settings.description.length;
    const percentage = (length / 300) * 100;
    if (percentage < 50) return { color: 'bg-green-500', textColor: 'text-green-600' };
    if (percentage < 80) return { color: 'bg-yellow-500', textColor: 'text-yellow-600' };
    return { color: 'bg-red-500', textColor: 'text-red-600' };
  };

  const handleSaveEmail = async () => {
    setEmailSaving(true);
    setEmailMsg({ type: '', text: '' });
    try {
      await api.put('/email/settings', {
        businessId,
        enabled: emailSettings.enabled,
        sendOnBookingConfirmed: emailSettings.sendOnBookingConfirmed,
        sendOnBookingCancelled: emailSettings.sendOnBookingCancelled
      });
      setEmailMsg({ type: 'success', text: 'Configuración de correo guardada' });
    } catch (err) {
      setEmailMsg({ type: 'error', text: err.response?.data?.message || 'Error al guardar' });
    }
    setEmailSaving(false);
  };

  const handleTestEmail = async () => {
    setEmailTesting(true);
    setEmailMsg({ type: '', text: '' });
    try {
      const res = await api.post('/email/test', { businessId });
      setEmailMsg({ type: 'success', text: res.data.message || 'Correo de prueba enviado' });
    } catch (err) {
      setEmailMsg({ type: 'error', text: err.response?.data?.message || 'Error al enviar correo de prueba' });
    }
    setEmailTesting(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const dataToSend = {
        businessId,
        businessName: settings.businessName || "Mi Negocio",
        description: settings.description || "Deliciosa comida casera con ingredientes frescos y servicio de calidad.",
        logo: settings.logo || "",
        coverImage: settings.coverImage || "",
        isOpen: settings.isOpen !== undefined ? settings.isOpen : true,
        whatsappNumber: settings.whatsappNumber || "",
        phoneCountryCode: settings.phoneCountryCode || '+57',
        currency: settings.currency || 'COP',
        address: settings.address || "",
        nit: settings.nit || "",
        googleMapsUrl: settings.googleMapsUrl || "",
        socialMedia: {
          facebook: {
            url: settings.socialMedia?.facebook?.url || "",
            isVisible: settings.socialMedia?.facebook?.isVisible || false
          },
          instagram: {
            url: settings.socialMedia?.instagram?.url || "",
            isVisible: settings.socialMedia?.instagram?.isVisible || false
          },
          tiktok: {
            url: settings.socialMedia?.tiktok?.url || "",
            isVisible: settings.socialMedia?.tiktok?.isVisible || false
          }
        },
        extraLink: {
          url: settings.extraLink?.url || "",
          isVisible: settings.extraLink?.isVisible || false
        },
        enableBookings: settings.enableBookings || false,
        bookingSettings: settings.bookingSettings || { slotInterval: 30, maxAdvanceDays: 30, bufferMinutes: 0, autoConfirm: true }
      };
      console.log('Datos a enviar:', dataToSend);
      
      const response = await api.put('/business-config', dataToSend);
      console.log('Respuesta del servidor:', response.data);
      console.log('WhatsApp number recibido:', response.data.whatsappNumber);
      console.log('Dirección recibida:', response.data.address);
      console.log('URL de Google Maps recibida:', response.data.googleMapsUrl);
      
      // Actualizar el estado con los datos recibidos
      const updatedData = {
        ...settings,
        ...response.data,
        // Asegurarse de que los nuevos campos estén presentes incluso si no vienen en la respuesta
        address: response.data.address || settings.address || "",
        googleMapsUrl: response.data.googleMapsUrl || settings.googleMapsUrl || ""
      };
      setSettings(updatedData);
      setOriginalSettings(updatedData);
      
      setSuccessMessage('Configuración guardada exitosamente');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error al actualizar la configuración:', error);
      setError('Error al actualizar la configuración');
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSocialMediaChange = (platform, field, value) => {
    setSettings(prev => ({
      ...prev,
      socialMedia: {
        ...prev.socialMedia,
        [platform]: {
          ...prev.socialMedia[platform],
          [field]: value
        }
      }
    }));
  };

  // Actualizar directamente el estado del negocio
  const handleStoreStatusToggle = async () => {
    setStatusLoading(true);
    setError(null);
    
    try {
      // Si el documento actual no tiene isOpen (undefined), arreglar el esquema primero
      if (settings.isOpen === undefined) {
        console.log("El campo isOpen no existe, arreglando esquema...");
        await api.post('/business-config/fix-schema');
        await fetchBusinessConfig(); // Recargar con el esquema actualizado
        setSuccessMessage("Esquema actualizado. Intente cambiar el estado nuevamente.");
        setTimeout(() => setSuccessMessage(''), 3000);
        return;
      }
      
      const newStatus = !settings.isOpen;
      
      // Guardar directamente todo el objeto con el nuevo estado
      const dataToSend = {
        ...settings,
        isOpen: newStatus,
        businessId
      };
      
      console.log('Datos a enviar para cambiar estado:', dataToSend);
      
      const response = await api.put('/business-config', dataToSend);
      console.log('Respuesta del servidor:', response.data);
      
      // Verificar que el estado se guardó correctamente
      if (response.data.isOpen === newStatus) {
        setSettings(prev => ({
          ...prev,
          isOpen: newStatus
        }));
        
        setSuccessMessage(`Negocio ${newStatus ? 'abierto' : 'cerrado'} correctamente`);
      } else {
        setError("El estado no se actualizó correctamente. Por favor, intente nuevamente.");
      }
      
      setTimeout(() => {
        setSuccessMessage('');
        setError(null);
      }, 3000);
    } catch (error) {
      console.error('Error al actualizar el estado del negocio:', error);
      setError('Error al actualizar el estado del negocio');
      setTimeout(() => setError(null), 3000);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleFixSchema = async () => {
    try {
      setLoading(true);
      await api.post('/business-config/fix-schema');
      // Recargar los datos
      const response = await api.get('/business-config');
      if (response.data) {
        // Actualizar el estado con los datos recibidos
        const data = {
          ...initialSettings,
          ...response.data,
          whatsappNumber: response.data.whatsappNumber || '',
        };
        setSettings(data);
        setSuccessMessage('Esquema reparado correctamente');
      }
    } catch (error) {
      console.error('Error al reparar el esquema:', error);
      setError('Error al reparar el esquema');
    } finally {
      setLoading(false);
      setTimeout(() => {
        setSuccessMessage('');
        setError(null);
      }, 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-slate-400">
        <FaSyncAlt className="animate-spin mr-2 text-xs" /> Cargando configuración...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Información Básica */}
        <div className="bg-white rounded-2xl lg:rounded-xl border border-slate-100 lg:border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-none overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center">
              <FaStore className="text-[10px] text-slate-500" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Información Básica</h3>
          </div>
          
          <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left Column */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Nombre del Negocio
                </label>
                <input
                  type="text"
                  name="businessName"
                  value={settings.businessName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
                  placeholder="Ej: GO BURGER"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Descripción del Negocio
                </label>
                <textarea
                  name="description"
                  value={settings.description}
                  onChange={handleChange}
                  rows={3}
                  maxLength={300}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 focus:border-slate-300 resize-none"
                  placeholder="Descripción de tu negocio..."
                />
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${getDescriptionProgress().color}`}
                      style={{ width: `${(settings.description.length / 300) * 100}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium ${getDescriptionProgress().textColor}`}>
                    {settings.description.length}/300
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Logo del Negocio
                </label>
                <ImageUploader
                  value={settings.logo}
                  onChange={(url) => {
                    setSettings(prev => ({ ...prev, logo: url }));
                    setPreviewLogo(url || '');
                  }}
                  folder="logos"
                  maxWidth={400}
                  quality={85}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Imagen de Portada
                </label>
                <ImageUploader
                  value={settings.coverImage}
                  onChange={(url) => {
                    setSettings(prev => ({ ...prev, coverImage: url }));
                  }}
                  folder="covers"
                  maxWidth={1200}
                  quality={80}
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-3">
              {/* WhatsApp number with country code selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Número de WhatsApp
                </label>
                <div className="flex gap-1.5">
                  <div className="relative">
                    <select
                      value={settings.phoneCountryCode}
                      onChange={e => {
                        const code = e.target.value;
                        const suggestedCurrency = getCurrencyForDialCode(code);
                        setSettings(prev => ({
                          ...prev,
                          phoneCountryCode: code,
                          currency: suggestedCurrency,
                        }));
                      }}
                      className="appearance-none pl-2 pr-6 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 bg-white cursor-pointer"
                      style={{ minWidth: '72px' }}
                    >
                      {COUNTRY_CODES.map((c, i) => (
                        <option key={`${c.code}-${i}`} value={c.code}>
                          {c.flag} {c.code}
                        </option>
                      ))}
                    </select>
                    <FaChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 pointer-events-none" />
                  </div>
                  <input
                    type="text"
                    inputMode="tel"
                    name="whatsappNumber"
                    value={settings.whatsappNumber}
                    onChange={handleChange}
                    className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
                    placeholder="3001234567"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  El número completo sería: {settings.phoneCountryCode}{settings.whatsappNumber}
                </p>
              </div>

              {/* Currency */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Moneda
                </label>
                <div className="relative">
                  <select
                    value={settings.currency}
                    onChange={e => setSettings(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full appearance-none pl-3 pr-8 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 bg-white cursor-pointer"
                  >
                    {Object.entries(CURRENCIES).map(([code, cfg]) => (
                      <option key={code} value={code}>
                        {cfg.flag} {code} — {cfg.label}
                      </option>
                    ))}
                  </select>
                  <FaChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 pointer-events-none" />
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Los precios se mostrarán como: {CURRENCIES[settings.currency]?.symbol || '$'}1.000
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Dirección
                </label>
                <input
                  type="text"
                  name="address"
                  value={settings.address}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
                  placeholder="Ej: Calle Principal #123, Ciudad"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  NIT
                </label>
                <input
                  type="text"
                  name="nit"
                  value={settings.nit}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
                  placeholder="Ej: 900.123.456-7"
                />
                <p className="mt-1 text-xs text-slate-400 flex items-center gap-1">
                  <FaInfoCircle className="text-[8px]" />
                  Se mostrará en las comandas impresas
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  URL de Google Maps
                </label>
                <input
                  type="text"
                  name="googleMapsUrl"
                  value={settings.googleMapsUrl}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
                  placeholder="https://maps.google.com/?q=..."
                />
                <p className="mt-1 text-xs text-slate-400 flex items-center gap-1">
                  <FaInfoCircle className="text-[8px]" />
                  Enlace de ubicación en Google Maps
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Horarios y Estado del Negocio */}
        <BusinessHoursSettings />

        {/* Agenda y Reservas */}
        <div className="bg-white rounded-2xl lg:rounded-xl border border-slate-100 lg:border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-none overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-indigo-50 rounded-lg flex items-center justify-center">
                <FaCalendarAlt className="text-[10px] text-indigo-500" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Agenda y Reservas</h3>
            </div>
            <button
              type="button"
              onClick={() => setSettings(prev => ({ ...prev, enableBookings: !prev.enableBookings }))}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                settings.enableBookings ? 'bg-indigo-500' : 'bg-slate-300'
              }`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                settings.enableBookings ? 'translate-x-4' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {settings.enableBookings && (
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-500">Permite que tus clientes agenden citas al pedir un servicio.</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Intervalo de slots (min)
                  </label>
                  <select
                    value={settings.bookingSettings?.slotInterval || 30}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      bookingSettings: { ...prev.bookingSettings, slotInterval: parseInt(e.target.value) }
                    }))}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  >
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>60 min</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Días de anticipación
                  </label>
                  <select
                    value={settings.bookingSettings?.maxAdvanceDays || 30}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      bookingSettings: { ...prev.bookingSettings, maxAdvanceDays: parseInt(e.target.value) }
                    }))}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  >
                    <option value={7}>7 días</option>
                    <option value={14}>14 días</option>
                    <option value={30}>30 días</option>
                    <option value={60}>60 días</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Buffer entre citas (min)
                  </label>
                  <select
                    value={settings.bookingSettings?.bufferMinutes || 0}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      bookingSettings: { ...prev.bookingSettings, bufferMinutes: parseInt(e.target.value) }
                    }))}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  >
                    <option value={0}>Sin buffer</option>
                    <option value={5}>5 min</option>
                    <option value={10}>10 min</option>
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Auto-confirmar
                  </label>
                  <button
                    type="button"
                    onClick={() => setSettings(prev => ({
                      ...prev,
                      bookingSettings: { ...prev.bookingSettings, autoConfirm: !prev.bookingSettings?.autoConfirm }
                    }))}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      settings.bookingSettings?.autoConfirm !== false ? 'bg-indigo-500' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      settings.bookingSettings?.autoConfirm !== false ? 'translate-x-4' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>

              {/* Cancellation Policy */}
              <div className="border-t border-slate-100 pt-3 mt-3">
                <p className="text-xs font-bold text-slate-400 uppercase mb-2">Política de Cancelación</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Permitir cancelar
                    </label>
                    <button
                      type="button"
                      onClick={() => setSettings(prev => ({
                        ...prev,
                        bookingSettings: { ...prev.bookingSettings, allowCancellation: prev.bookingSettings?.allowCancellation === false ? true : false }
                      }))}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        settings.bookingSettings?.allowCancellation !== false ? 'bg-indigo-500' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        settings.bookingSettings?.allowCancellation !== false ? 'translate-x-4' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  {settings.bookingSettings?.allowCancellation !== false && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Anticipación mínima
                      </label>
                      <select
                        value={settings.bookingSettings?.cancellationDeadlineHours || 2}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          bookingSettings: { ...prev.bookingSettings, cancellationDeadlineHours: parseInt(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                      >
                        <option value={0}>Sin límite</option>
                        <option value={1}>1 hora antes</option>
                        <option value={2}>2 horas antes</option>
                        <option value={4}>4 horas antes</option>
                        <option value={12}>12 horas antes</option>
                        <option value={24}>24 horas antes</option>
                        <option value={48}>48 horas antes</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Staff Assignment & Reminders */}
              <div className="border-t border-slate-100 pt-3 mt-3">
                <p className="text-xs font-bold text-slate-400 uppercase mb-2">Opciones avanzadas</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Asignar profesional
                    </label>
                    <button
                      type="button"
                      onClick={() => setSettings(prev => ({
                        ...prev,
                        bookingSettings: { ...prev.bookingSettings, enableStaffAssignment: !prev.bookingSettings?.enableStaffAssignment }
                      }))}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        settings.bookingSettings?.enableStaffAssignment ? 'bg-indigo-500' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        settings.bookingSettings?.enableStaffAssignment ? 'translate-x-4' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Recordatorios push
                    </label>
                    <button
                      type="button"
                      onClick={() => setSettings(prev => ({
                        ...prev,
                        bookingSettings: { ...prev.bookingSettings, enableReminders: prev.bookingSettings?.enableReminders === false ? true : false }
                      }))}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        settings.bookingSettings?.enableReminders !== false ? 'bg-indigo-500' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        settings.bookingSettings?.enableReminders !== false ? 'translate-x-4' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Correos Automáticos — oculto temporalmente del panel admin */}
        {false && <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center">
              <FaEnvelope className="text-[10px] text-indigo-500" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Correos Automáticos</h3>
            <div className="ml-auto">
              <button
                type="button"
                onClick={() => setEmailSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  emailSettings.enabled ? 'bg-indigo-500' : 'bg-slate-300'
                }`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  emailSettings.enabled ? 'translate-x-4' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>

          {emailSettings.enabled && (
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-500">
                Los correos se envían automáticamente desde <strong>noreply@menuby.tech</strong> cuando confirmas o cancelas citas.
              </p>

              <div className="border-t border-slate-100 pt-3 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Enviar correo cuando:</p>
                {[
                  { key: 'sendOnBookingConfirmed', label: 'Se confirma una reserva/cita' },
                  { key: 'sendOnBookingCancelled', label: 'Se cancela una reserva/cita' }
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">{label}</span>
                    <button
                      type="button"
                      onClick={() => setEmailSettings(prev => ({ ...prev, [key]: !prev[key] }))}
                      className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                        emailSettings[key] ? 'bg-indigo-500' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        emailSettings[key] ? 'translate-x-3.5' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>

              {emailMsg.text && (
                <div className={`text-xs px-3 py-2 rounded-lg ${
                  emailMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}>
                  {emailMsg.text}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestEmail}
                  disabled={emailTesting}
                  className="flex-1 px-3 py-2 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"
                >
                  {emailTesting ? 'Enviando...' : 'Enviar Prueba'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveEmail}
                  disabled={emailSaving}
                  className="flex-1 px-3 py-2 text-xs font-medium bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors"
                >
                  {emailSaving ? 'Guardando...' : 'Guardar Correo'}
                </button>
              </div>
            </div>
          )}
        </div>}

        {/* Redes Sociales */}
        <div className="bg-white rounded-2xl lg:rounded-xl border border-slate-100 lg:border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-none overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center">
              <FaShareAlt className="text-[10px] text-slate-500" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Redes Sociales</h3>
          </div>
          
          <div className="p-4 space-y-3">
            {/* Facebook */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Facebook
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={settings.socialMedia.facebook.url}
                  onChange={(e) => handleSocialMediaChange('facebook', 'url', e.target.value)}
                  placeholder="https://facebook.com/tu-negocio"
                  className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
                />
                <button
                  type="button"
                  onClick={() => handleSocialMediaChange('facebook', 'isVisible', !settings.socialMedia.facebook.isVisible)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                    settings.socialMedia.facebook.isVisible 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-slate-50 text-slate-500 border border-slate-200'
                  }`}
                >
                  {settings.socialMedia.facebook.isVisible ? <><FaEye className="text-[9px]" /> Visible</> : <><FaEyeSlash className="text-[9px]" /> Oculto</>}
                </button>
              </div>
            </div>

            {/* Instagram */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Instagram
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={settings.socialMedia.instagram.url}
                  onChange={(e) => handleSocialMediaChange('instagram', 'url', e.target.value)}
                  placeholder="https://instagram.com/tu-negocio"
                  className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
                />
                <button
                  type="button"
                  onClick={() => handleSocialMediaChange('instagram', 'isVisible', !settings.socialMedia.instagram.isVisible)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                    settings.socialMedia.instagram.isVisible 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-slate-50 text-slate-500 border border-slate-200'
                  }`}
                >
                  {settings.socialMedia.instagram.isVisible ? <><FaEye className="text-[9px]" /> Visible</> : <><FaEyeSlash className="text-[9px]" /> Oculto</>}
                </button>
              </div>
            </div>

            {/* TikTok */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                TikTok
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={settings.socialMedia.tiktok.url}
                  onChange={(e) => handleSocialMediaChange('tiktok', 'url', e.target.value)}
                  placeholder="https://tiktok.com/@tu-negocio"
                  className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
                />
                <button
                  type="button"
                  onClick={() => handleSocialMediaChange('tiktok', 'isVisible', !settings.socialMedia.tiktok.isVisible)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                    settings.socialMedia.tiktok.isVisible 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-slate-50 text-slate-500 border border-slate-200'
                  }`}
                >
                  {settings.socialMedia.tiktok.isVisible ? <><FaEye className="text-[9px]" /> Visible</> : <><FaEyeSlash className="text-[9px]" /> Oculto</>}
                </button>
              </div>
            </div>

            {/* Enlace Extra */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Enlace Extra
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={settings.extraLink.url}
                  onChange={(e) => setSettings({
                    ...settings,
                    extraLink: { ...settings.extraLink, url: e.target.value }
                  })}
                  placeholder="https://tu-sitio-web.com"
                  className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
                />
                <button
                  type="button"
                  onClick={() => setSettings({
                    ...settings,
                    extraLink: { ...settings.extraLink, isVisible: !settings.extraLink.isVisible }
                  })}
                  className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                    settings.extraLink.isVisible 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-slate-50 text-slate-500 border border-slate-200'
                  }`}
                >
                  {settings.extraLink.isVisible ? <><FaEye className="text-[9px]" /> Visible</> : <><FaEyeSlash className="text-[9px]" /> Oculto</>}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Reparar Configuración */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleFixSchema}
            className="px-4 py-2 text-xs font-medium text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5"
          >
            <FaWrench className="text-[10px]" />
            Reparar Configuración
          </button>
        </div>
      </form>

      {/* Vista Previa del Logo */}
      {previewLogo && (
        <div className="bg-white rounded-2xl lg:rounded-xl border border-slate-100 lg:border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-none overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center">
              <FaImage className="text-[10px] text-slate-500" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Vista Previa del Logo</h3>
          </div>
          <div className="p-4 flex justify-center">
            <div className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200 bg-white">
              <img
                src={previewLogo}
                alt="Vista previa del logo"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.src = 'https://placehold.co/150x150?text=Logo';
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Botón Flotante Guardar */}
      <AnimatePresence>
        {hasChanges() && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-6 left-1/2 transform -translate-x-1/2 z-50"
          >
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              className={`px-6 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
                isSaving
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-slate-800 hover:bg-slate-900 text-white'
              }`}
            >
              {isSaving ? (
                <><FaSyncAlt className="animate-spin text-[10px]" /> Guardando...</>
              ) : (
                <><FaSave className="text-[10px]" /> Guardar Cambios</>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast de Confirmación */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className="fixed top-20 right-4 z-50"
          >
            <div className="bg-white border border-emerald-200 px-4 py-3 rounded-xl flex items-center gap-2">
              <FaCheckCircle className="text-xs text-emerald-500 flex-shrink-0" />
              <p className="text-xs font-medium text-slate-700">{successMessage}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast de Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className="fixed top-20 right-4 z-50"
          >
            <div className="bg-white border border-red-200 px-4 py-3 rounded-xl flex items-center gap-2">
              <FaExclamationCircle className="text-xs text-red-500 flex-shrink-0" />
              <p className="text-xs font-medium text-slate-700">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BusinessSettings;