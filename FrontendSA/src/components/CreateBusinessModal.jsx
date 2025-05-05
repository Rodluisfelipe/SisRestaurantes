import React, { useState } from "react";
import api from "../services/api";

export default function CreateBusinessModal({ isOpen, onClose, onCreated }) {
  const [form, setForm] = useState({
    businessName: "",
    logo: "",
    whatsappNumber: "",
    adminUsername: "",
    slug: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/business", form);
      onCreated();
      setForm({ businessName: "", logo: "", whatsappNumber: "", adminUsername: "", slug: "" });
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Error al crear negocio");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-auto relative animate-fadeIn border border-indigo-100">
        <button type="button" onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-red-500 text-2xl font-bold">&times;</button>
        <h2 className="text-2xl font-bold text-indigo-700 mb-6 text-center flex items-center gap-2 justify-center">
          <svg className="w-7 h-7 text-indigo-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Crear nuevo negocio
        </h2>
        <div className="space-y-4">
          <div className="relative">
            <input
              className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-400 ${form.businessName === '' && error ? 'border-red-400' : ''}`}
              name="businessName"
              placeholder="Nombre del negocio"
              value={form.businessName}
              onChange={handleChange}
              required
            />
            <svg className="w-5 h-5 absolute left-2 top-1/2 -translate-y-1/2 text-indigo-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 01-8 0" /></svg>
          </div>
          <div className="relative flex items-center gap-2">
            <input
              className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-400"
              name="logo"
              placeholder="URL del logo (opcional)"
              value={form.logo}
              onChange={handleChange}
            />
            {form.logo && <img src={form.logo} alt="Logo preview" className="w-10 h-10 rounded-full object-cover border ml-2" onError={e => e.target.style.display='none'} />}
          </div>
          <div className="relative">
            <input
              className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-400"
              name="whatsappNumber"
              placeholder="WhatsApp del negocio"
              value={form.whatsappNumber}
              onChange={handleChange}
            />
            <svg className="w-5 h-5 absolute left-2 top-1/2 -translate-y-1/2 text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10a9 9 0 0118 0c0 7-9 13-9 13S3 17 3 10z" /></svg>
          </div>
          <div className="relative">
            <input
              className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-400 ${form.adminUsername === '' && error ? 'border-red-400' : ''}`}
              name="adminUsername"
              placeholder="Usuario admin principal"
              value={form.adminUsername}
              onChange={handleChange}
              required
            />
            <svg className="w-5 h-5 absolute left-2 top-1/2 -translate-y-1/2 text-indigo-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 15c2.5 0 4.847.655 6.879 1.804M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </div>
          <div className="relative">
            <input
              className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-400 ${form.slug === '' && error ? 'border-red-400' : ''}`}
              name="slug"
              placeholder="Slug único (ej: tacos, pizza)"
              value={form.slug}
              onChange={handleChange}
              required
            />
            <svg className="w-5 h-5 absolute left-2 top-1/2 -translate-y-1/2 text-indigo-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 01-8 0" /></svg>
          </div>
        </div>
        {error && <div className="text-red-600 mt-4 text-center animate-pulse font-semibold">{error}</div>}
        <button
          type="submit"
          className="w-full mt-6 py-2 rounded-lg bg-indigo-600 text-white font-bold text-lg shadow hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
          disabled={loading}
        >
          {loading ? (<span className="flex items-center gap-2"><span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>Creando...</span>) : "Crear negocio"}
        </button>
      </form>
    </div>
  );
} 