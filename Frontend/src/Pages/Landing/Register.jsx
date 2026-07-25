import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';
import { registerUser, googleAuth, suggestSlugs, checkSlug } from '../../services/authService';
import { useAuth } from '../../Context/AuthContext';
import api from '../../services/api';
import GooglePlaceSearch from '../../Components/GooglePlaceSearch';

// Business type definitions (matches backend BUSINESS_TYPE_CONFIG)
const BUSINESS_TYPES = [
  { id: 'fast_food',  emoji: '🍔', label: 'Comida Rápida',  desc: 'Hamburguesas, pizzas, perros...' },
  { id: 'restaurant', emoji: '🍽️', label: 'Restaurante',    desc: 'Menú completo con entradas y platos' },
  { id: 'cafe',       emoji: '☕', label: 'Cafetería',       desc: 'Café, repostería, desayunos' },
  { id: 'bakery',     emoji: '🧁', label: 'Pastelería',     desc: 'Tortas, cupcakes, panes' },
  { id: 'ice_cream',  emoji: '🍦', label: 'Heladería',      desc: 'Helados, malteadas, postres' },
  { id: 'bar',        emoji: '🍸', label: 'Bar',            desc: 'Cocteles, cervezas, picadas' },
  { id: 'food_truck', emoji: '🚚', label: 'Food Truck',     desc: 'Comida callejera, especiales' },
  { id: 'salon',      emoji: '💇', label: 'Salón / Barbería', desc: 'Cortes, color, tratamientos' },
  { id: 'spa',        emoji: '💆', label: 'Spa / Bienestar', desc: 'Masajes, faciales, terapias' },
  { id: 'clinic',     emoji: '🏥', label: 'Clínica / Consultorio', desc: 'Consultas, terapias, procedimientos' },
  { id: 'services',   emoji: '🔧', label: 'Servicios con Agenda', desc: 'Cualquier negocio con citas' },
  { id: 'hotel',      emoji: '🏨', label: 'Hotel',          desc: 'Room service, menú de habitaciones' },
  { id: 'other',      emoji: '🍴', label: 'Otro',           desc: 'Cualquier tipo de negocio' },
];

const Register = () => {
  const navigate = useNavigate();
  const { loginWithGoogle } = useAuth();
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref') || '';

  // ===== STEP MANAGEMENT =====
  // 1 = identity, 2 = business type, 3 = business name + slug
  const [step, setStep] = useState(1);

  // ===== STEP 1 STATE: Identity =====
  const [authMethod, setAuthMethod] = useState(null); // 'google' | 'email'
  const [googleCredential, setGoogleCredential] = useState(null);
  const [googleUser, setGoogleUser] = useState(null);
  const [emailData, setEmailData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  // ===== STEP 2 STATE: Business Type =====
  const [businessType, setBusinessType] = useState(null);

  // ===== STEP 3 STATE: Business Name + Slug =====
  const [businessName, setBusinessName] = useState('');
  const [slugSuggestions, setSlugSuggestions] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [isCustomSlug, setIsCustomSlug] = useState(false);
  const [customSlugAvailable, setCustomSlugAvailable] = useState(null);
  const [isLoadingSlugs, setIsLoadingSlugs] = useState(false);
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [googlePhone, setGooglePhone] = useState('');

  // ===== GOOGLE PLACES AUTOFILL =====
  const [placeId, setPlaceId] = useState(null);
  const [placeFilled, setPlaceFilled] = useState(null); // resumen para mostrar "prellenado desde Google"

  const handlePlaceSelect = (d) => {
    if (d.name) setBusinessName(d.name);
    if (d.placeId) setPlaceId(d.placeId);
    if (authMethod === 'google' && d.phone && !googlePhone.trim()) setGooglePhone(d.phone);
    setPlaceFilled({ address: d.address, rating: d.rating, reviewCount: d.reviewCount });
    setError('');
  };

  // Tras crear la cuenta, vincula el negocio a Google (dirección, horarios, coords, rating)
  const connectPlace = (token) => {
    if (!placeId || !token) return;
    api.post('/places/connect', { placeId }, { headers: { Authorization: `Bearer ${token}` } })
      .catch(() => { /* no bloquea el registro */ });
  };

  // ===== SHARED STATE =====
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const slugDebounceRef = useRef(null);
  const customSlugDebounceRef = useRef(null);

  // ===== SLUG SUGGESTIONS =====
  const fetchSlugSuggestions = useCallback(async (name) => {
    if (!name || name.trim().length < 2) {
      setSlugSuggestions([]);
      setSelectedSlug('');
      return;
    }
    setIsLoadingSlugs(true);
    try {
      const suggestions = await suggestSlugs(name.trim());
      setSlugSuggestions(suggestions);
      if (suggestions.length > 0 && !isCustomSlug) {
        setSelectedSlug(suggestions[0].slug);
      }
    } catch {
      setSlugSuggestions([]);
    } finally {
      setIsLoadingSlugs(false);
    }
  }, [isCustomSlug]);

  useEffect(() => {
    if (step !== 3) return;
    if (slugDebounceRef.current) clearTimeout(slugDebounceRef.current);
    slugDebounceRef.current = setTimeout(() => {
      fetchSlugSuggestions(businessName);
    }, 400);
    return () => clearTimeout(slugDebounceRef.current);
  }, [businessName, step, fetchSlugSuggestions]);

  useEffect(() => {
    if (!isCustomSlug || !customSlug.trim()) {
      setCustomSlugAvailable(null);
      return;
    }
    if (customSlugDebounceRef.current) clearTimeout(customSlugDebounceRef.current);
    setIsCheckingSlug(true);
    customSlugDebounceRef.current = setTimeout(async () => {
      const normalized = customSlug.toLowerCase().trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
      if (!normalized) {
        setCustomSlugAvailable(false);
        setIsCheckingSlug(false);
        return;
      }
      const result = await checkSlug(normalized);
      setCustomSlugAvailable(result.available);
      setSelectedSlug(result.slug);
      setIsCheckingSlug(false);
    }, 500);
    return () => clearTimeout(customSlugDebounceRef.current);
  }, [customSlug, isCustomSlug]);

  // ===== HANDLERS =====
  const handleEmailChange = (e) => {
    const { name, value } = e.target;
    setEmailData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setIsGoogleLoading(true);
    try {
      const credential = credentialResponse.credential;
      setGoogleCredential(credential);
      const result = await googleAuth(credential);
      if (result.needsBusinessName) {
        setGoogleUser(result.googleUser);
        setAuthMethod('google');
        setStep(2); // Go to business type selection
      } else if (result.token) {
        loginWithGoogle(result);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error al autenticar con Google. Intenta nuevamente.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleEmailStep1 = (e) => {
    e.preventDefault();
    setError('');
    const { firstName, lastName, email, password, confirmPassword, phone } = emailData;
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setError('Todos los campos son obligatorios');
      return;
    }
    if (!phone.trim() || phone.trim().length < 7) {
      setError('El número de WhatsApp es obligatorio');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (!acceptTerms) {
      setError('Debes aceptar los términos y condiciones');
      return;
    }
    setAuthMethod('email');
    setStep(2); // Go to business type selection
  };

  const handleSelectBusinessType = (typeId) => {
    setBusinessType(typeId);
    setError('');
    setTimeout(() => setStep(3), 300);
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setError('');
    if (!businessName.trim()) {
      setError('El nombre del negocio es obligatorio');
      return;
    }
    const finalSlug = isCustomSlug
      ? customSlug.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '')
      : selectedSlug;
    if (!finalSlug) {
      setError('Selecciona o escribe un enlace para tu menú');
      return;
    }
    if (isCustomSlug && customSlugAvailable === false) {
      setError('El enlace personalizado no está disponible');
      return;
    }
    setIsLoading(true);
    try {
      if (authMethod === 'google') {
        if (!googlePhone.trim() || googlePhone.trim().length < 7) {
          setError('El número de WhatsApp es obligatorio');
          setIsLoading(false);
          return;
        }
        const result = await googleAuth(googleCredential, businessName.trim(), finalSlug, businessType, googlePhone.trim(), referralCode);
        if (result.token) {
          connectPlace(result.token);
          loginWithGoogle(result);
        }
      } else {
        const result = await registerUser({
          name: `${emailData.firstName} ${emailData.lastName}`.trim(),
          businessName: businessName.trim(),
          email: emailData.email,
          password: emailData.password,
          phone: emailData.phone,
          slug: finalSlug,
          businessType,
          referralCode
        });
        if (result.token) {
          connectPlace(result.token);
          loginWithGoogle(result);
        } else {
          navigate('/login', { state: { message: '¡Cuenta creada exitosamente! Inicia sesión.' } });
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error al crear la cuenta. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // ===== STEP INDICATOR =====
  const StepIndicator = ({ currentStep }) => {
    const steps = [
      { num: 1, label: 'Cuenta' },
      { num: 2, label: 'Tipo' },
      { num: 3, label: 'Negocio' }
    ];
    return (
      <div className="flex items-center justify-center mb-6">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          {steps.map((s, i) => (
            <React.Fragment key={s.num}>
              {i > 0 && <div className="w-6 h-px bg-gray-300" />}
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                currentStep > s.num
                  ? 'bg-green-500 text-white'
                  : currentStep === s.num
                    ? 'bg-[#E8002D] text-white'
                    : 'bg-gray-200 text-gray-400'
              }`}>
                {currentStep > s.num ? '✓' : s.num}
              </span>
              <span className={`${currentStep >= s.num ? 'text-gray-900 font-medium' : ''}`}>{s.label}</span>
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  // ===========================
  // STEP 3 - Business Name + Slug
  // ===========================
  if (step === 3) {
    const selectedType = BUSINESS_TYPES.find(t => t.id === businessType);
    return (
      <div className="min-h-screen bg-[#FBFAF8]">
        <section className="py-12 sm:py-20 bg-gradient-to-br from-[#FBFAF8] via-[#FBEEE9] to-[#FBFAF8]">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="max-w-md mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center mb-6"
              >
                {authMethod === 'google' && googleUser?.picture ? (
                  <img src={googleUser.picture} alt={googleUser.name}
                    className="w-14 h-14 rounded-full mx-auto mb-3 border-2 border-[#E8002D] shadow-md" />
                ) : (
                  <div className="w-14 h-14 bg-[#E8002D] rounded-full flex items-center justify-center mx-auto mb-3 shadow-md">
                    <span className="text-white font-bold text-xl">
                      {authMethod === 'google' ? googleUser?.name?.[0] : emailData.firstName[0]?.toUpperCase()}
                    </span>
                  </div>
                )}
                <h1 className="text-2xl font-extrabold text-[#17120F] mb-1" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.02em' }}>
                  {selectedType?.emoji} {selectedType?.label}
                </h1>
                <p className="text-sm text-gray-500">
                  Ahora ponle nombre a tu negocio
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="bg-white rounded-[26px] shadow-[0_20px_60px_rgba(23,18,15,0.10)] border border-[#EFEAE3] p-6 sm:p-8"
              >
                <StepIndicator currentStep={3} />

                <form onSubmit={handleCreateAccount} className="space-y-5">
                  {error && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm" role="alert" aria-live="polite">
                      {error}
                    </motion.div>
                  )}

                  {/* Autofill desde Google (opcional) */}
                  <div className="rounded-2xl border border-[#EFEAE3] bg-[#FBFAF8] p-3.5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 010-4.2V7.06H2.18a11 11 0 000 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
                      <span className="text-xs font-semibold text-gray-600">¿Tu negocio ya está en Google?</span>
                    </div>
                    <GooglePlaceSearch
                      onSelect={handlePlaceSelect}
                      placeholder="Busca tu negocio…"
                      accentColor="#E8002D"
                    />
                    {placeFilled && (
                      <div className="mt-2 flex items-start gap-1.5 text-[11px] text-green-700 bg-green-50 rounded-lg px-2.5 py-1.5">
                        <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        <span>
                          Prellenaremos dirección, horarios y ubicación
                          {typeof placeFilled.rating === 'number' && placeFilled.rating > 0 && <> · ⭐ {placeFilled.rating} ({placeFilled.reviewCount})</>}
                        </span>
                      </div>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1.5">Opcional — puedes escribir el nombre a mano abajo.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre del negocio</label>
                    <input type="text" value={businessName}
                      onChange={(e) => { setBusinessName(e.target.value); setError(''); }}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#E8002D] focus:border-[#E8002D] transition-colors text-gray-900 bg-white"
                      placeholder={businessType === 'cafe' ? 'Ej: Café Aroma' : businessType === 'bakery' ? 'Ej: Dulces Delicias' : businessType === 'salon' ? 'Ej: Barbería Style' : businessType === 'spa' ? 'Ej: Spa Zen' : businessType === 'clinic' ? 'Ej: Fisio Salud' : businessType === 'services' ? 'Ej: Studio Pro' : 'Ej: La Parrilla de Juan'} />
                  </div>

                  {authMethod === 'google' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">WhatsApp</label>
                      <input type="tel" value={googlePhone}
                        onChange={(e) => { setGooglePhone(e.target.value); setError(''); }}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#E8002D] focus:border-[#E8002D] transition-colors text-gray-900 bg-white"
                        placeholder="+57 300 123 4567" />
                    </div>
                  )}

                  <AnimatePresence>
                    {(slugSuggestions.length > 0 || isLoadingSlugs) && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Elige tu enlace</label>
                        <p className="text-xs text-gray-400 mb-2">
                          Tu menú estará en: <span className="font-mono text-gray-600">menuby.tech/<span className="text-[#E8002D]">{isCustomSlug ? (customSlug || '...') : (selectedSlug || '...')}</span>/menu</span>
                        </p>

                        {isLoadingSlugs ? (
                          <div className="flex items-center justify-center py-4">
                            <svg className="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {slugSuggestions.map((s) => (
                              <label key={s.slug}
                                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                                  !isCustomSlug && selectedSlug === s.slug
                                    ? 'border-[#E8002D] bg-red-50 ring-1 ring-[#E8002D]'
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                                onClick={() => { setIsCustomSlug(false); setSelectedSlug(s.slug); }}>
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                  !isCustomSlug && selectedSlug === s.slug ? 'border-[#E8002D]' : 'border-gray-300'
                                }`}>
                                  {!isCustomSlug && selectedSlug === s.slug && <div className="w-2 h-2 rounded-full bg-[#E8002D]" />}
                                </div>
                                <span className="font-mono text-sm text-gray-700 flex-1">
                                  menuby.tech/<span className="text-[#E8002D] font-semibold">{s.slug}</span>/menu
                                </span>
                                <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">disponible</span>
                              </label>
                            ))}

                            <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                              isCustomSlug ? 'border-[#E8002D] bg-red-50 ring-1 ring-[#E8002D]' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`} onClick={() => setIsCustomSlug(true)}>
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                isCustomSlug ? 'border-[#E8002D]' : 'border-gray-300'
                              }`}>
                                {isCustomSlug && <div className="w-2 h-2 rounded-full bg-[#E8002D]" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm text-gray-600">Personalizar enlace</span>
                                {isCustomSlug && (
                                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2">
                                    <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                                      <span>menuby.tech/</span>
                                    </div>
                                    <div className="relative">
                                      <input type="text" value={customSlug}
                                        onChange={(e) => { setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setCustomSlugAvailable(null); setError(''); }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#E8002D] focus:border-[#E8002D] pr-8"
                                        placeholder="mi-negocio" autoFocus />
                                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                                        {isCheckingSlug ? (
                                          <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                          </svg>
                                        ) : customSlugAvailable === true ? (
                                          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                          </svg>
                                        ) : customSlugAvailable === false ? (
                                          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                          </svg>
                                        ) : null}
                                      </div>
                                    </div>
                                    {customSlugAvailable === false && <p className="text-xs text-red-500 mt-1">Este enlace no está disponible</p>}
                                    {customSlugAvailable === true && <p className="text-xs text-green-600 mt-1">¡Disponible!</p>}
                                  </motion.div>
                                )}
                              </div>
                            </label>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button type="submit"
                    disabled={isLoading || (isCustomSlug && (isCheckingSlug || customSlugAvailable === false))}
                    className="w-full py-3.5 bg-[#E8002D] hover:bg-[#A80020] disabled:bg-red-300 text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-[1.02] disabled:scale-100 flex items-center justify-center text-base">
                    {isLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Creando tu menú...
                      </>
                    ) : (
                      <>Crear mi menú digital
                        <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </>
                    )}
                  </button>
                </form>

                <button onClick={() => { setStep(2); setError(''); setBusinessName(''); setSlugSuggestions([]); setSelectedSlug(''); }}
                  className="mt-4 w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors">
                  ← Volver
                </button>
              </motion.div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // ===========================
  // STEP 2 - Business Type
  // ===========================
  if (step === 2) {
    return (
      <div className="min-h-screen bg-[#FBFAF8]">
        <section className="py-12 sm:py-20 bg-gradient-to-br from-[#FBFAF8] via-[#FBEEE9] to-[#FBFAF8]">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="max-w-md mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center mb-6"
              >
                {authMethod === 'google' && googleUser?.picture ? (
                  <img src={googleUser.picture} alt={googleUser.name}
                    className="w-14 h-14 rounded-full mx-auto mb-3 border-2 border-[#E8002D] shadow-md" />
                ) : (
                  <div className="w-14 h-14 bg-[#E8002D] rounded-full flex items-center justify-center mx-auto mb-3 shadow-md">
                    <span className="text-white font-bold text-xl">
                      {authMethod === 'google' ? googleUser?.name?.[0] : emailData.firstName[0]?.toUpperCase()}
                    </span>
                  </div>
                )}
                <h1 className="text-2xl font-extrabold text-[#17120F] mb-1" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.02em' }}>
                  ¿Qué tipo de negocio tienes?
                </h1>
                <p className="text-sm text-gray-500">
                  Esto nos ayuda a configurar tu menú automáticamente
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="bg-white rounded-[26px] shadow-[0_20px_60px_rgba(23,18,15,0.10)] border border-[#EFEAE3] p-6 sm:p-8"
              >
                <StepIndicator currentStep={2} />

                <div className="grid grid-cols-2 gap-3">
                  {BUSINESS_TYPES.map((type, index) => (
                    <motion.button
                      key={type.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      onClick={() => handleSelectBusinessType(type.id)}
                      className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 group hover:shadow-md ${
                        businessType === type.id
                          ? 'border-[#E8002D] bg-red-50 ring-1 ring-[#E8002D] shadow-md'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-3xl mb-2">{type.emoji}</div>
                      <h3 className={`text-sm font-bold mb-0.5 ${businessType === type.id ? 'text-[#E8002D]' : 'text-gray-900'}`}>
                        {type.label}
                      </h3>
                      <p className="text-[11px] text-gray-400 leading-tight">{type.desc}</p>

                      {businessType === type.id && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute top-2 right-2 w-5 h-5 bg-[#E8002D] rounded-full flex items-center justify-center"
                        >
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </motion.div>
                      )}
                    </motion.button>
                  ))}
                </div>

                <p className="text-xs text-gray-400 text-center mt-4">
                  Se crearán categorías automáticas según tu tipo de negocio. Podrás editarlas después.
                </p>

                <button onClick={() => { setStep(1); setAuthMethod(null); setError(''); setBusinessType(null); }}
                  className="mt-4 w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors">
                  ← Volver
                </button>
              </motion.div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // ===========================
  // STEP 1 - Identity
  // ===========================
  return (
    <div className="min-h-screen bg-[#FBFAF8]">
      <section className="py-12 sm:py-20 bg-gradient-to-br from-[#FBFAF8] via-[#FBEEE9] to-[#FBFAF8]">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-md mx-auto">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }} className="text-center mb-6">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#17120F] mb-1" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.025em' }}>Crea tu menú digital gratis</h1>
              <p className="text-[#6E655C] text-sm">Tu negocio online en 2 minutos</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sm:p-8">
              <StepIndicator currentStep={1} />

              {error && !showEmailForm && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                  className="p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-start" role="alert" aria-live="polite">
                  <svg className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{error}</span>
                </motion.div>
              )}

              {/* ===== GOOGLE SIGN-IN - HERO SECTION ===== */}
              <div className="mb-6">
                <div className="bg-gradient-to-b from-[#FBEEE9] to-white border border-[#F0D8CF] rounded-2xl p-6 text-center">
                  <div className="flex justify-center mb-4">
                    <div className="bg-white rounded-2xl shadow-md p-1 inline-block">
                      <GoogleLogin onSuccess={handleGoogleSuccess}
                        onError={() => setError('Error al conectar con Google')}
                        text="signup_with" shape="pill" size="large" width="320" theme="filled_blue" locale="es"
                        logo_alignment="center" />
                    </div>
                  </div>

                  {isGoogleLoading && (
                    <div className="flex items-center justify-center mb-3 gap-2">
                      <svg className="animate-spin h-4 w-4 text-[#E8002D]" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className="text-sm text-[#E8002D] font-medium">Verificando con Google...</span>
                    </div>
                  )}

                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    ⚡ La forma más rápida de empezar
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      Sin contraseñas
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      Verificación instantánea
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      Más seguro
                    </span>
                  </div>
                </div>
              </div>

              {/* ===== EMAIL SECTION - COLLAPSIBLE ===== */}
              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center">
                  <button
                    type="button"
                    onClick={() => { setShowEmailForm(!showEmailForm); setError(''); }}
                    className="px-4 py-1 bg-white text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1.5 group"
                  >
                    o con email y contraseña
                    <svg className={`w-3 h-3 transition-transform duration-300 ${showEmailForm ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {showEmailForm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <form onSubmit={handleEmailStep1} className="space-y-4 pt-2">
                      {error && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                          className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-start" role="alert" aria-live="polite">
                          <svg className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          <span>{error}</span>
                        </motion.div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="firstName" className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
                          <input type="text" id="firstName" name="firstName" value={emailData.firstName} onChange={handleEmailChange} required
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#E8002D] focus:border-[#E8002D] transition-colors text-gray-900 bg-white"
                            placeholder="Juan" />
                        </div>
                        <div>
                          <label htmlFor="lastName" className="block text-xs font-medium text-gray-600 mb-1">Apellido</label>
                          <input type="text" id="lastName" name="lastName" value={emailData.lastName} onChange={handleEmailChange} required
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#E8002D] focus:border-[#E8002D] transition-colors text-gray-900 bg-white"
                            placeholder="Pérez" />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="email" className="block text-xs font-medium text-gray-600 mb-1">Correo electrónico</label>
                        <input type="email" id="email" name="email" value={emailData.email} onChange={handleEmailChange} required
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#E8002D] focus:border-[#E8002D] transition-colors text-gray-900 bg-white"
                          placeholder="tu@email.com" />
                      </div>

                      <div>
                        <label htmlFor="phone" className="block text-xs font-medium text-gray-600 mb-1">
                          WhatsApp
                        </label>
                        <input type="tel" id="phone" name="phone" value={emailData.phone} onChange={handleEmailChange} required
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#E8002D] focus:border-[#E8002D] transition-colors text-gray-900 bg-white"
                          placeholder="+57 300 123 4567" />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="password" className="block text-xs font-medium text-gray-600 mb-1">Contraseña</label>
                          <div className="relative">
                            <input type={showPassword ? 'text' : 'password'} id="password" name="password" value={emailData.password}
                              onChange={handleEmailChange} required
                              className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#E8002D] focus:border-[#E8002D] transition-colors text-gray-900 bg-white"
                              placeholder="Mín. 8 caracteres" />
                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {showPassword ? (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                                ) : (
                                  <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                                )}
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div>
                          <label htmlFor="confirmPassword" className="block text-xs font-medium text-gray-600 mb-1">Confirmar</label>
                          <div className="relative">
                            <input type={showConfirmPassword ? 'text' : 'password'} id="confirmPassword" name="confirmPassword"
                              value={emailData.confirmPassword} onChange={handleEmailChange} required
                              className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#E8002D] focus:border-[#E8002D] transition-colors text-gray-900 bg-white"
                              placeholder="Repetir" />
                            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {showConfirmPassword ? (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                                ) : (
                                  <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                                )}
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start pt-1">
                        <input type="checkbox" id="acceptTerms" checked={acceptTerms}
                          onChange={(e) => setAcceptTerms(e.target.checked)}
                          className="w-4 h-4 text-[#E8002D] border-gray-300 rounded focus:ring-[#E8002D] mt-0.5" />
                        <label htmlFor="acceptTerms" className="ml-2 text-xs text-gray-500">
                          Acepto los{' '}<Link to="/terms" className="text-[#E8002D] hover:underline">términos</Link>{' '}
                          y la{' '}<Link to="/privacy" className="text-[#E8002D] hover:underline">política de privacidad</Link>
                        </label>
                      </div>

                      <button type="submit"
                        className="w-full py-3 bg-[#E8002D] hover:bg-[#A80020] text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-[1.02] flex items-center justify-center">
                        Continuar
                        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500">
                  ¿Ya tienes cuenta?{' '}
                  <Link to="/login" className="text-[#E8002D] hover:text-[#A80020] font-semibold">Inicia sesión</Link>
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Register;
