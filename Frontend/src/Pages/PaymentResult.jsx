import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaCheckCircle, FaClock, FaTimes, FaArrowRight, FaShieldAlt } from 'react-icons/fa';
import api from '../services/api';

/**
 * Página pública de resultado de pago ePayco.
 * No requiere autenticación — accesible después del redirect de ePayco.
 * Ruta: /:businessId/payment-result?ref=...&status=...
 */
const PaymentResult = () => {
  const [searchParams] = useSearchParams();
  const { businessId: slug } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [details, setDetails] = useState(null);
  const [businessName, setBusinessName] = useState('');

  const ref = searchParams.get('ref') || '';
  const statusCode = searchParams.get('status') || '';

  useEffect(() => {
    // Cargar nombre del negocio
    const loadBusiness = async () => {
      try {
        const res = await api.get(`/business-config/by-slug/${slug}`);
        if (res.data?.businessName) setBusinessName(res.data.businessName);
      } catch (e) {
        // ignore
      }
    };
    loadBusiness();
  }, [slug]);

  useEffect(() => {
    // Interpretar el código de respuesta de ePayco
    const code = parseInt(statusCode);
    if (code === 1) {
      setStatus('approved');
      setDetails({ message: '¡Tu pago fue aprobado exitosamente!' });
    } else if (code === 3) {
      setStatus('pending');
      setDetails({ message: 'Tu pago está siendo procesado. Te notificaremos cuando se confirme.' });
    } else if (code === 2 || code === 4) {
      setStatus('failed');
      setDetails({ message: 'El pago no fue aprobado. Puedes intentar de nuevo.' });
    } else if (statusCode === '') {
      // Sin código — intentar verificar por referencia
      setStatus('pending');
      setDetails({ message: 'Verificando estado del pago...' });
    } else {
      setStatus('failed');
      setDetails({ message: 'No se pudo verificar el estado del pago.' });
    }
  }, [statusCode, ref]);

  const goToAdmin = () => {
    navigate(`/${slug}/admin?tab=subscription`);
  };

  const goToMenu = () => {
    navigate(`/${slug}`);
  };

  const statusConfig = {
    loading: {
      icon: <FaClock className="text-slate-400" />,
      bg: 'from-slate-800 to-slate-900',
      title: 'Verificando...',
      color: 'text-slate-400',
    },
    approved: {
      icon: <FaCheckCircle className="text-emerald-400" />,
      bg: 'from-emerald-900/50 to-slate-900',
      title: '¡Pago Exitoso!',
      color: 'text-emerald-400',
    },
    pending: {
      icon: <FaClock className="text-amber-400" />,
      bg: 'from-amber-900/50 to-slate-900',
      title: 'Pago Pendiente',
      color: 'text-amber-400',
    },
    failed: {
      icon: <FaTimes className="text-red-400" />,
      bg: 'from-red-900/50 to-slate-900',
      title: 'Pago No Completado',
      color: 'text-red-400',
    },
  };

  const config = statusConfig[status] || statusConfig.loading;

  return (
    <div className={`min-h-screen bg-gradient-to-br ${config.bg} flex items-center justify-center p-4`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-slate-800/90 backdrop-blur-xl rounded-2xl p-8 max-w-md w-full shadow-2xl border border-slate-700/50 text-center"
      >
        {/* Icono principal */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="text-6xl mb-6 flex justify-center"
        >
          {config.icon}
        </motion.div>

        {/* Título */}
        <h1 className={`text-2xl font-bold ${config.color} mb-2`}>
          {config.title}
        </h1>

        {/* Negocio */}
        {businessName && (
          <p className="text-slate-400 text-sm mb-4">{businessName}</p>
        )}

        {/* Mensaje */}
        <p className="text-slate-300 mb-6">
          {details?.message}
        </p>

        {/* Referencia */}
        {ref && (
          <div className="bg-slate-900/50 rounded-lg p-3 mb-6">
            <p className="text-xs text-slate-500 mb-1">Referencia</p>
            <p className="text-sm text-slate-300 font-mono break-all">{ref}</p>
          </div>
        )}

        {/* Info adicional para aprobado */}
        {status === 'approved' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-emerald-900/20 border border-emerald-800/30 rounded-lg p-4 mb-6"
          >
            <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm">
              <FaShieldAlt />
              <span>Tu suscripción ha sido activada</span>
            </div>
          </motion.div>
        )}

        {/* Info adicional para pendiente */}
        {status === 'pending' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-amber-900/20 border border-amber-800/30 rounded-lg p-4 mb-6"
          >
            <p className="text-amber-400/80 text-xs">
              El pago puede tardar unos minutos en confirmarse. Tu suscripción se activará automáticamente.
            </p>
          </motion.div>
        )}

        {/* Botones */}
        <div className="space-y-3">
          <button
            onClick={goToAdmin}
            className="w-full py-3 px-4 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <span>Ir al Panel de Administración</span>
            <FaArrowRight className="text-xs" />
          </button>
          
          <button
            onClick={goToMenu}
            className="w-full py-2 px-4 text-slate-400 hover:text-slate-300 text-sm transition-colors"
          >
            Ver Menú
          </button>
        </div>

        {/* Footer */}
        <p className="text-xs text-slate-600 mt-6">
          Pago procesado por ePayco de forma segura
        </p>
      </motion.div>
    </div>
  );
};

export default PaymentResult;
