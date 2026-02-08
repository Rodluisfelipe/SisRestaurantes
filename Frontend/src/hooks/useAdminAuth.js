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
      const getCookie = (name) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
      };

      const params = new URLSearchParams(location.search);
      const satoken = params.get('satoken');
      const fromSuperAdmin = params.get('source') === 'superadmin';

      // Check URL parameter
      if (satoken) {
        try {
          const tokenData = JSON.parse(decodeURIComponent(satoken));
          localStorage.setItem('accessToken', tokenData.accessToken);
          localStorage.setItem('refreshToken', tokenData.refreshToken);
          localStorage.setItem('user', JSON.stringify(tokenData.user));
          if (businessId) localStorage.setItem('businessSlug', businessId);
          navigate(location.pathname, { replace: true });
          window.location.reload();
          return;
        } catch (error) {
          console.error('Error parsing SuperAdmin token:', error);
        }
      }

      if (!fromSuperAdmin) return;

      // Check temp localStorage
      const tempAccessToken = localStorage.getItem('temp_accessToken');
      const tempRefreshToken = localStorage.getItem('temp_refreshToken');
      const tempUser = localStorage.getItem('temp_user');

      if (tempAccessToken && tempRefreshToken && tempUser) {
        try {
          localStorage.setItem('accessToken', tempAccessToken);
          localStorage.setItem('refreshToken', tempRefreshToken);
          localStorage.setItem('user', tempUser);
          if (businessId) localStorage.setItem('businessSlug', businessId);
          localStorage.removeItem('temp_accessToken');
          localStorage.removeItem('temp_refreshToken');
          localStorage.removeItem('temp_user');
          localStorage.removeItem('temp_businessSlug');
          navigate(location.pathname, { replace: true });
          window.location.reload();
          return;
        } catch (error) {
          console.error('Error handling temp tokens:', error);
        }
      }

      // Check cookies as last resort
      const cookieAccessToken = getCookie('sa_accessToken');
      const cookieRefreshToken = getCookie('sa_refreshToken');
      const cookieUser = getCookie('sa_user');

      if (cookieAccessToken && cookieRefreshToken && cookieUser) {
        try {
          localStorage.setItem('accessToken', cookieAccessToken);
          localStorage.setItem('refreshToken', cookieRefreshToken);
          localStorage.setItem('user', decodeURIComponent(cookieUser));
          if (businessId) localStorage.setItem('businessSlug', businessId);
          document.cookie = 'sa_accessToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
          document.cookie = 'sa_refreshToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
          document.cookie = 'sa_user=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
          document.cookie = 'sa_businessSlug=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
          navigate(location.pathname, { replace: true });
          window.location.reload();
        } catch (error) {
          console.error('Error handling cookie tokens:', error);
        }
      }
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
