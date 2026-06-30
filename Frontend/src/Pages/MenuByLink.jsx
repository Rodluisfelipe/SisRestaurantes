import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BACKEND_URL } from '../config';

const api = axios.create({ baseURL: `${BACKEND_URL}/api` });

const SOCIAL_ICONS = {
  instagram: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.78a4.85 4.85 0 01-1.01-.09z"/>
    </svg>
  ),
};

function StarRating({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} className={`w-3.5 h-3.5 ${i <= Math.round(rating) ? 'text-amber-400' : 'text-slate-300'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
    </div>
  );
}

function BranchCard({ branch, primaryColor, navigate }) {
  const waLink = branch.whatsappNumber
    ? `https://wa.me/${branch.whatsappNumber.replace(/\D/g,'').replace(/^3/, '573')}`
    : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-bold text-slate-800 text-base leading-tight">
              {branch.branchLabel || branch.businessName}
            </h3>
            {branch.address && (
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {branch.address}
              </p>
            )}
          </div>
          <span className={`shrink-0 flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${branch.isCurrentlyOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${branch.isCurrentlyOpen ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            {branch.isCurrentlyOpen ? 'Abierto' : 'Cerrado'}
          </span>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => navigate(`/${branch.slug}`)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm hover:opacity-90 active:scale-95 transition-all"
            style={{ backgroundColor: primaryColor || '#2563eb' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            Pedir aquí
          </button>

          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:scale-95 transition-all border border-emerald-200"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </a>
          )}

          {branch.googleMapsUrl && (
            <a
              href={branch.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center px-3 py-2.5 rounded-xl text-sm bg-slate-50 text-slate-600 hover:bg-slate-100 active:scale-95 transition-all border border-slate-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MenuByLink() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.get(`/link/${slug}`)
      .then(r => setData(r.data))
      .catch(e => { if (e?.response?.status === 404) setNotFound(true); })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-400" />
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
      <div className="text-5xl mb-4">🔍</div>
      <h1 className="text-xl font-bold text-slate-800">Página no encontrada</h1>
      <p className="text-slate-500 text-sm mt-2">El enlace que buscas no existe o fue desactivado.</p>
    </div>
  );

  const isBrand = data.type === 'brand';
  const mainBiz = isBrand ? (data.mainBranch || data.branches?.[0]) : data.business;
  const branches = isBrand ? data.branches : [data.business];
  const primaryColor = mainBiz?.theme?.buttonColor || '#2563eb';
  const social = mainBiz?.socialMedia || {};
  const activeSocials = Object.entries(social).filter(([, v]) => v?.url);
  const cover = mainBiz?.coverImage;
  const logo = mainBiz?.logo;

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: mainBiz?.theme?.menuFont ? `'${mainBiz.theme.menuFont}', sans-serif` : undefined }}>

      {/* Hero */}
      <div className="relative">
        <div
          className="w-full bg-slate-200"
          style={{
            height: '42vw',
            maxHeight: 340,
            minHeight: 180,
            background: cover
              ? `linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.55) 100%), url(${cover}) center/cover no-repeat`
              : `linear-gradient(135deg, ${primaryColor}cc, ${primaryColor}44)`,
          }}
        />
        {/* Logo */}
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-10 z-10">
          <div className="w-20 h-20 rounded-2xl ring-4 ring-white shadow-lg overflow-hidden bg-white flex items-center justify-center">
            {logo
              ? <img src={logo} alt={mainBiz?.businessName} className="w-full h-full object-cover" />
              : <span className="text-3xl font-black text-slate-700">{(mainBiz?.businessName || '?')[0]}</span>
            }
          </div>
        </div>
      </div>

      {/* Identity */}
      <div className="pt-14 pb-6 px-5 text-center">
        <h1 className="text-2xl font-black text-slate-900 leading-tight">
          {isBrand ? data.brand.name : mainBiz?.businessName}
        </h1>
        {mainBiz?.tagline && (
          <p className="text-slate-500 text-sm mt-1 font-medium">{mainBiz.tagline}</p>
        )}
        {(data.avgRating && data.reviewCount > 0) ? (
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <StarRating rating={data.avgRating} />
            <span className="text-xs text-slate-500 font-medium">{data.avgRating} · {data.reviewCount} reseña{data.reviewCount !== 1 ? 's' : ''}</span>
          </div>
        ) : null}
      </div>

      <div className="max-w-md mx-auto px-4 pb-16 space-y-8">

        {/* Branch cards */}
        <div>
          {isBrand && branches.length > 1 && (
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 text-center">Elige tu sede</h2>
          )}
          <div className="space-y-3">
            {branches.map(b => (
              <BranchCard key={b._id} branch={b} primaryColor={primaryColor} navigate={navigate} />
            ))}
          </div>
        </div>

        {/* Featured products */}
        {data.featuredProducts?.length > 0 && (
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 text-center">Nuestros favoritos</h2>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
              {data.featuredProducts.map(p => (
                <div key={p._id} className="shrink-0 w-36 snap-start bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  {p.image
                    ? <div className="h-24 bg-slate-100"><img src={p.image} alt={p.name} className="w-full h-full object-cover" /></div>
                    : <div className="h-24 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-2xl">🍽️</div>
                  }
                  <div className="p-2.5">
                    <p className="text-xs font-semibold text-slate-800 leading-tight line-clamp-2">{p.name}</p>
                    <p className="text-xs font-bold mt-1" style={{ color: primaryColor }}>
                      ${p.price.toLocaleString('es-CO')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Single branch — direct action buttons */}
        {!isBrand && (
          <div className="space-y-3">
            <button
              onClick={() => navigate(`/${mainBiz?.slug}`)}
              className="w-full py-3.5 rounded-2xl font-bold text-white text-base shadow-md hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
              style={{ backgroundColor: primaryColor }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              Ver menú y pedir
            </button>
            {mainBiz?.whatsappNumber && (
              <a
                href={`https://wa.me/${mainBiz.whatsappNumber.replace(/\D/g,'').replace(/^3/, '573')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-2xl font-semibold text-emerald-700 text-sm bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Escribir por WhatsApp
              </a>
            )}
            {mainBiz?.googleMapsUrl && (
              <a
                href={mainBiz.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-2xl font-semibold text-slate-600 text-sm bg-white border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                Cómo llegar
              </a>
            )}
          </div>
        )}

        {/* Social links */}
        {activeSocials.length > 0 && (
          <div className="flex items-center justify-center gap-3">
            {activeSocials.map(([net, val]) => (
              <a
                key={net}
                href={val.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-11 h-11 rounded-full bg-white border border-slate-200 shadow-sm text-slate-600 hover:scale-105 active:scale-95 transition-all"
              >
                {SOCIAL_ICONS[net] || net[0].toUpperCase()}
              </a>
            ))}
            {mainBiz?.extraLink?.url && mainBiz.extraLink.isVisible && (
              <a
                href={mainBiz.extraLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-11 h-11 rounded-full bg-white border border-slate-200 shadow-sm text-slate-600 hover:scale-105 active:scale-95 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </a>
            )}
          </div>
        )}

        {/* Address (single) */}
        {!isBrand && mainBiz?.address && (
          <div className="flex items-center gap-2 text-xs text-slate-400 justify-center">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            {mainBiz.address}
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-4">
          <a href="/" className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-600 transition-colors">
            <span className="font-bold text-slate-500">MenuBy</span>
            <span>· Crea tu propio link</span>
          </a>
        </div>
      </div>
    </div>
  );
}
