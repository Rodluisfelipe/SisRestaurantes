import { useState } from "react";
import api from "../services/api";
import { motion } from "framer-motion";

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

    setLoading(true);
    try {
      const token = localStorage.getItem("accessToken");
      await api.post(
        "/auth/change-password",
        forceNoOldPassword
          ? { oldPassword: newPassword, newPassword }
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-md mx-auto space-y-4 p-6 bg-[#333F50]/80 rounded-2xl shadow-xl border border-[#333F50]"
    >
      {!forceNoOldPassword && (
        <motion.h2 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xl font-bold text-white mb-4"
        >
          Cambiar contraseña
        </motion.h2>
      )}

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 bg-red-500/20 text-red-300 text-sm rounded-lg border border-red-500/30"
        >
          {error}
        </motion.div>
      )}

      {message && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 bg-green-500/20 text-green-300 text-sm rounded-lg border border-green-500/30"
        >
          {message}
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {!forceNoOldPassword && (
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <label htmlFor="oldPassword" className="block text-sm font-medium text-[#D1D9FF] mb-1">
              Contraseña actual
            </label>
            <div className="mt-1 relative">
          <input
                id="oldPassword"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            required
                className="appearance-none block w-full px-3 py-2.5 border border-[#333F50] bg-[#333F50]/50 rounded-lg shadow-sm placeholder-[#A5B9FF]/70 focus:outline-none focus:ring-[#3A7AFF] focus:border-[#3A7AFF] text-white text-sm pl-10"
                placeholder="••••••••"
              />
              <svg 
                className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#A5B9FF]" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
        </div>
          </motion.div>
        )}
        
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <label htmlFor="newPassword" className="block text-sm font-medium text-[#D1D9FF] mb-1">
            Nueva contraseña
          </label>
          <div className="mt-1 relative">
        <input
              id="newPassword"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
              className="appearance-none block w-full px-3 py-2.5 border border-[#333F50] bg-[#333F50]/50 rounded-lg shadow-sm placeholder-[#A5B9FF]/70 focus:outline-none focus:ring-[#3A7AFF] focus:border-[#3A7AFF] text-white text-sm pl-10"
              placeholder="••••••••"
            />
            <svg 
              className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#A5B9FF]" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
      </div>
        </motion.div>
        
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#D1D9FF] mb-1">
            Confirmar nueva contraseña
          </label>
          <div className="mt-1 relative">
        <input
              id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
              className="appearance-none block w-full px-3 py-2.5 border border-[#333F50] bg-[#333F50]/50 rounded-lg shadow-sm placeholder-[#A5B9FF]/70 focus:outline-none focus:ring-[#3A7AFF] focus:border-[#3A7AFF] text-white text-sm pl-10"
              placeholder="••••••••"
            />
            <svg 
              className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#A5B9FF]" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
      </div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="pt-2"
        >
      <button
        type="submit"
        disabled={loading}
            className={`w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white 
              ${loading 
                ? 'bg-[#3A7AFF]/50 cursor-not-allowed' 
                : 'bg-[#3A7AFF] hover:bg-[#3A7AFF]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3A7AFF]/50 hover:shadow-lg hover:shadow-[#3A7AFF]/20'
              } transition-all duration-300`}
          >
            {loading ? (
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Actualizando...
              </div>
            ) : 'Cambiar contraseña'}
      </button>
        </motion.div>
    </form>
    </motion.div>
  );
}