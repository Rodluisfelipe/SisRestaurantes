import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import useLandingSEO from '../../hooks/useLandingSEO';
import { getAllPosts } from '../../data/blogPosts';

const BRAND = '#E31E24';

const categoryColors = {
  'Guías': 'bg-blue-50 text-blue-600',
  'Tendencias': 'bg-purple-50 text-purple-600',
  'Funcionalidades': 'bg-green-50 text-green-600',
  'Estrategia': 'bg-amber-50 text-amber-600',
  'Comparativas': 'bg-red-50 text-red-600',
};

export default function BlogIndex() {
  useLandingSEO({
    title: 'Blog de Menú Digital para Restaurantes | Menuby Colombia',
    description: 'Guías, tendencias y consejos sobre menú digital, código QR, pedidos online y tecnología para restaurantes en Colombia. Aprende a digitalizar tu negocio.',
    canonical: '/blog',
    keywords: 'blog menú digital, guías restaurante digital, tendencias restaurantes Colombia, menú QR consejos',
  });

  const posts = getAllPosts();

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="pt-24 sm:pt-28 pb-12 sm:pb-16 bg-gradient-to-br from-white via-red-50/40 to-white">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <div className="inline-flex items-center gap-2 bg-red-50 text-red-600 text-xs font-semibold px-4 py-2 rounded-full mb-5 sm:mb-6">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              Blog
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
              Blog sobre Menú Digital para Restaurantes
            </h1>
            <p className="text-base sm:text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
              Guías prácticas, tendencias y estrategias para digitalizar tu restaurante y vender más con un menú digital.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Posts Grid */}
      <section className="py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {posts.map((post, i) => (
              <motion.article
                key={post.slug}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
              >
                <Link
                  to={`/blog/${post.slug}`}
                  className="group block h-full bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300 overflow-hidden"
                >
                  {/* Color banner instead of image */}
                  <div className="h-2 w-full" style={{ backgroundColor: BRAND }} />
                  
                  <div className="p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${categoryColors[post.category] || 'bg-gray-50 text-gray-600'}`}>
                        {post.category}
                      </span>
                      <span className="text-xs text-gray-400">{post.readTime}</span>
                    </div>

                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 group-hover:text-red-500 transition-colors leading-snug">
                      {post.title}
                    </h2>

                    <p className="text-sm text-gray-500 leading-relaxed mb-4">
                      {post.excerpt}
                    </p>

                    <div className="flex items-center justify-between">
                      <time className="text-xs text-gray-400" dateTime={post.date}>
                        {new Date(post.date).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </time>
                      <span className="text-red-500 text-sm font-semibold group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                        Leer
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-4">
            ¿Listo para crear tu menú digital?
          </h2>
          <p className="text-gray-500 mb-8 max-w-xl mx-auto">
            Empieza gratis en 5 minutos. Sin tarjeta de crédito, sin contratos.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-bold text-sm shadow-lg shadow-red-500/30 hover:shadow-xl hover:-translate-y-0.5 transition-all"
            style={{ backgroundColor: BRAND }}
          >
            Crear Mi Menú Gratis
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </Link>
        </div>
      </section>
    </div>
  );
}
