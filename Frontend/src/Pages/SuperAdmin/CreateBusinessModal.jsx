import React, { useState } from "react";
import { createBusiness } from "../../services/superadminApi";
import { motion, AnimatePresence } from "framer-motion";

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
    if (error) setError("");
  };

  const generateSlug = () => {
    if (form.businessName) {
      const slug = form.businessName
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .substring(0, 20);
      setForm({ ...form, slug });
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await createBusiness(form);
      onCreated();
      setForm({ businessName: "", logo: "", whatsappNumber: "", adminUsername: "", slug: "" });
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Error al crear negocio");
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    {
      name: 'businessName', label: 'Nombre del negocio', placeholder: 'Ej: Tacos El Patrón', required: true,
      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    },
    {
      name: 'adminUsername', label: 'Usuario administrador', placeholder: 'Ej: juanperez', required: true,
      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    },
    {
      name: 'whatsappNumber', label: 'WhatsApp', placeholder: '+57 300 123 4567 (opcional)', required: false,
      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    },
    {
      name: 'logo', label: 'Logo URL', placeholder: 'https://... (opcional)', required: false,
      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 002.25-2.25V5.25a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          <motion.form
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", damping: 30, stiffness: 400 }}
            onSubmit={handleSubmit}
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-lg bg-[#0d1b2a]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Top accent */}
            <div className="h-[2px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />

            <div className="p-6 sm:p-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Nuevo negocio</h2>
                    <p className="text-xs text-white/30">Completa los datos del negocio</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 text-white/30 hover:text-white/60 hover:bg-white/[0.06] rounded-xl transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Fields */}
              <div className="space-y-4">
                {fields.map((field, idx) => (
                  <motion.div
                    key={field.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <label className="block text-xs font-medium text-white/40 mb-1.5 ml-1">
                      {field.label} {field.required && <span className="text-cyan-400">*</span>}
                    </label>
                    <div className="relative group flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          name={field.name}
                          value={form[field.name]}
                          onChange={handleChange}
                          required={field.required}
                          placeholder={field.placeholder}
                          className="w-full px-4 py-2.5 pl-10 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 outline-none transition-all duration-200 focus:border-cyan-500/40 focus:bg-white/[0.06] focus:ring-1 focus:ring-cyan-500/10"
                        />
                        <svg className="w-[16px] h-[16px] absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cyan-400/50 transition-colors" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          {field.icon}
                        </svg>
                      </div>
                      {field.name === 'logo' && form.logo && (
                        <img
                          src={form.logo}
                          alt="Preview"
                          className="w-10 h-10 rounded-xl object-cover border border-white/10 flex-shrink-0"
                          onError={e => e.target.style.display = 'none'}
                        />
                      )}
                    </div>
                  </motion.div>
                ))}

                {/* Slug field with generate button */}
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <label className="block text-xs font-medium text-white/40 mb-1.5 ml-1">
                    Slug <span className="text-cyan-400">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 group">
                      <input
                        name="slug"
                        value={form.slug}
                        onChange={handleChange}
                        required
                        placeholder="mi-negocio"
                        className="w-full px-4 py-2.5 pl-10 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 outline-none transition-all duration-200 focus:border-cyan-500/40 focus:bg-white/[0.06] focus:ring-1 focus:ring-cyan-500/10 font-mono"
                      />
                      <svg className="w-[16px] h-[16px] absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cyan-400/50 transition-colors" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-3.828a4.5 4.5 0 010 6.364l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757" />
                      </svg>
                    </div>
                    <button
                      type="button"
                      onClick={generateSlug}
                      className="px-3 py-2.5 rounded-xl text-xs font-medium bg-white/[0.06] border border-white/[0.08] text-white/50 hover:text-white/80 hover:bg-white/[0.08] transition-all whitespace-nowrap"
                    >
                      Auto
                    </button>
                  </div>
                  {form.slug && (
                    <p className="mt-1.5 text-[11px] text-white/20 ml-1">
                      menuby.tech/<span className="text-cyan-400/60">{form.slug}</span>
                    </p>
                  )}
                </motion.div>
              </div>

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20"
                >
                  <p className="text-sm text-red-300/90">{error}</p>
                </motion.div>
              )}

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium text-white/40 hover:text-white/60 bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all duration-300 ${
                    loading
                      ? 'bg-white/[0.06] text-white/30 cursor-not-allowed'
                      : 'bg-white text-black hover:bg-white/90 active:scale-[0.98]'
                  }`}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creando...
                    </span>
                  ) : 'Crear negocio'}
                </button>
              </div>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
