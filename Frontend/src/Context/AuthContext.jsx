import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../services/api";
import { getBusinessBySlug } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Helper para guardar tokens
  const saveTokens = (token, refreshToken, userObj) => {
    // Generar un ID único para esta sesión
    const sessionId = `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Usar sessionStorage para evitar conflictos entre múltiples sesiones
    sessionStorage.setItem('accessToken', token);
    sessionStorage.setItem('refreshToken', refreshToken);
    sessionStorage.setItem('user', JSON.stringify(userObj));
    sessionStorage.setItem('sessionId', sessionId);
    
    // También guardar en localStorage para persistencia, pero con prefijo único
    localStorage.setItem(`accessToken_${sessionId}`, token);
    localStorage.setItem(`refreshToken_${sessionId}`, refreshToken);
    localStorage.setItem(`user_${sessionId}`, JSON.stringify(userObj));
  };

  // Helper para limpiar tokens
  const clearTokens = () => {
    const sessionId = sessionStorage.getItem('sessionId');
    
    // Limpiar sessionStorage
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('sessionId');
    
    // Limpiar localStorage con prefijo
    if (sessionId) {
      localStorage.removeItem(`accessToken_${sessionId}`);
      localStorage.removeItem(`refreshToken_${sessionId}`);
      localStorage.removeItem(`user_${sessionId}`);
    }
  };

  // Login
  const login = useCallback(async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    saveTokens(res.data.token, res.data.refreshToken, res.data.user);
    setIsAuthenticated(true);
    setUser(res.data.user);
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
    navigate(`/${slug}/admin`, { replace: true });
  }, [navigate]);

  // Logout
  const logout = useCallback(async () => {
    let slug = null;
    try {
      const userStr = sessionStorage.getItem('user');
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
      const refreshToken = sessionStorage.getItem('refreshToken');
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
    const refreshToken = sessionStorage.getItem('refreshToken');
    if (!refreshToken) throw new Error('No refresh token');
    const res = await api.post('/auth/refresh', { refreshToken });
    sessionStorage.setItem('accessToken', res.data.token);
    setIsAuthenticated(true);
    return res.data.token;
  }, []);

  // Validar token al montar
  useEffect(() => {
    const checkAuth = async () => {
      // Detectar rutas especiales donde no necesitamos verificar token
      const isSuperAdminRoute = location.pathname.startsWith('/superadmin');
      const isResetPasswordRoute = location.pathname.startsWith('/reset-password');
      
      // Si estamos en rutas especiales, no necesitamos verificar token de usuario normal
      if (isSuperAdminRoute || isResetPasswordRoute) {
        setLoading(false);
        return;
      }

      // Check for URL parameters first
      const searchParams = new URLSearchParams(location.search);
      const saTokenParam = searchParams.get('satoken');
      
      if (saTokenParam) {
        try {
          const tokenData = JSON.parse(decodeURIComponent(saTokenParam));
          
          // Store the token
          localStorage.setItem('accessToken', tokenData.accessToken);
          localStorage.setItem('refreshToken', tokenData.refreshToken);
          localStorage.setItem('user', JSON.stringify(tokenData.user));
          
          setIsAuthenticated(true);
          setUser(tokenData.user);
          setLoading(false);
          
          // Remove token from URL
          navigate(location.pathname, { replace: true });
          return;
        } catch (error) {
          // Error silencioso
        }
      }
      
      const token = sessionStorage.getItem('accessToken');
      const userStr = sessionStorage.getItem('user');
      
      // Verificar si es un token temporal de superadmin
      const isTempSuperAdminToken = token?.startsWith('temp_sa_token_');
      
      // Si hay token, consideramos que hay sesión aunque haya errores
      if (token && userStr) {
        setIsAuthenticated(true);
        try {
          const userObj = JSON.parse(userStr);
          setUser(userObj);
        } catch (e) {
          // Si no puedo parsear el user, no importa, mantenemos la sesión
        }
        
        // Si es un token temporal de superadmin, no intentamos verificarlo
        if (isTempSuperAdminToken) {
          setLoading(false);
          return;
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
            const refreshTokenValue = sessionStorage.getItem('refreshToken');
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
  }, [refreshToken, navigate, location]);

  const value = {
    isAuthenticated,
    user,
    login,
    logout,
    refreshToken,
    loading
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