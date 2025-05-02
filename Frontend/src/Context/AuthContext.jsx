import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Verificar si hay una sesión guardada al iniciar
    return localStorage.getItem('isAuthenticated') === 'true';
  });
  const navigate = useNavigate();

  // Efecto para mantener la sesión sincronizada con localStorage
  useEffect(() => {
    localStorage.setItem('isAuthenticated', isAuthenticated);
  }, [isAuthenticated]);

  const login = useCallback((username, password) => {
    if (username === "admin" && password === "admin") {
      setIsAuthenticated(true);
      localStorage.setItem('isAuthenticated', 'true');
      navigate("/admin");
    } else {
      alert("Credenciales incorrectas");
    }
  }, [navigate]);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    localStorage.removeItem('isAuthenticated');
    navigate("/");
  }, [navigate]);

  const value = {
    isAuthenticated,
    login,
    logout
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
