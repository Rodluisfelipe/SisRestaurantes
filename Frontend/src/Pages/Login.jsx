import { useState, useEffect } from "react";
import { useAuth } from "../Context/AuthContext";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { googleAuth } from "../services/authService";
import { useBusinessConfig } from "../Context/BusinessContext";

export default function Login() {
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const { businessConfig } = useBusinessConfig();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  // Logo por defecto
  const defaultLogo = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNlNWU3ZWIiLz48dGV4dCB4PSI1MCIgeT0iNTAiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiM5Y2EzYWYiPkxvZ288L3RleHQ+PC9zdmc+';

  useEffect(() => {
    // Verificar si businessConfig existe antes de acceder a sus propiedades
    if (businessConfig?.businessName) {
      document.title = businessConfig.businessName;
    }
    if (businessConfig?.logo) {
      let favicon = document.querySelector("link[rel='icon']") || document.createElement('link');
      favicon.rel = 'icon';
      favicon.type = 'image/png';
      favicon.href = businessConfig.logo;
      document.head.appendChild(favicon);
    }
  }, [businessConfig]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await login(credentials.username, credentials.password);
    } catch (error) {
      setError("Credenciales incorrectas");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    });
    if (error) setError("");
  };

  const toRgba = (hex, alpha) => {
    if (!hex) return `rgba(37, 99, 235, ${alpha})`;
    let value = hex.trim();
    if (value.startsWith('#')) value = value.slice(1);
    if (value.length === 3) {
      value = value.split('').map((c) => c + c).join('');
    }
    if (value.length !== 6 || /[^0-9a-f]/i.test(value)) {
      return `rgba(37, 99, 235, ${alpha})`;
    }
    const intVal = parseInt(value, 16);
    const r = (intVal >> 16) & 255;
    const g = (intVal >> 8) & 255;
    const b = intVal & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Usar valores por defecto si no hay businessConfig
  // Proteger acceso a businessConfig para evitar errores cuando es undefined
  const logo = businessConfig?.logo || defaultLogo;
  const businessName = businessConfig?.businessName || "Mi Negocio";
  const theme = businessConfig?.theme || { buttonColor: '#2563eb', buttonTextColor: '#ffffff' };
  const brandBase = theme.primaryColor || theme.buttonColor || '#2563eb';
  const brandTextColor = theme.buttonTextColor || '#ffffff';
  const brandSoft = toRgba(brandBase, 0.08);
  const brandSoftStrong = toRgba(brandBase, 0.14);
  const brandBorder = toRgba(brandBase, 0.22);
  const coverImage = businessConfig?.coverImage || "";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="relative min-h-screen">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(1000px circle at 10% -10%, ${brandSoft}, transparent 55%), radial-gradient(900px circle at 90% 10%, ${brandSoftStrong}, transparent 55%)`
          }}
        ></div>
        <div className="relative mx-auto flex min-h-screen max-w-5xl items-center px-4 sm:px-6 lg:px-8">
          <div
            className="grid w-full overflow-hidden rounded-2xl border bg-white shadow-[0_30px_80px_-60px_rgba(15,23,42,0.45)] lg:grid-cols-2"
            style={{ borderColor: brandBorder }}
          >
            <div
              className="relative border-b bg-white p-10 lg:border-b-0 lg:border-r lg:p-12 overflow-hidden"
              style={
                coverImage
                  ? {
                      borderColor: brandBorder,
                      backgroundImage: `url(${coverImage})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }
                  : { borderColor: brandBorder }
              }
            >
              <div className={`absolute inset-0 ${coverImage ? 'bg-slate-900/45' : 'bg-white'}`}></div>
              <div className={`relative z-10 flex h-full flex-col items-center justify-center gap-4 text-center ${coverImage ? 'text-white' : 'text-slate-900'}`}>
                <div className={`h-24 w-24 rounded-3xl border p-3 shadow-sm sm:h-28 sm:w-28 ${coverImage ? 'border-white/40 bg-white/90' : 'border-slate-200 bg-white'}`}>
                  <img
                    src={logo}
                    alt={`Logo de ${businessName}`}
                    className="h-full w-full object-contain"
                    onError={(e) => {
                      if (e.target.src !== defaultLogo) {
                        e.target.src = defaultLogo;
                      }
                    }}
                  />
                </div>
                <h1 className={`text-2xl font-geist font-semibold tracking-tight ${coverImage ? 'text-white' : 'text-slate-900'}`}>
                  {businessName}
                </h1>
                <div className="h-0.5 w-12 rounded-full" style={{ backgroundColor: brandBase }}></div>
              </div>
            </div>

            <div className="p-8 lg:p-12" style={{ '--brand': brandBase }}>
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Acceso</p>
                <h2 className="mt-3 text-2xl font-geist font-semibold text-slate-900">
                  Iniciar Sesión
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Ingresa con Google o tu usuario del negocio.
                </p>
                <div className="mt-4 h-0.5 w-10 rounded-full" style={{ backgroundColor: brandBase }}></div>
              </div>

              <div className="mt-6 rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={async (credentialResponse) => {
                      setError("");
                      setIsGoogleLoading(true);
                      try {
                        const credential = credentialResponse?.credential;
                        if (!credential) {
                          setError("No se pudo obtener el token de Google.");
                          return;
                        }

                        const result = await googleAuth(credential);
                        if (result.needsBusinessName) {
                          navigate("/register", { state: { googlePending: true } });
                          return;
                        }
                        if (result.token) {
                          loginWithGoogle(result);
                        } else {
                          setError("No se pudo iniciar sesión con Google.");
                        }
                      } catch (err) {
                        setError(err.response?.data?.message || "Error al iniciar sesión con Google");
                      } finally {
                        setIsGoogleLoading(false);
                      }
                    }}
                    onError={() => setError("Error al conectar con Google")}
                    text="signin_with"
                    shape="rectangular"
                    size="large"
                    width="100%"
                    theme="outline"
                    locale="es"
                  />
                </div>
                {isGoogleLoading && (
                  <div className="flex justify-center mt-3">
                    <svg className="animate-spin h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
              </div>

              <div className="relative mt-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-slate-500">o inicia con usuario</span>
                </div>
              </div>

              <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-2">
                      Usuario
                    </label>
                    <input
                      id="username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      required
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition focus:border-[color:var(--brand)] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand)] focus:ring-opacity-20"
                      placeholder="Nombre de usuario"
                      value={credentials.username}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                      Contraseña
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition focus:border-[color:var(--brand)] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand)] focus:ring-opacity-20"
                      placeholder="Contraseña"
                      value={credentials.password}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || isGoogleLoading}
                  style={{ backgroundColor: brandBase, color: brandTextColor }}
                  className={`w-full rounded-lg px-4 py-3 text-sm font-semibold shadow-sm transition ${
                    isLoading || isGoogleLoading ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-95'
                  }`}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Iniciando sesión...
                    </span>
                  ) : (
                    "Iniciar Sesión"
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
