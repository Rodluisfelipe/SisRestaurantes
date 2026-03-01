import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';

/**
 * Página pública de resultado de pago ePayco.
 * No requiere autenticación — accesible después del redirect de ePayco.
 * Restaura la sesión desde localStorage para que "Ir al Panel" funcione sin re-login.
 * Ruta: /:businessId/payment-result?ref=...&status=...
 */
const PaymentResult = () => {
  const [searchParams] = useSearchParams();
  const { businessId: slug } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [businessName, setBusinessName] = useState('');
  const [businessLogo, setBusinessLogo] = useState('');

  const ref = searchParams.get('ref') || '';
  const statusCode = searchParams.get('status') || '';

  // Restaurar sesión desde localStorage al montar (ePayco borra sessionStorage al redirigir)
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    const user = localStorage.getItem('user');
    
    if (token && !sessionStorage.getItem('accessToken')) {
      sessionStorage.setItem('accessToken', token);
      if (refreshToken) sessionStorage.setItem('refreshToken', refreshToken);
      if (user) sessionStorage.setItem('user', user);
      
      if (!sessionStorage.getItem('sessionId')) {
        const sessionId = `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('sessionId', sessionId);
      }
    }
  }, []);

  useEffect(() => {
    const loadBusiness = async () => {
      try {
        const res = await api.get(`/business-config/by-slug/${slug}`);
        if (res.data?.businessName) setBusinessName(res.data.businessName);
        if (res.data?.logo) setBusinessLogo(res.data.logo);
      } catch (e) {
        // ignore
      }
    };
    loadBusiness();
  }, [slug]);

  useEffect(() => {
    const code = parseInt(statusCode);
    if (code === 1) {
      setStatus('approved');
    } else if (code === 3) {
      setStatus('pending');
    } else if (code === 2 || code === 4) {
      setStatus('failed');
    } else {
      setStatus('pending');
    }
  }, [statusCode]);

  const goToAdmin = () => {
    navigate(`/${slug}/admin?tab=subscription`);
  };

  const goToMenu = () => {
    navigate(`/${slug}`);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-2xl p-6 max-w-sm w-full text-center border border-[#DCE4F5] shadow-xl"
      >
        {/* Logo del negocio */}
        {businessLogo && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            className="mb-4"
          >
            <img 
              src={businessLogo} 
              alt={businessName} 
              className="w-16 h-16 mx-auto rounded-full object-cover border-2 border-[#DCE4F5] shadow-md"
            />
          </motion.div>
        )}

        {/* Icono de estado */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="mb-5"
        >
          {status === 'approved' && (
            <div className="w-20 h-20 mx-auto rounded-full bg-emerald-50 flex items-center justify-center border-2 border-emerald-200">
              <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <motion.path
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 0.4, duration: 0.6 }}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          )}
          {status === 'pending' && (
            <div className="w-20 h-20 mx-auto rounded-full bg-amber-50 flex items-center justify-center border-2 border-amber-200">
              <svg className="w-10 h-10 text-amber-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          )}
          {status === 'failed' && (
            <div className="w-20 h-20 mx-auto rounded-full bg-red-50 flex items-center justify-center border-2 border-red-200">
              <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
          {status === 'loading' && (
            <div className="w-20 h-20 mx-auto rounded-full bg-gray-50 flex items-center justify-center border-2 border-[#DCE4F5]">
              <div className="w-8 h-8 border-3 border-[#3A7AFF]/30 border-t-[#3A7AFF] rounded-full animate-spin" />
            </div>
          )}
        </motion.div>

        {/* Título */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={`text-xl font-bold mb-1 ${
            status === 'approved' ? 'text-emerald-700' :
            status === 'pending' ? 'text-amber-700' :
            status === 'failed' ? 'text-red-700' :
            'text-[#1F2937]'
          }`}
        >
          {status === 'approved' && '¡Pago Exitoso!'}
          {status === 'pending' && 'Pago en Proceso'}
          {status === 'failed' && 'Pago No Completado'}
          {status === 'loading' && 'Verificando...'}
        </motion.h1>

        {/* Nombre del negocio */}
        {businessName && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="text-sm text-[#6C7A92] mb-4"
          >
            {businessName}
          </motion.p>
        )}

        {/* Mensaje */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-sm text-[#6C7A92] mb-5 leading-relaxed"
        >
          {status === 'approved' && '¡Tu pago fue aprobado! Tu suscripción se ha activado correctamente.'}
          {status === 'pending' && 'Tu pago está siendo procesado. La suscripción se activará automáticamente cuando se confirme.'}
          {status === 'failed' && 'El pago no fue completado. Puedes intentar nuevamente desde el panel.'}
          {status === 'loading' && 'Verificando el estado de tu pago...'}
        </motion.p>

        {/* Card de estado - Aprobado */}
        {status === 'approved' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 mb-5"
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-semibold text-emerald-700">Suscripción Activa</span>
            </div>
          </motion.div>
        )}

        {/* Card de estado - Pendiente */}
        {status === 'pending' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-amber-50 rounded-xl border border-amber-200 p-4 mb-5"
          >
            <div className="flex items-center justify-center gap-2">
              <div className="w-3 h-3 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
              <span className="text-sm font-medium text-amber-700">Esperando confirmación del banco</span>
            </div>
            <p className="text-xs text-amber-600/70 mt-2">
              Puede tardar unos minutos. Tu suscripción se activará automáticamente.
            </p>
          </motion.div>
        )}

        {/* Card de estado - Fallido */}
        {status === 'failed' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-red-50 rounded-xl border border-red-200 p-4 mb-5"
          >
            <p className="text-xs text-red-600">
              Si se descontó dinero, será devuelto automáticamente. Si el problema persiste, contacta soporte.
            </p>
          </motion.div>
        )}

        {/* Referencia */}
        {ref && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="bg-[#F4F6FB] rounded-lg p-3 mb-5"
          >
            <p className="text-[10px] text-[#6C7A92] uppercase tracking-wider mb-1">Referencia de pago</p>
            <p className="text-xs text-[#1F2937] font-mono break-all">{ref}</p>
          </motion.div>
        )}

        {/* Botones */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="space-y-3"
        >
          <button
            onClick={goToAdmin}
            className="w-full py-3 px-4 bg-[#3A7AFF] hover:bg-[#3A7AFF]/90 active:scale-[0.98] text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-[#3A7AFF]/20 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span>Ir al Panel</span>
          </button>
          
          <button
            onClick={goToMenu}
            className="w-full py-2.5 px-4 bg-white hover:bg-[#F4F6FB] text-[#6C7A92] hover:text-[#1F2937] text-sm font-medium rounded-xl transition-all border border-[#DCE4F5] flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>Ver Menú</span>
          </button>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-6 flex items-center justify-center gap-1.5"
        >
          <svg className="w-3 h-3 text-[#6C7A92]/50" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          <span className="text-[10px] text-[#6C7A92]/50">Pago seguro con ePayco</span>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default PaymentResult;
