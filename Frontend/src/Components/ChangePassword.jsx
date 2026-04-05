import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../services/api";

export default function ChangePassword({ forceNoOldPassword = false }) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }

    if (newPassword.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("accessToken");
      await api.post(
        forceNoOldPassword ? "/auth/force-change-password" : "/auth/change-password",
        forceNoOldPassword
          ? { newPassword }
          : { oldPassword, newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage("¡Contraseña actualizada correctamente!");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Error al cambiar la contraseña. Intenta de nuevo."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Modern Header */}
      {!forceNoOldPassword && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-r from-red-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-3 lg:mb-4 shadow-2xl">
            <span className="text-xl lg:text-2xl">🔐</span>
          </div>
          <h2 className="text-xl lg:text-3xl font-bold text-slate-900 mb-2">Cambiar Contraseña</h2>
          <p className="text-slate-600">Actualiza tu contraseña de acceso</p>
        </motion.div>
      )}

      {/* Messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="p-4 rounded-2xl border-2 bg-red-50 border-red-200 text-red-800 flex items-center space-x-3"
          >
            <span className="text-xl">❌</span>
            <span className="font-medium">{error}</span>
          </motion.div>
        )}

        {message && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="p-4 rounded-2xl border-2 bg-green-50 border-green-200 text-green-800 flex items-center space-x-3"
          >
            <span className="text-xl">✅</span>
            <span className="font-medium">{message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.form 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onSubmit={handleSubmit} 
        className="space-y-8"
      >
        {/* Password Change Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white lg:bg-gradient-to-br lg:from-white lg:to-slate-50 rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-xl p-5 lg:p-8 border border-slate-100 lg:border-slate-200/50"
        >
          <div className="text-center mb-8">
            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-2 lg:mb-3 shadow-lg">
              <span className="text-lg lg:text-xl">🔑</span>
            </div>
            <h3 className="text-base lg:text-2xl font-bold text-slate-900 mb-1 lg:mb-2">Cambiar contraseña</h3>
            <p className="hidden lg:block text-slate-600">Introduce tu contraseña actual y la nueva contraseña</p>
          </div>

          <div className="space-y-6">
            {/* Current Password */}
            {!forceNoOldPassword && (
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2 mb-3">
                  <span className="text-xl">🔒</span>
                  <label htmlFor="oldPassword" className="text-lg font-semibold text-slate-900">
                    Contraseña actual
                  </label>
                </div>
                
                <div className="relative">
                  <input
                    id="oldPassword"
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full px-4 py-3 pl-12 border-2 border-slate-200 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all duration-200 bg-white text-slate-700"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">🔐</span>
                </div>
              </motion.div>
            )}

            {/* New Password */}
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2 mb-3">
                <span className="text-xl">🔑</span>
                <label htmlFor="newPassword" className="text-lg font-semibold text-slate-900">
                  Nueva contraseña
                </label>
              </div>
              
              <div className="relative">
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pl-12 border-2 border-slate-200 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all duration-200 bg-white text-slate-700"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">✨</span>
              </div>
            </motion.div>

            {/* Confirm Password */}
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2 mb-3">
                <span className="text-xl">🔄</span>
                <label htmlFor="confirmPassword" className="text-lg font-semibold text-slate-900">
                  Confirmar nueva contraseña
                </label>
              </div>
              
              <div className="relative">
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pl-12 border-2 border-slate-200 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all duration-200 bg-white text-slate-700"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">✅</span>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Action Button */}
        <div className="flex justify-center pt-4">
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            className={`px-8 lg:px-12 py-3.5 lg:py-4 bg-gradient-to-r from-red-500 to-orange-600 text-white rounded-2xl font-semibold shadow-xl transition-all duration-200 flex items-center space-x-3 active:scale-[0.97] lg:active:scale-100 ${
              loading ? 'opacity-50 cursor-not-allowed' : 'hover:from-red-600 hover:to-orange-700'
            }`}
          >
            <span className="text-xl">
              {loading ? '⏳' : '🔐'}
            </span>
            <span>
              {loading ? 'Actualizando...' : 'Cambiar contraseña'}
            </span>
          </motion.button>
        </div>
      </motion.form>
    </div>
  );
}