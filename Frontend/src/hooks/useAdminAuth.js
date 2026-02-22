import { useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../Context/AuthContext';
import { isValidBusinessIdentifier } from '../utils/isValidObjectId';

/**
 * Custom hook que encapsula toda la lógica de autenticación del Admin:
 * - SuperAdmin token handling (URL / localStorage / cookies)
 * - Validación de businessId (con protección contra bucles)
 * - Validación de autenticación (con protección contra bucles)
 * - Computed isSuperAdminMode
 *
 * Extraído de Admin.jsx (~200 líneas de useEffects de auth).
 */
export default function useAdminAuth(businessId) {
  const { isAuthenticated, logout, user, login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectionCountRef = useRef(0);
  const initialRenderRef = useRef(true);

  const isSuperAdminMode = user?.role === 'superadmin'
    || user?.username === 'superadmin_temp'
    || window.location.pathname.includes('/superadmin');

  // --- SuperAdmin token desde la URL ---
  useEffect(() => {
    const handleSuperAdminToken = () => {
      const params = new URLSearchParams(location.search);
      const fromSuperAdmin = params.get('source') === 'superadmin';

      // Check localStorage handoff (secure same-origin token transfer)
      const handoff = localStorage.getItem('sa_handoff');
      if (handoff) {
        try {
          const tokenData = JSON.parse(handoff);
          localStorage.removeItem('sa_handoff'); // Consume immediately

          // Verify TTL — reject handoffs older than 10 seconds
          if (tokenData._ts && tokenData._ttl && (Date.now() - tokenData._ts > tokenData._ttl)) {
            console.warn('SA handoff expired');
            return;
          }

          localStorage.setItem('accessToken', tokenData.accessToken);
          if (tokenData.refreshToken) localStorage.setItem('refreshToken', tokenData.refreshToken);
          localStorage.setItem('user', JSON.stringify(tokenData.user));
          if (businessId) localStorage.setItem('businessSlug', businessId);
          navigate(location.pathname, { replace: true });
          window.location.reload();
          return;
        } catch (error) {
          localStorage.removeItem('sa_handoff');
          console.error('Error parsing SA handoff:', error);
        }
      }

      if (!fromSuperAdmin) return;
      // No legacy fallbacks — sa_handoff with TTL is the only supported handoff mechanism
    };

    handleSuperAdminToken();
  }, [location, navigate, businessId]);

  // --- Validación de businessId ---
  useEffect(() => {
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      return;
    }

    const isValidId = isValidBusinessIdentifier(businessId);
    const isValidSlug = typeof businessId === 'string' && businessId.length > 0 && businessId !== 'undefined';

    if (!isValidId && !isValidSlug && redirectionCountRef.current < 2) {
      redirectionCountRef.current += 1;
      navigate('/', { replace: true });
    }
  }, [businessId, navigate]);

  // --- Validación de autenticación ---
  useEffect(() => {
    if (initialRenderRef.current) return;

    if (!loading && !isAuthenticated) {
      if (redirectionCountRef.current < 2) {
        redirectionCountRef.current += 1;
        navigate('/login', { replace: true });
      }
    } else {
      redirectionCountRef.current = 0;
    }
  }, [isAuthenticated, loading, navigate]);

  return {
    isAuthenticated,
    user,
    loading,
    logout,
    isSuperAdminMode,
  };
}
