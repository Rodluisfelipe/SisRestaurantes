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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={onClose}
        >
          <motion.form
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 25 }}
            onSubmit={handleSubmit}
            onClick={e => e.stopPropagation()}
            className="bg-[#333F50]/95 rounded-2xl shadow-2xl p-8 w-full max-w-md mx-auto relative border border-[#333F50]"
          >
            <button 
              type="button" 
              onClick={onClose} 
              className="absolute top-4 right-4 text-[#D1D9FF] hover:text-red-400 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <motion.h2 
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-2xl font-bold text-white mb-6 text-center flex items-center gap-2 justify-center"
            >
              <svg className="w-7 h-7 text-[#3A7AFF]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
          Crear nuevo negocio
            </motion.h2>
            
        <div className="space-y-4">
              <motion.div 
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="relative"
              >
            <input
                  className={`w-full border rounded-lg px-4 py-2.5 pl-10 bg-[#333F50]/50 border-[#333F50] text-white placeholder-[#A5B9FF]/70 focus:outline-none focus:ring-[#3A7AFF] focus:border-[#3A7AFF] ${form.businessName === '' && error ? 'border-red-400' : ''}`}
              name="businessName"
              placeholder="Nombre del negocio"
              value={form.businessName}
              onChange={handleChange}
              required
            />
                <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#A5B9FF]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </motion.div>
              
              <motion.div 
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="relative flex items-center gap-2"
              >
            <div className="relative flex-grow">
              <input
                    className="w-full border rounded-lg px-4 py-2.5 pl-10 bg-[#333F50]/50 border-[#333F50] text-white placeholder-[#A5B9FF]/70 focus:outline-none focus:ring-[#3A7AFF] focus:border-[#3A7AFF]"
                name="logo"
                placeholder="URL del logo (opcional)"
                value={form.logo}
                onChange={handleChange}
              />
                  <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#A5B9FF]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
            </div>
                {form.logo && (
                  <motion.img 
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    src={form.logo} 
                    alt="Logo preview" 
                    className="w-10 h-10 rounded-full object-cover border border-[#5FF9B4] shadow-lg" 
                    onError={e => e.target.style.display='none'} 
                  />
                )}
              </motion.div>
              
              <motion.div 
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="relative"
              >
            <input
                  className="w-full border rounded-lg px-4 py-2.5 pl-10 bg-[#333F50]/50 border-[#333F50] text-white placeholder-[#A5B9FF]/70 focus:outline-none focus:ring-[#3A7AFF] focus:border-[#3A7AFF]"
              name="whatsappNumber"
              placeholder="WhatsApp del negocio"
              value={form.whatsappNumber}
              onChange={handleChange}
            />
                <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#5FF9B4]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </motion.div>
              
              <motion.div 
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="relative"
              >
            <input
                  className={`w-full border rounded-lg px-4 py-2.5 pl-10 bg-[#333F50]/50 border-[#333F50] text-white placeholder-[#A5B9FF]/70 focus:outline-none focus:ring-[#3A7AFF] focus:border-[#3A7AFF] ${form.adminUsername === '' && error ? 'border-red-400' : ''}`}
              name="adminUsername"
              placeholder="Usuario admin principal"
              value={form.adminUsername}
              onChange={handleChange}
              required
            />
                <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#A5B9FF]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 15c2.5 0 4.847.655 6.879 1.804M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </motion.div>
              
              <motion.div 
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="relative flex items-center gap-2"
              >
            <div className="relative flex-grow">
              <input
                    className={`w-full border rounded-lg px-4 py-2.5 pl-10 bg-[#333F50]/50 border-[#333F50] text-white placeholder-[#A5B9FF]/70 focus:outline-none focus:ring-[#3A7AFF] focus:border-[#3A7AFF] ${form.slug === '' && error ? 'border-red-400' : ''}`}
                name="slug"
                placeholder="Slug único (ej: tacos, pizza)"
                value={form.slug}
                onChange={handleChange}
                required
              />
                  <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#A5B9FF]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                  </svg>
            </div>
            <button 
              type="button" 
              onClick={generateSlug}
                  className="text-[#051C2C] bg-[#5FF9B4] hover:bg-[#5FF9B4]/90 px-3 py-2 rounded-lg text-sm font-medium shadow-md transition-colors"
            >
              Generar
            </button>
              </motion.div>
          </div>
            
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3 bg-red-500/20 text-red-300 text-sm rounded-lg border border-red-500/30 text-center"
              >
                {error}
              </motion.div>
            )}
            
            <motion.button
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
          type="submit"
              className={`w-full mt-6 py-3 rounded-lg text-white font-bold text-lg shadow-lg flex items-center justify-center gap-2 ${
                loading 
                  ? 'bg-[#3A7AFF]/50 cursor-not-allowed' 
                  : 'bg-[#3A7AFF] hover:bg-[#3A7AFF]/90 hover:shadow-[#3A7AFF]/20'
              } transition-all duration-300`}
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
              Creando...
            </span>
          ) : "Crear negocio"}
            </motion.button>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 