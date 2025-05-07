import { useState } from "react";
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

    setLoading(true);
    try {
      const token = localStorage.getItem("accessToken");
      await api.post(
        "/auth/change-password",
        forceNoOldPassword
          ? { oldPassword: newPassword, newPassword } // El backend requiere oldPassword, pero como está forzado, enviamos la nueva
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <span className="inline-block w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></span>
        <span className="text-gray-600 text-lg font-semibold animate-pulse">Cambiando contraseña...</span>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg z-50 animate-fade-in">
          {error}
        </div>
      )}
      {message && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded shadow-lg z-50 animate-fade-in">
          {message}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-6 bg-gray-50 rounded-lg p-4 shadow-sm">
        <h2 className="text-lg font-bold mb-2">Cambiar contraseña</h2>
        {!forceNoOldPassword && (
          <div>
            <label className="block text-sm font-medium mb-1">Contraseña actual</label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Nueva contraseña</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Confirmar nueva contraseña</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors duration-300 font-semibold shadow-md"
          disabled={loading}
        >
          Cambiar Contraseña
        </button>
      </form>
    </>
  );
}