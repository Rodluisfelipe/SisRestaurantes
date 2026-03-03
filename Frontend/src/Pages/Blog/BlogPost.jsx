import React, { useMemo } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import useLandingSEO from '../../hooks/useLandingSEO';
import { getPostBySlug, getRelatedPosts } from '../../data/blogPosts';

const BRAND = '#E31E24';

// Simple markdown-to-JSX renderer for blog content
function renderMarkdown(md) {
  if (!md) return null;
  const lines = md.trim().split('\n');
  const elements = [];
  let i = 0;
  let listItems = [];
  let tableRows = [];
  let tableHeaders = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="space-y-2 my-4 pl-5 list-disc text-gray-600">
          {listItems.map((item, idx) => <li key={idx} dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />)}
        </ul>
      );
      listItems = [];
    }
  };

  const flushTable = () => {
    if (tableHeaders.length > 0 && tableRows.length > 0) {
      elements.push(
        <div key={`table-${elements.length}`} className="overflow-x-auto my-6">
          <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                {tableHeaders.map((h, idx) => (
                  <th key={idx} className="px-4 py-3 text-left font-semibold text-gray-700 border-b border-gray-200" dangerouslySetInnerHTML={{ __html: inlineFormat(h.trim()) }} />
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, rIdx) => (
                <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-4 py-3 text-gray-600 border-b border-gray-100" dangerouslySetInnerHTML={{ __html: inlineFormat(cell.trim()) }} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableHeaders = [];
      tableRows = [];
    }
  };

  function inlineFormat(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-red-500 font-semibold hover:text-red-600 transition-colors">$1</a>')
      .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm text-gray-700">$1</code>');
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line
    if (!trimmed) {
      flushList();
      flushTable();
      i++;
      continue;
    }

    // Table row
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.split('|').filter(Boolean);
      // Check if separator row (|---|---|)
      if (cells.every(c => /^[\s-:]+$/.test(c))) {
        i++;
        continue; // Skip separator
      }
      if (tableHeaders.length === 0) {
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
      }
      i++;
      continue;
    } else {
      flushTable();
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h4 key={`h4-${i}`} className="text-lg font-bold text-gray-900 mt-8 mb-3">
          {trimmed.slice(4)}
        </h4>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h3 key={`h3-${i}`} className="text-xl sm:text-2xl font-bold text-gray-900 mt-10 mb-4">
          {trimmed.slice(3)}
        </h3>
      );
      i++;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      flushList();
      const text = trimmed.slice(1).trim();
      elements.push(
        <blockquote key={`bq-${i}`} className="border-l-4 border-red-400 pl-4 py-2 my-4 italic text-gray-600 bg-red-50/50 rounded-r-lg" dangerouslySetInnerHTML={{ __html: inlineFormat(text) }} />
      );
      i++;
      continue;
    }

    // Unordered list
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      listItems.push(trimmed.slice(2));
      i++;
      continue;
    }

    // Ordered list 
    if (/^\d+\.\s/.test(trimmed)) {
      const text = trimmed.replace(/^\d+\.\s/, '');
      listItems.push(text);
      i++;
      continue;
    }

    // Paragraph
    flushList();
    elements.push(
      <p key={`p-${i}`} className="text-gray-600 leading-relaxed my-4" dangerouslySetInnerHTML={{ __html: inlineFormat(trimmed) }} />
    );
    i++;
  }

  flushList();
  flushTable();

  return elements;
}

const categoryColors = {
  'Guías': 'bg-blue-50 text-blue-600',
  'Tendencias': 'bg-purple-50 text-purple-600',
  'Funcionalidades': 'bg-green-50 text-green-600',
  'Estrategia': 'bg-amber-50 text-amber-600',
  'Comparativas': 'bg-red-50 text-red-600',
};

export default function BlogPost() {
  const { slug } = useParams();
  const post = getPostBySlug(slug);
  const related = useMemo(() => post ? getRelatedPosts(slug, 3) : [], [slug, post]);

  useLandingSEO(post ? {
    title: `${post.title} | Blog Menuby`,
    description: post.excerpt,
    canonical: `/blog/${post.slug}`,
    keywords: post.keywords,
    type: 'article',
  } : {
    title: 'Artículo no encontrado | Blog Menuby',
    description: 'El artículo que buscas no existe.',
    canonical: '/blog',
  });

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  const content = useMemo(() => renderMarkdown(post.content), [post.content]);

  // JSON-LD Article schema
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.title,
    "description": post.excerpt,
    "datePublished": post.date,
    "dateModified": post.date,
    "author": {
      "@type": "Organization",
      "name": "Menuby",
      "url": "https://menuby.tech"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Menuby",
      "logo": {
        "@type": "ImageObject",
        "url": "https://menuby.tech/logo.jpeg"
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://menuby.tech/blog/${post.slug}`
    },
    "keywords": post.keywords,
  };

  return (
    <div className="min-h-screen bg-white">
      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="pt-24 sm:pt-28 pb-8 sm:pb-12 bg-gradient-to-br from-white via-red-50/40 to-white">
        <div className="max-w-3xl mx-auto px-5 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
              <Link to="/" className="hover:text-gray-600 transition-colors">Inicio</Link>
              <span>/</span>
              <Link to="/blog" className="hover:text-gray-600 transition-colors">Blog</Link>
              <span>/</span>
              <span className="text-gray-600 truncate max-w-[200px]">{post.title}</span>
            </nav>

            <div className="flex items-center gap-3 mb-4">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${categoryColors[post.category] || 'bg-gray-50 text-gray-600'}`}>
                {post.category}
              </span>
              <span className="text-sm text-gray-400">{post.readTime} de lectura</span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight mb-4">
              {post.title}
            </h1>

            <p className="text-base sm:text-lg text-gray-500 leading-relaxed">
              {post.excerpt}
            </p>

            <div className="mt-4 flex items-center gap-4">
              <time className="text-sm text-gray-400" dateTime={post.date}>
                {new Date(post.date).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
              </time>
              <span className="text-sm text-gray-300">|</span>
              <span className="text-sm text-gray-400">Por Menuby</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Article Content */}
      <article className="py-8 sm:py-12">
        <div className="max-w-3xl mx-auto px-5 sm:px-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="prose prose-lg max-w-none"
          >
            {content}
          </motion.div>
        </div>
      </article>

      {/* Author / CTA Box */}
      <section className="py-8 sm:py-12">
        <div className="max-w-3xl mx-auto px-5 sm:px-6">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 sm:p-10 text-center">
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">
              ¿Listo para digitalizar tu restaurante?
            </h3>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              Crea tu menú digital con código QR en 5 minutos. 7 días gratis, sin tarjeta de crédito.
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
        </div>
      </section>

      {/* Related Posts */}
      {related.length > 0 && (
        <section className="py-12 sm:py-16 bg-gray-50">
          <div className="max-w-6xl mx-auto px-5 sm:px-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
              Artículos Relacionados
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {related.map((p) => (
                <Link
                  key={p.slug}
                  to={`/blog/${p.slug}`}
                  className="group block bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300 overflow-hidden"
                >
                  <div className="h-1.5 w-full" style={{ backgroundColor: BRAND }} />
                  <div className="p-5">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${categoryColors[p.category] || 'bg-gray-50 text-gray-600'}`}>
                      {p.category}
                    </span>
                    <h3 className="mt-3 text-base font-bold text-gray-900 group-hover:text-red-500 transition-colors leading-snug">
                      {p.title}
                    </h3>
                    <p className="mt-2 text-sm text-gray-500 line-clamp-2">{p.excerpt}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
