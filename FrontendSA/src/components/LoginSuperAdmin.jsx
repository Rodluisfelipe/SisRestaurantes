import React, { useState } from "react";
import { loginSuperAdmin } from "../services/api";

export default function LoginSuperAdmin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await loginSuperAdmin(email, password);
      localStorage.setItem("superadmin_token", res.data.token);
      onLogin();
    } catch (err) {
      setError(err.response?.data?.message || "Error de autenticación");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-sm mx-auto mt-32 p-8 bg-white rounded-2xl shadow-2xl space-y-6 border border-indigo-100 animate-fadeIn flex flex-col items-center">
      <img src="/logo.png" alt="Logo" className="w-16 h-16 rounded-full object-cover border-2 border-indigo-200 shadow mb-2" />
      <h2 className="text-2xl font-bold text-indigo-700 mb-2">Login Súper Admin</h2>
      <div className="w-full relative">
        <input
          className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-400 pl-10"
          placeholder="Email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 12H8m8 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
      </div>
      <div className="w-full relative">
        <input
          className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-400 pl-10"
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0-1.104.896-2 2-2s2 .896 2 2v2a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2c0-1.104.896-2 2-2s2 .896 2 2" /></svg>
      </div>
      {error && <div className="text-red-600 animate-pulse font-semibold w-full text-center">{error}</div>}
      <button className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 font-bold text-lg shadow transition-colors flex items-center justify-center gap-2" disabled={loading}>
        {loading ? (<span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>) : null}
        {loading ? "Entrando..." : "Entrar"}
      </button>
      <div className="w-full text-center mt-2">
        <a href="#" className="text-indigo-600 text-sm hover:underline font-semibold" onClick={e => {e.preventDefault(); onLogin('forgot')}}>
          ¿Olvidaste tu contraseña?
        </a>
      </div>
    </form>
  );
} 