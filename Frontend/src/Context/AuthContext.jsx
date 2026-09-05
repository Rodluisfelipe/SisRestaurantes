import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { getBusinessBySlug, refreshClient } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMultiSessionWarning, setShowMultiSessionWarning] = useState(false);
  const navigate = useNavigate();

  // Helper para guardar tokens
  const saveTokens = (token, refreshToken, userObj) => {
    // Generar un ID único para esta sesión
    const sessionId = `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Limpiar sesiones previas de ESTE navegador antes de guardar
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('accessToken_admin_') || 
          key.startsWith('refreshToken_admin_') || 
          key.startsWith('user_admin_')) {
        localStorage.removeItem(key);
      }
    });
    
    // Guardar en sessionStorage para esta sesión específica
    sessionStorage.setItem('accessToken', token);
    sessionStorage.setItem('refreshToken', refreshToken);
    sessionStorage.setItem('user', JSON.stringify(userObj));
    sessionStorage.setItem('sessionId', sessionId);
    
    // También guardar en localStorage para persistencia, pero con prefijo único
    localStorage.setItem(`accessToken_${sessionId}`, token);
    localStorage.setItem(`refreshToken_${sessionId}`, refreshToken);
    localStorage.setItem(`user_${sessionId}`, JSON.stringify(userObj));
    
    // Mantener el último token activo en localStorage sin prefijo para compatibilidad
    localStorage.setItem('accessToken', token);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(userObj));
  };

  // Helper para detectar múltiples sesiones
  const checkMultipleSessions = () => {
    // Limpiar primero sesiones huérfanas (>24h) automáticamente
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('accessToken_admin_')) {
        // Extraer timestamp del sessionId: admin_<TIMESTAMP>_<random>
        const match = key.match(/accessToken_admin_(\d+)_/);
        if (match && now - parseInt(match[1]) > maxAge) {
          const sessionId = key.substring(key.indexOf('_') + 1);
          localStorage.removeItem(`accessToken_${sessionId}`);
          localStorage.removeItem(`refreshToken_${sessionId}`);
          localStorage.removeItem(`user_${sessionId}`);
        }
      }
    });

    // Ahora contar sesiones restantes
    const sessionKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('accessToken_admin_')
    );
    
    // Solo mostrar warning si hay más de 1 sesión en ESTE navegador
    // (que indicaría un problema real, no solo 2 dispositivos)
    setShowMultiSessionWarning(sessionKeys.length > 1);
    return sessionKeys.length;
  };

  // Helper para limpiar tokens
  const clearTokens = () => {
    const sessionId = sessionStorage.getItem('sessionId');
    
    // Limpiar sessionStorage
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('sessionId');
    
    // Limpiar localStorage con prefijo específico
    if (sessionId) {
      localStorage.removeItem(`accessToken_${sessionId}`);
      localStorage.removeItem(`refreshToken_${sessionId}`);
      localStorage.removeItem(`user_${sessionId}`);
    }
    
    // Limpiar localStorage sin prefijo (para compatibilidad)
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    
    // Verificar sesiones múltiples después de limpiar
    checkMultipleSessions();
  };

  // Login
  const login = useCallback(async (username, password, options = {}) => {
    const res = await api.post('/auth/login', { username, password });
    saveTokens(res.data.token, res.data.refreshToken, res.data.user);
    setIsAuthenticated(true);
    setUser(res.data.user);

    // Verificar sesiones múltiples después del login
    checkMultipleSessions();
    // Buscar el slug usando el businessId
    let slug = null;
    try {
      const business = await api.get(`/business-config?businessId=${res.data.user.businessId}`);
      slug = business.data.slug;
      // Guardar el slug en localStorage para usarlo en LoginGuard
      localStorage.setItem('businessSlug', slug);
    } catch (e) {
      // fallback: usar businessId si no se encuentra el slug
      slug = res.data.user.businessId;
    }
    // Destino: app del mesero o panel (staff va directo a órdenes)
    let path;
    if (options.target === 'waiter') {
      path = `/${slug}/waiter`;
    } else {
      path = res.data.user.role === 'staff' ? `/${slug}/admin?tab=orders` : `/${slug}/admin`;
    }
    navigate(path, { replace: true });
    return res.data.user;
  }, [navigate]);

  // Login con Google (ya tiene tokens del backend)
  const loginWithGoogle = useCallback((data) => {
    saveTokens(data.token, data.refreshToken, data.user);
    setIsAuthenticated(true);
    setUser(data.user);
    checkMultipleSessions();
    
    const slug = data.business?.slug || data.user.businessId;
    localStorage.setItem('businessSlug', slug);
    const adminPath = data.user.role === 'staff' ? `/${slug}/admin?tab=orders` : `/${slug}/admin`;
    navigate(adminPath, { replace: true });
  }, [navigate]);

  // Logout
  const logout = useCallback(async () => {
    let slug = null;
    try {
      const userStr = sessionStorage.getItem('user') || localStorage.getItem('user');
      if (userStr) {
        const userObj = JSON.parse(userStr);
        // Buscar el slug usando el businessId
        try {
          const business = await api.get(`/business-config?businessId=${userObj.businessId}`);
          slug = business.data.slug;
        } catch (e) {
          // fallback: usar businessId si no se encuentra el slug
          slug = userObj.businessId;
        }
      }
      const refreshToken = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken');
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } catch {}
    clearTokens();
    setIsAuthenticated(false);
    setUser(null);
    if (slug) {
      navigate(`/${slug}/login`, { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  // Refrescar access token
  const refreshToken = useCallback(async () => {
    const enSession = !!sessionStorage.getItem('refreshToken');
    const refreshToken = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken');
    if (!refreshToken) throw new Error('No refresh token');

    // Cliente sin interceptores: si el refresh devuelve 401 (porque otra
    // sesion lo invalido), el error sube limpio en vez de encolarse a esperar
    // el refresh que el mismo es.
    const res = await refreshClient.post('/auth/refresh', { refreshToken });

    /* Se guarda donde vive esta sesion. Escribir siempre en localStorage pisaba
       el token de las demas pestañas, que es la mitad del problema cuando hay
       dos sesiones abiertas. */
    sessionStorage.setItem('accessToken', res.data.token);
    if (!enSession) localStorage.setItem('accessToken', res.data.token);

    setIsAuthenticated(true);
    return res.data.token;
  }, []);

  // Validar token al montar (solo una vez, no en cada cambio de ruta)
  useEffect(() => {
    const checkAuth = async () => {
      // Detectar rutas especiales donde no necesitamos verificar token
      const currentPath = window.location.pathname;
      const isSuperAdminRoute = currentPath.startsWith('/superadmin');
      const isResetPasswordRoute = currentPath.startsWith('/reset-password');
      
      // Si estamos en rutas especiales, no necesitamos verificar token de usuario normal
      if (isSuperAdminRoute || isResetPasswordRoute) {
        setLoading(false);
        return;
      }

      // Check for SuperAdmin handoff via localStorage (secure same-origin transfer)
      const saHandoff = localStorage.getItem('sa_handoff');
      
      if (saHandoff) {
        try {
          const tokenData = JSON.parse(saHandoff);
          localStorage.removeItem('sa_handoff'); // Consume immediately

          // Verify TTL — reject handoffs older than allowed window
          if (tokenData._ts && tokenData._ttl && (Date.now() - tokenData._ts > tokenData._ttl)) {
            console.warn('[Auth] SA handoff expired');
            navigate(window.location.pathname, { replace: true });
            setLoading(false);
            return;
          }
          
          // Validate the token server-side before trusting it
          if (tokenData.accessToken) {
            try {
              // Clear stale tokens from any previous session so interceptor doesn't interfere
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              sessionStorage.removeItem('accessToken');
              sessionStorage.removeItem('refreshToken');

              // Pass businessId from handoff so SuperAdmin gets correct context
              const bId = tokenData.user?.businessId || '';
              const verifyRes = await api.get(`/auth/me${bId ? `?businessId=${bId}` : ''}`, {
                headers: { Authorization: `Bearer ${tokenData.accessToken}` }
              });
              
              if (verifyRes.data && verifyRes.data.user) {
                // Token is valid — store it
                localStorage.setItem('accessToken', tokenData.accessToken);
                if (tokenData.refreshToken) {
                  localStorage.setItem('refreshToken', tokenData.refreshToken);
                }
                localStorage.setItem('user', JSON.stringify(verifyRes.data.user));
                
                setIsAuthenticated(true);
                setUser(verifyRes.data.user);
                setLoading(false);
                
                // Remove source param from URL if present
                navigate(window.location.pathname, { replace: true });
                return;
              }
            } catch (verifyError) {
              // Token is invalid — discard silently
              console.warn('[Auth] SA handoff token validation failed');
            }
          }
          
          // Remove source param from URL
          navigate(window.location.pathname, { replace: true });
        } catch (error) {
          // Error silencioso — malformed handoff data
          localStorage.removeItem('sa_handoff');
          navigate(window.location.pathname, { replace: true });
        }
      }
      
      const token = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
      const userStr = sessionStorage.getItem('user') || localStorage.getItem('user');
      
      // Verificar si es un token real de superadmin
      const hasSuperAdminToken = !!localStorage.getItem('superadmin_token');
      
      // Si hay token, consideramos que hay sesión aunque haya errores
      if (token && userStr) {
        setIsAuthenticated(true);
        try {
          const userObj = JSON.parse(userStr);
          setUser(userObj);
          
          // Si es SuperAdmin (por role o por tener superadmin_token), no intentamos verificar con /auth/me
          if (hasSuperAdminToken || userObj.role === 'superadmin') {
            setLoading(false);
            return;
          }
        } catch (e) {
          // Si no puedo parsear el user, no importa, mantenemos la sesión
        }
        
        // Intentar verificar el token, pero no cerramos sesión si falla
        try {
          const res = await api.get('/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          // Si llega respuesta válida, actualizamos el usuario
          if (res.data && res.data.user) {
            setUser(res.data.user);
          }
        } catch (err) {
          // Intentar refrescar, pero no cerramos sesión si falla
          try {
            const refreshTokenValue = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken');
            if (refreshTokenValue) {
              const newToken = await refreshToken();
              // Si se pudo refrescar, intentar obtener el usuario
              try {
                const res = await api.get('/auth/me', {
                  headers: { Authorization: `Bearer ${newToken}` }
                });
                if (res.data && res.data.user) {
                  setUser(res.data.user);
                }
              } catch (userErr) {
                // Si falla, no importa, mantenemos la sesión
                // Error silencioso
              }
            }
          } catch (refreshErr) {
            // Si falla el refresh, no importa, mantenemos la sesión
            // Error silencioso
          }
        }
      } else {
        // Si no hay token, no hay sesión
        setIsAuthenticated(false);
        setUser(null);
      }
      // Siempre terminamos el loading
      setLoading(false);
    };
    checkAuth();
    
    // Verificar sesiones múltiples al cargar
    checkMultipleSessions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detectar cuando otra pestaña limpia los tokens de localStorage
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'accessToken' && !e.newValue && isAuthenticated) {
        // Otra pestaña limpió el token — verificar si aún tenemos sesión propia
        const ownToken = sessionStorage.getItem('accessToken');
        if (!ownToken) {
          setIsAuthenticated(false);
          setUser(null);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [isAuthenticated]);

  // Redirigir a login cuando el refresh token también expira
  useEffect(() => {
    const handleSessionExpired = () => {
      clearTokens();
      setIsAuthenticated(false);
      setUser(null);
      const slug = localStorage.getItem('businessSlug');
      navigate(slug ? `/${slug}/login` : '/login', { replace: true });
    };
    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  }, [navigate]);

  // Función para limpiar sesiones antiguas
  const cleanupOldSessions = () => {
    const currentSessionId = sessionStorage.getItem('sessionId');
    const allKeys = Object.keys(localStorage);
    
    allKeys.forEach(key => {
      if (key.startsWith('accessToken_admin_') || 
          key.startsWith('refreshToken_admin_') || 
          key.startsWith('user_admin_')) {
        // Keys look like: accessToken_admin_1234567890_abc123
        // SessionId is: admin_1234567890_abc123 (everything after first _)
        const sessionId = key.substring(key.indexOf('_') + 1);
        if (sessionId !== currentSessionId) {
          localStorage.removeItem(key);
        }
      }
    });
    
    setShowMultiSessionWarning(false);
  };

  const value = {
    isAuthenticated,
    user,
    login,
    loginWithGoogle,
    logout,
    refreshToken,
    loading,
    showMultiSessionWarning,
    cleanupOldSessions,
    checkMultipleSessions
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe ser usado dentro de un AuthProvider");
  }
  return context;
}