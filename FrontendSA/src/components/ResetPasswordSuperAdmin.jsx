import React, { useState } from "react";
import { resetSuperAdminPassword } from "../services/api";

export default function ResetPasswordSuperAdmin({ token, onSuccess, onBack }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tokenInvalid, setTokenInvalid] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (newPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      await resetSuperAdminPassword(token, newPassword);
      setMessage("Contraseña restablecida correctamente. Ya puedes iniciar sesión.");
      setSuccess(true);
      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 2000);
    } catch (err) {
      const msg = err.response?.data?.message || "Error al restablecer la contraseña";
      setError(msg);
      if (msg.toLowerCase().includes("token")) setTokenInvalid(true);
    } finally {
      setLoading(false);
    }
  };

  if (tokenInvalid) {
    return (
      <div className="max-w-sm mx-auto mt-20 p-6 bg-white rounded shadow space-y-4 animate-fadeIn text-center">
        <h2 className="text-xl font-bold text-indigo-700">Enlace inválido o expirado</h2>
        <p className="text-gray-700">El enlace de recuperación ya fue usado o ha expirado. Solicita uno nuevo si necesitas restablecer tu contraseña.</p>
        <button type="button" className="mt-4 text-blue-600 text-sm hover:underline" onClick={onBack}>
          Volver al login
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm mx-auto mt-20 p-6 bg-white rounded shadow space-y-4 animate-fadeIn">
      <h2 className="text-xl font-bold text-indigo-700 text-center">Restablecer contraseña</h2>
      <input
        className="w-full border rounded px-3 py-2"
        type="password"
        placeholder="Nueva contraseña"
        value={newPassword}
        onChange={e => setNewPassword(e.target.value)}
        required
        disabled={success}
      />
      <input
        className="w-full border rounded px-3 py-2"
        type="password"
        placeholder="Confirmar contraseña"
        value={confirmPassword}
        onChange={e => setConfirmPassword(e.target.value)}
        required
        disabled={success}
      />
      {error && <div className="text-red-600 text-center">{error}</div>}
      {message && <div className="text-green-700 text-center">{message}</div>}
      <button className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700" disabled={loading || success}>
        {loading ? "Restableciendo..." : "Restablecer contraseña"}
      </button>
      <div className="text-right">
        <button type="button" className="text-blue-600 text-sm hover:underline" onClick={onBack} disabled={!success}>
          Volver al login
        </button>
      </div>
    </form>
  );
} 