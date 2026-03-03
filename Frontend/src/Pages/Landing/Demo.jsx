import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import useLandingSEO from '../../hooks/useLandingSEO';

const DEMOS = [
  {
    id: 'restaurant',
    name: 'Restaurante',
    emoji: '🍽️',
    desc: 'Menú completo con categorías, productos y extras.',
    menu: [
      { cat: 'Entradas', items: [{ n: 'Nachos con Queso', p: '$12.900' }, { n: 'Alitas BBQ x8', p: '$18.500' }, { n: 'Empanadas x3', p: '$8.900' }] },
      { cat: 'Platos Fuertes', items: [{ n: 'Hamburguesa Clásica', p: '$22.900' }, { n: 'Pasta Carbonara', p: '$19.900' }, { n: 'Pollo a la Plancha', p: '$21.500' }] },
      { cat: 'Postres', items: [{ n: 'Tiramisú', p: '$12.000' }, { n: 'Brownie con Helado', p: '$10.500' }] },
    ]
  },
  {
    id: 'cafe',
    name: 'Cafetería',
    emoji: '☕',
    desc: 'Bebidas, postres y snacks con estilo.',
    menu: [
      { cat: 'Bebidas Calientes', items: [{ n: 'Café Americano', p: '$5.500' }, { n: 'Cappuccino', p: '$7.900' }, { n: 'Latte', p: '$8.500' }] },
      { cat: 'Bebidas Frías', items: [{ n: 'Frappé de Vainilla', p: '$12.900' }, { n: 'Iced Coffee', p: '$9.500' }] },
      { cat: 'Snacks', items: [{ n: 'Croissant', p: '$6.500' }, { n: 'Muffin de Arándanos', p: '$7.200' }] },
    ]
  },
  {
    id: 'pizzeria',
    name: 'Pizzería',
    emoji: '🍕',
    desc: 'Pizzas, combos y bebidas para toda ocasión.',
    menu: [
      { cat: 'Pizzas', items: [{ n: 'Margarita Personal', p: '$15.900' }, { n: 'Pepperoni Mediana', p: '$29.900' }, { n: 'Hawaiana Familiar', p: '$42.900' }] },
      { cat: 'Combos', items: [{ n: 'Pizza + Gaseosa', p: '$22.900' }, { n: 'Familiar + 4 Gaseosas', p: '$49.900' }] },
    ]
  },
  {
    id: 'foodtruck',
    name: 'Food Truck',
    emoji: '🚚',
    desc: 'Menú rápido y directo, ideal para la calle.',
    menu: [
      { cat: 'Especialidades', items: [{ n: 'Burger Gourmet', p: '$19.900' }, { n: 'Tacos de Carnitas x3', p: '$16.500' }, { n: 'Hot Dog Premium', p: '$13.900' }] },
      { cat: 'Acompañamientos', items: [{ n: 'Papas Fritas', p: '$7.900' }, { n: 'Onion Rings', p: '$9.500' }] },
    ]
  },
];

const Demo = () => {
  useLandingSEO({
    title: 'Demo Menú Digital Interactivo para Restaurantes | Menuby',
    description: 'Explora la demo interactiva de Menuby. Mira cómo se ve un menú digital con QR para restaurante, cafetería y food truck. Prueba gratis.',
    canonical: '/demo',
    keywords: 'demo menú digital, ejemplo menú QR restaurante, menú digital interactivo, cómo se ve un menú digital',
  });

  const [sel, setSel] = useState('restaurant');
  const current = DEMOS.find(d => d.id === sel);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="pt-28 pb-12 bg-gradient-to-br from-white via-red-50/40 to-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-4">
              Demo del Menú Digital — Explora Menuby en Acción
            </h1>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-8">
              Selecciona un tipo de negocio y descubre cómo se ve un menú digital con código QR.
            </p>
          </motion.div>

          {/* Selector */}
          <div className="flex flex-wrap justify-center gap-3 mb-4">
            {DEMOS.map(d => (
              <button
                key={d.id}
                onClick={() => setSel(d.id)}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  sel === d.id
                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-red-200'
                }`}
              >
                {d.emoji} {d.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Preview */}
      <section className="pb-20">
        <div className="max-w-4xl mx-auto px-4">
          <motion.div
            key={sel}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
          >
            {/* Browser bar */}
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 bg-red-400 rounded-full" />
                <div className="w-3 h-3 bg-amber-400 rounded-full" />
                <div className="w-3 h-3 bg-green-400 rounded-full" />
              </div>
              <div className="ml-3 flex-1 bg-white rounded-lg px-3 py-1.5 text-xs text-gray-500 border border-gray-200">
                menuby.tech/{current?.id === 'restaurant' ? 'tu-restaurante' : current?.id}
              </div>
            </div>

            {/* Menu content */}
            <div className="p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl">{current?.emoji}</span>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{current?.name}</h3>
                  <p className="text-sm text-gray-500">{current?.desc}</p>
                </div>
              </div>

              <div className="space-y-6">
                {current?.menu.map((cat, ci) => (
                  <div key={ci}>
                    <h4 className="text-sm font-bold text-gray-800 mb-3 border-b border-gray-100 pb-2">{cat.cat}</h4>
                    <div className="space-y-2">
                      {cat.items.map((item, ii) => (
                        <div key={ii} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-red-50/50 transition-colors">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{item.n}</p>
                            <p className="text-xs text-gray-400">Descripción del producto</p>
                          </div>
                          <span className="text-sm font-bold text-red-600">{item.p}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 bg-red-500 rounded-xl py-3 text-center cursor-pointer hover:bg-red-600 transition-colors">
                <span className="text-white font-bold text-sm">🛒 Ver Carrito</span>
              </div>
            </div>
          </motion.div>

          {/* CTA below demo */}
          <div className="mt-10 text-center">
            <p className="text-gray-500 mb-4">¿Te gusta lo que ves? Crea el tuyo.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/register" className="px-7 py-3.5 rounded-xl text-white font-bold text-sm shadow-lg shadow-red-500/25 hover:-translate-y-0.5 transition-all" style={{ backgroundColor: '#E31E24' }}>
                Crear Mi Menú Gratis →
              </Link>
              <Link to="/pricing" className="px-7 py-3.5 rounded-xl bg-white text-gray-700 font-semibold text-sm border border-gray-200 hover:border-gray-300 transition-all">
                Ver Precios
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Demo;
