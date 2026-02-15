import { useState, useRef } from 'react';
import { FaImage, FaLink, FaUpload, FaTimes, FaCheck, FaSpinner } from 'react-icons/fa';
import { API_URL } from '../../config';

/**
 * Componente reutilizable para subir imágenes.
 * Permite elegir entre pegar una URL o subir un archivo.
 * Solo una opción activa a la vez.
 * 
 * Props:
 * - value: URL actual de la imagen (string)
 * - onChange: callback(url) cuando cambia la imagen
 * - folder: carpeta destino en Spaces ('products', 'banners', etc.)
 * - maxWidth: ancho máximo de compresión (default: 800)
 * - quality: calidad WebP (default: 80)
 * - className: clases adicionales para el contenedor
 */
export default function ImageUploader({ 
  value = '', 
  onChange, 
  folder = 'products', 
  maxWidth = 800, 
  quality = 80,
  className = '' 
}) {
  // 'url' = pegar link, 'upload' = subir archivo
  const [mode, setMode] = useState(value && !value.includes('digitaloceanspaces.com') ? 'url' : 'url');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleModeSwitch = (newMode) => {
    if (uploading) return;
    setMode(newMode);
    setError('');
    // No borrar la imagen al cambiar modo - solo limpiar si el usuario quita explícitamente
  };

  const handleUrlChange = (e) => {
    setError('');
    onChange(e.target.value);
  };

  const handleFileUpload = async (file) => {
    if (!file) return;

    // Validar tipo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setError('Solo JPEG, PNG o WebP');
      return;
    }

    // Validar tamaño (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Máximo 5MB');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('folder', folder);
      formData.append('maxWidth', maxWidth.toString());
      formData.append('quality', quality.toString());

      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const businessId = localStorage.getItem('businessSlug') || localStorage.getItem('businessId');

      const response = await fetch(`${API_URL}/upload/image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-business-id': businessId || '',
        },
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        onChange(data.url);
      } else {
        setError(data.message || 'Error al subir');
      }
    } catch (err) {
      setError('Error de conexión');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleClear = () => {
    onChange('');
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Mode Toggle */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
        <button
          type="button"
          onClick={() => handleModeSwitch('url')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            mode === 'url'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <FaLink className="text-[10px]" />
          <span>URL</span>
        </button>
        <button
          type="button"
          onClick={() => handleModeSwitch('upload')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            mode === 'upload'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <FaUpload className="text-[10px]" />
          <span>Subir</span>
        </button>
      </div>

      {/* URL Mode */}
      {mode === 'url' && (
        <div className="space-y-2">
          <div className="relative">
            <input
              type="text"
              value={value}
              onChange={handleUrlChange}
              className="w-full rounded-lg border border-slate-200 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-slate-900 placeholder-slate-400 px-3 py-2 text-sm transition-all pr-8"
              placeholder="https://ejemplo.com/imagen.jpg"
            />
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors"
              >
                <FaTimes className="text-xs" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Upload Mode */}
      {mode === 'upload' && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={() => setDragOver(false)}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
            dragOver
              ? 'border-blue-400 bg-blue-50'
              : uploading
              ? 'border-slate-200 bg-slate-50 cursor-wait'
              : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => handleFileUpload(e.target.files?.[0])}
            disabled={uploading}
          />
          
          {uploading ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <FaSpinner className="text-blue-500 text-lg animate-spin" />
              <span className="text-xs text-slate-500">Subiendo y comprimiendo...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-2">
              <FaUpload className="text-slate-400 text-lg" />
              <div>
                <span className="text-xs text-blue-600 font-medium">Toca para subir</span>
                <span className="text-xs text-slate-400"> o arrastra una imagen</span>
              </div>
              <span className="text-[10px] text-slate-400">JPEG, PNG, WebP • Máx 5MB</span>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-red-500 text-xs flex items-center gap-1">
          <FaTimes className="text-[10px]" /> {error}
        </p>
      )}

      {/* Preview */}
      {value && (
        <div className="relative w-full h-40 rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
          <img
            src={value}
            alt="Preview"
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          <div style={{ display: 'none' }} className="w-full h-full flex flex-col items-center justify-center bg-slate-50">
            <FaImage className="text-2xl text-slate-300 mb-2" />
            <span className="text-xs text-slate-400">No se pudo cargar</span>
          </div>
          <div className="absolute top-2 right-2 flex gap-1">
            <span className="bg-emerald-500/90 text-white px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1">
              <FaCheck className="text-[8px]" /> Preview
            </span>
            <button
              type="button"
              onClick={handleClear}
              className="bg-red-500/90 hover:bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center transition-colors"
            >
              <FaTimes className="text-[8px]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
