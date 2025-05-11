import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { registerUser, checkEmailAvailability } from '../../services/authService';
import { useAuth } from '../../Context/AuthContext';
import { useTheme } from '../../Context/ThemeContext';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    businessName: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(0);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setFormData({
      ...formData,
      [name]: newValue
    });
    
    // Validar campo específico en tiempo real
    validateField(name, newValue);
    
    // Calcular fuerza de la contraseña
    if (name === 'password') {
      calculatePasswordStrength(value);
    }

    // Verificar disponibilidad de email
    if (name === 'email' && value && value.includes('@')) {
      checkEmail(value);
    }
  };
  
  // Verificar si el email ya está registrado
  const checkEmail = async (email) => {
    if (isCheckingEmail) return;
    
    // Debounce para evitar múltiples llamadas
    setIsCheckingEmail(true);
    setTimeout(async () => {
      try {
        const isAvailable = await checkEmailAvailability(email);
        
        if (!isAvailable) {
          setErrors({
            ...errors,
            email: 'Este correo ya está registrado'
          });
        }
      } catch (error) {
        console.error('Error al verificar email:', error);
      } finally {
        setIsCheckingEmail(false);
      }
    }, 500);
  };
  
  const calculatePasswordStrength = (password) => {
    if (!password) {
      setPasswordStrength(0);
      return;
    }
    
    let strength = 0;
    
    // Longitud
    if (password.length >= 8) strength += 1;
    if (password.length >= 12) strength += 1;
    
    // Complejidad
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[a-z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    
    // Normalizar a escala 0-100
    const normalizedStrength = Math.min(Math.floor((strength / 6) * 100), 100);
    setPasswordStrength(normalizedStrength);
  };
  
  const getPasswordStrengthColor = () => {
    if (passwordStrength < 30) return 'bg-red-500';
    if (passwordStrength < 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const validateField = (name, value) => {
    let newErrors = { ...errors };
    
    switch (name) {
      case 'name':
        if (!value.trim()) {
          newErrors.name = 'El nombre es obligatorio';
        } else {
          delete newErrors.name;
        }
        break;
        
      case 'businessName':
        if (!value.trim()) {
          newErrors.businessName = 'El nombre del negocio es obligatorio';
        } else {
          delete newErrors.businessName;
        }
        break;
        
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!value) {
          newErrors.email = 'El email es obligatorio';
        } else if (!emailRegex.test(value)) {
          newErrors.email = 'Ingresa un email válido';
        } else {
          delete newErrors.email;
        }
        break;
        
      case 'password':
        if (!value) {
          newErrors.password = 'La contraseña es obligatoria';
        } else if (value.length < 8) {
          newErrors.password = 'La contraseña debe tener al menos 8 caracteres';
        } else {
          delete newErrors.password;
        }
        
        // Validar confirmPassword si ya existe
        if (formData.confirmPassword && value !== formData.confirmPassword) {
          newErrors.confirmPassword = 'Las contraseñas no coinciden';
        } else if (formData.confirmPassword) {
          delete newErrors.confirmPassword;
        }
        break;
        
      case 'confirmPassword':
        if (!value) {
          newErrors.confirmPassword = 'Debes confirmar la contraseña';
        } else if (value !== formData.password) {
          newErrors.confirmPassword = 'Las contraseñas no coinciden';
        } else {
          delete newErrors.confirmPassword;
        }
        break;
        
      case 'acceptTerms':
        if (!value) {
          newErrors.acceptTerms = 'Debes aceptar los términos y condiciones';
        } else {
          delete newErrors.acceptTerms;
        }
        break;
        
      default:
        break;
    }
    
    setErrors(newErrors);
  };

  const validateForm = () => {
    let isValid = true;
    let newErrors = {};
    
    // Validar todos los campos
    Object.keys(formData).forEach(key => {
      const value = formData[key];
      let fieldError = null;
      
      switch (key) {
        case 'name':
          if (!value.trim()) fieldError = 'El nombre es obligatorio';
          break;
          
        case 'businessName':
          if (!value.trim()) fieldError = 'El nombre del negocio es obligatorio';
          break;
          
        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!value) {
            fieldError = 'El email es obligatorio';
          } else if (!emailRegex.test(value)) {
            fieldError = 'Ingresa un email válido';
          }
          break;
          
        case 'password':
          if (!value) {
            fieldError = 'La contraseña es obligatoria';
          } else if (value.length < 8) {
            fieldError = 'La contraseña debe tener al menos 8 caracteres';
          }
          break;
          
        case 'confirmPassword':
          if (!value) {
            fieldError = 'Debes confirmar la contraseña';
          } else if (value !== formData.password) {
            fieldError = 'Las contraseñas no coinciden';
          }
          break;
          
        case 'acceptTerms':
          if (!value) fieldError = 'Debes aceptar los términos y condiciones';
          break;
          
        default:
          break;
      }
      
      if (fieldError) {
        isValid = false;
        newErrors[key] = fieldError;
      }
    });
    
    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');
    
    // Validar formulario
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Preparar datos para el registro
      const userData = {
        name: formData.name,
        businessName: formData.businessName,
        email: formData.email,
        password: formData.password,
      };
      
      // Enviar solicitud de registro
      const response = await registerUser(userData);
      
      // Intentar iniciar sesión automáticamente
      try {
        await login(formData.email, formData.password);
        // AuthContext se encargará de la redirección
      } catch (loginError) {
        console.error('Error al iniciar sesión automáticamente:', loginError);
        // Si falla el login automático, redirigir al login con mensaje
        navigate('/login', { 
          state: { 
            message: 'Registro exitoso. Por favor, inicia sesión con tus credenciales.' 
          } 
        });
      }
    } catch (error) {
      console.error('Error al registrar usuario:', error);
      setGeneralError(
        error.response?.data?.message || 
        'Error al crear la cuenta. Por favor, inténtalo de nuevo.'
      );
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#051C2C]' : 'bg-[#F4F7FB]'} py-8 sm:py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`w-full max-w-2xl ${
          theme === 'dark' 
            ? 'bg-[#333F50]/80 border border-[#333F50]' 
            : 'bg-white border border-[#DCE4F5]'
        } rounded-2xl shadow-xl overflow-hidden`}
      >
        <div className="p-6 sm:p-10">
          <div className="text-center mb-8">
            <h2 className={`text-2xl sm:text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-[#1F2937]'}`}>
              Crea tu cuenta Menuby
            </h2>
            <p className={`mt-3 ${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'}`}>
              Únete a la revolución en gestión de restaurantes
            </p>
          </div>
          
          {generalError && (
            <div className={`mb-6 p-3 ${theme === 'dark' ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-red-50 text-red-500 border border-red-200'} rounded-lg`}>
              <p>{generalError}</p>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                <label className={`block text-sm font-medium ${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'} mb-1`} htmlFor="name">
                  Nombre completo*
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  className={`w-full px-3 py-2 border ${errors.name ? 'border-red-500/50' : theme === 'dark' ? 'border-[#333F50]' : 'border-[#DCE4F5]'} ${
                    theme === 'dark' 
                      ? 'bg-[#333F50]/50 text-white placeholder-[#A5B9FF]/70' 
                      : 'bg-white text-[#1F2937] placeholder-[#6C7A92]/70'
                  } rounded-lg shadow-sm focus:ring-[#3A7AFF] focus:border-[#3A7AFF] focus:outline-none`}
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Escribe tu nombre"
                />
                {errors.name && <p className={`mt-1 text-xs ${theme === 'dark' ? 'text-red-300' : 'text-red-500'}`}>{errors.name}</p>}
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
              >
                <label className={`block text-sm font-medium ${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'} mb-1`} htmlFor="businessName">
                  Nombre del restaurante*
                </label>
                <input
                  type="text"
                  id="businessName"
                  name="businessName"
                  className={`w-full px-3 py-2 border ${errors.businessName ? 'border-red-500/50' : theme === 'dark' ? 'border-[#333F50]' : 'border-[#DCE4F5]'} ${
                    theme === 'dark' 
                      ? 'bg-[#333F50]/50 text-white placeholder-[#A5B9FF]/70' 
                      : 'bg-white text-[#1F2937] placeholder-[#6C7A92]/70'
                  } rounded-lg shadow-sm focus:ring-[#3A7AFF] focus:border-[#3A7AFF] focus:outline-none`}
                  value={formData.businessName}
                  onChange={handleChange}
                  placeholder="Nombre de tu negocio"
                />
                {errors.businessName && <p className={`mt-1 text-xs ${theme === 'dark' ? 'text-red-300' : 'text-red-500'}`}>{errors.businessName}</p>}
              </motion.div>
            </div>
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
            >
              <label className={`block text-sm font-medium ${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'} mb-1`} htmlFor="email">
                Correo electrónico*
              </label>
              <div className="relative">
                <input
                  type="email"
                  id="email"
                  name="email"
                  className={`w-full px-3 py-2 border ${errors.email ? 'border-red-500/50' : theme === 'dark' ? 'border-[#333F50]' : 'border-[#DCE4F5]'} ${
                    theme === 'dark' 
                      ? 'bg-[#333F50]/50 text-white placeholder-[#A5B9FF]/70' 
                      : 'bg-white text-[#1F2937] placeholder-[#6C7A92]/70'
                  } rounded-lg shadow-sm focus:ring-[#3A7AFF] focus:border-[#3A7AFF] focus:outline-none`}
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="tucorreo@ejemplo.com"
                />
                {isCheckingEmail && (
                  <div className="absolute right-3 top-2">
                    <svg className={`animate-spin h-5 w-5 ${theme === 'dark' ? 'text-[#A5B9FF]' : 'text-[#6C7A92]'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
              </div>
              {errors.email && <p className={`mt-1 text-xs ${theme === 'dark' ? 'text-red-300' : 'text-red-500'}`}>{errors.email}</p>}
            </motion.div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.5 }}
              >
                <label className={`block text-sm font-medium ${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'} mb-1`} htmlFor="password">
                  Contraseña*
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  className={`w-full px-3 py-2 border ${errors.password ? 'border-red-500/50' : theme === 'dark' ? 'border-[#333F50]' : 'border-[#DCE4F5]'} ${
                    theme === 'dark' 
                      ? 'bg-[#333F50]/50 text-white placeholder-[#A5B9FF]/70' 
                      : 'bg-white text-[#1F2937] placeholder-[#6C7A92]/70'
                  } rounded-lg shadow-sm focus:ring-[#3A7AFF] focus:border-[#3A7AFF] focus:outline-none`}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Mínimo 8 caracteres"
                />
                {passwordStrength > 0 && (
                  <div className="mt-1">
                    <div className={`h-1 w-full ${theme === 'dark' ? 'bg-[#333F50]' : 'bg-gray-200'} rounded-full overflow-hidden`}>
                      <div 
                        className={`h-full ${getPasswordStrengthColor()}`} 
                        style={{ width: `${passwordStrength}%` }}
                      />
                    </div>
                    <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-[#A5B9FF]' : 'text-[#6C7A92]'}`}>
                      {passwordStrength < 30 && "Contraseña débil"}
                      {passwordStrength >= 30 && passwordStrength < 70 && "Contraseña media"}
                      {passwordStrength >= 70 && "Contraseña fuerte"}
                    </p>
                  </div>
                )}
                {errors.password && <p className={`mt-1 text-xs ${theme === 'dark' ? 'text-red-300' : 'text-red-500'}`}>{errors.password}</p>}
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.6 }}
              >
                <label className={`block text-sm font-medium ${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'} mb-1`} htmlFor="confirmPassword">
                  Confirmar contraseña*
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  className={`w-full px-3 py-2 border ${errors.confirmPassword ? 'border-red-500/50' : theme === 'dark' ? 'border-[#333F50]' : 'border-[#DCE4F5]'} ${
                    theme === 'dark' 
                      ? 'bg-[#333F50]/50 text-white placeholder-[#A5B9FF]/70' 
                      : 'bg-white text-[#1F2937] placeholder-[#6C7A92]/70'
                  } rounded-lg shadow-sm focus:ring-[#3A7AFF] focus:border-[#3A7AFF] focus:outline-none`}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirma tu contraseña"
                />
                {errors.confirmPassword && <p className={`mt-1 text-xs ${theme === 'dark' ? 'text-red-300' : 'text-red-500'}`}>{errors.confirmPassword}</p>}
              </motion.div>
            </div>
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.7 }}
              className="flex items-start mt-2"
            >
              <div className="flex items-center h-5">
                <input
                  id="acceptTerms"
                  name="acceptTerms"
                  type="checkbox"
                  checked={formData.acceptTerms}
                  onChange={handleChange}
                  className={`h-4 w-4 text-[#3A7AFF] focus:ring-[#3A7AFF] ${theme === 'dark' ? 'border-[#333F50]' : 'border-[#DCE4F5]'} rounded`}
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="acceptTerms" className={`font-medium ${errors.acceptTerms ? 'text-red-300' : theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'}`}>
                  Acepto los{' '}
                  <Link to="/terms" className={theme === 'dark' ? 'text-[#A5B9FF] hover:text-[#5FF9B4]' : 'text-[#3A7AFF] hover:text-[#3A7AFF]/80'}>
                    términos y condiciones
                  </Link>
                </label>
                {errors.acceptTerms && <p className={`mt-1 text-xs ${theme === 'dark' ? 'text-red-300' : 'text-red-500'}`}>{errors.acceptTerms}</p>}
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.8 }}
              className="pt-2"
            >
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white ${
                  isLoading
                    ? 'bg-[#3A7AFF]/50 cursor-not-allowed'
                    : 'bg-[#3A7AFF] hover:bg-[#3A7AFF]/90 hover:shadow-lg hover:shadow-[#3A7AFF]/20'
                } transition-all duration-300`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creando cuenta...
                  </>
                ) : (
                  'Crear cuenta'
                )}
              </button>
            </motion.div>
          </form>
          
          <div className="mt-6 text-center md:hidden">
            <p className={`${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'} text-sm`}>
              ¿Ya tienes una cuenta?{' '}
              <Link to="/login" className={theme === 'dark' ? 'font-medium text-[#5FF9B4] hover:text-[#5FF9B4]/80' : 'font-medium text-[#3A7AFF] hover:text-[#3A7AFF]/80'}>
                Inicia sesión
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Register; 