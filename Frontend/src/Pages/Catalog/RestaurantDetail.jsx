import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';

/**
 * RestaurantDetail — resolves restaurantId (ObjectId or slug) to the business
 * slug and redirects immediately to /:slug (the real order-capable menu page).
 * The previous implementation was a non-functional stub with hardcoded placeholder data.
 */
const RestaurantDetail = () => {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      try {
        const res = await api.get(`/businesses/${restaurantId}`);
        const slug = res.data?.slug;
        if (!cancelled) {
          if (slug) navigate(`/${slug}`, { replace: true });
          else setError(true);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    };
    resolve();
    return () => { cancelled = true; };
  }, [restaurantId, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-[16px] font-bold text-gray-900 mb-1">Restaurante no encontrado</p>
          <p className="text-[13px] text-gray-500 mb-6">No pudimos encontrar este restaurante.</p>
          <button
            onClick={() => navigate('/restaurantes', { replace: true })}
            className="px-6 py-2.5 bg-red-500 text-white text-[14px] font-bold rounded-2xl shadow-lg shadow-red-500/25 hover:bg-red-600 active:scale-95 transition-all"
          >
            Ver restaurantes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-3 border-red-500 border-t-transparent rounded-full animate-spin" style={{ borderWidth: 3 }} />
        <p className="text-[13px] text-gray-400 font-medium">Cargando restaurante...</p>
      </div>
    </div>
  );
};

export default RestaurantDetail;
