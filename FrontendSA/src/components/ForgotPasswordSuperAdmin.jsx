import React, { useState } from "react";
import { forgotSuperAdminPassword } from "../services/api";

export default function ForgotPasswordSuperAdmin({ onBack }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await forgotSuperAdminPassword(email);
      setMessage("Si el email existe, se ha enviado un enlace de recuperación.");
    } catch (err) {
      setError(err.response?.data?.message || "Error al enviar email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-sm mx-auto mt-20 p-6 bg-white rounded shadow space-y-4 animate-fadeIn">
      <h2 className="text-xl font-bold text-indigo-700 text-center">Recuperar contraseña</h2>
      <input
        className="w-full border rounded px-3 py-2"
        placeholder="Email"
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
      />
      {error && <div className="text-red-600 text-center">{error}</div>}
      {message && <div className="text-green-700 text-center">{message}</div>}
      <button className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700" disabled={loading}>
        {loading ? "Enviando..." : "Enviar enlace"}
      </button>
      <div className="text-right">
        <button type="button" className="text-blue-600 text-sm hover:underline" onClick={onBack}>
          Volver al login
        </button>
      </div>
    </form>
  );
} 