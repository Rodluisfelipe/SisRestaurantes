import React, { useState } from 'react';
import { motion } from 'framer-motion';

const Demo = () => {
  const [selectedDemo, setSelectedDemo] = useState('restaurant');

  const demos = [
    {
      id: 'restaurant',
      name: 'Restaurante',
      description: 'Menú completo con categorías, productos y opciones',
      image: '🍽️',
      features: ['Categorías organizadas', 'Productos con imágenes', 'Opciones personalizables', 'Precios dinámicos'],
      sampleMenu: [
        { category: 'Entradas', items: ['Nachos con Queso', 'Alitas BBQ', 'Empanadas'] },
        { category: 'Platos Principales', items: ['Hamburguesa Clásica', 'Pasta Carbonara', 'Pollo a la Plancha'] },
        { category: 'Postres', items: ['Tiramisú', 'Brownie con Helado', 'Flan de Caramelo'] }
      ]
    },
    {
      id: 'cafe',
      name: 'Cafetería',
      description: 'Menú de bebidas y snacks con horarios especiales',
      image: '☕',
      features: ['Bebidas calientes y frías', 'Snacks y postres', 'Horarios de servicio', 'Promociones especiales'],
      sampleMenu: [
        { category: 'Bebidas Calientes', items: ['Café Americano', 'Cappuccino', 'Latte', 'Chocolate Caliente'] },
        { category: 'Bebidas Frías', items: ['Frappé de Vainilla', 'Iced Coffee', 'Smoothie de Frutas'] },
        { category: 'Snacks', items: ['Croissant', 'Muffin de Arándanos', 'Sándwich Club'] }
      ]
    },
    {
      id: 'bar',
      name: 'Bar',
      description: 'Carta de bebidas y comida con ambiente nocturno',
      image: '🍸',
      features: ['Cócteles y bebidas', 'Tapas y comida', 'Ambiente nocturno', 'Eventos especiales'],
      sampleMenu: [
        { category: 'Cócteles', items: ['Mojito', 'Margarita', 'Piña Colada', 'Martini'] },
        { category: 'Tapas', items: ['Patatas Bravas', 'Jamón Ibérico', 'Queso Manchego'] },
        { category: 'Bebidas', items: ['Cerveza Artesanal', 'Vino Tinto', 'Whisky Premium'] }
      ]
    },
    {
      id: 'foodtruck',
      name: 'Food Truck',
      description: 'Menú móvil con ubicación en tiempo real',
      image: '🚚',
      features: ['Ubicación en tiempo real', 'Menú estacional', 'Pedidos anticipados', 'Redes sociales'],
      sampleMenu: [
        { category: 'Especialidades', items: ['Burger Gourmet', 'Tacos de Carnitas', 'Hot Dog Premium'] },
        { category: 'Acompañamientos', items: ['Papas Fritas', 'Onion Rings', 'Ensalada César'] },
        { category: 'Bebidas', items: ['Refrescos', 'Agua', 'Jugos Naturales'] }
      ]
    }
  ];

  const currentDemo = demos.find(demo => demo.id === selectedDemo);

  return (
    <div className="min-h-screen bg-white">
      
      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-white via-green-50 to-white">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-4xl mx-auto mb-16"
          >
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Prueba Menuby antes de decidir
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Explora nuestros menús de ejemplo y descubre cómo Menuby puede transformar tu negocio
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://www.menuby.tech/macdonalds"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center"
              >
                <span>Ver Demo en Vivo</span>
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
              <a
                href="/register"
                className="px-8 py-4 bg-transparent hover:bg-white hover:text-gray-900 text-green-600 font-semibold rounded-xl border-2 border-green-600 hover:border-gray-300 transition-all duration-300 transform hover:scale-105 flex items-center"
              >
                <span>Crear Mi Menú Gratis</span>
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </a>
            </div>
          </motion.div>

          {/* Demo Selector */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="max-w-6xl mx-auto"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              {demos.map((demo) => (
                <motion.button
                  key={demo.id}
                  onClick={() => setSelectedDemo(demo.id)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`p-6 rounded-2xl border-2 transition-all duration-300 ${
                    selectedDemo === demo.id
                      ? 'border-green-500 bg-green-50 shadow-lg'
                      : 'border-gray-200 bg-white hover:border-green-300 hover:shadow-md'
                  }`}
                >
                  <div className="text-4xl mb-4">{demo.image}</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{demo.name}</h3>
                  <p className="text-sm text-gray-600">{demo.description}</p>
                </motion.button>
              ))}
            </div>

            {/* Demo Preview */}
            <motion.div
              key={selectedDemo}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
            >
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="ml-4 text-sm text-gray-600">
                    Menuby Demo - {currentDemo?.name} | www.menuby.tech/{currentDemo?.name.toLowerCase()}
                  </span>
                </div>
              </div>
              
              <div className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Menu Preview */}
                  <div>
                    <div className="flex items-center space-x-3 mb-6">
                      <div className="text-3xl">{currentDemo?.image}</div>
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900">{currentDemo?.name}</h3>
                        <p className="text-gray-600">{currentDemo?.description}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-6">
                      {currentDemo?.sampleMenu.map((category, index) => (
                        <div key={index}>
                          <h4 className="text-lg font-semibold text-gray-800 mb-3 border-b border-gray-200 pb-2">
                            {category.category}
                          </h4>
                          <div className="space-y-3">
                            {category.items.map((item, itemIndex) => (
                              <div key={itemIndex} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-green-50 transition-colors duration-200">
                                <div>
                                  <h5 className="font-medium text-gray-900">{item}</h5>
                                  <p className="text-sm text-gray-600">Descripción del producto</p>
                                </div>
                                <span className="text-lg font-bold text-green-600">
                                  ${Math.floor(Math.random() * 20 + 10)}.000
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Features & CTA */}
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-6">Características</h3>
                    <div className="space-y-4 mb-8">
                      {currentDemo?.features.map((feature, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.5, delay: index * 0.1 }}
                          className="flex items-center space-x-3"
                        >
                          <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <span className="text-gray-700">{feature}</span>
                        </motion.div>
                      ))}
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
                      <h4 className="text-lg font-semibold text-green-800 mb-2">¿Te gusta lo que ves?</h4>
                      <p className="text-green-700 mb-4">
                        Crea tu propio menú en minutos con nuestra plataforma fácil de usar.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <a
                          href="https://www.menuby.tech/macdonalds"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors duration-200 text-center"
                        >
                          Ver Demo en Vivo
                        </a>
                        <a
                          href="/register"
                          className="flex-1 px-4 py-3 bg-transparent hover:bg-green-600 hover:text-white text-green-600 font-semibold rounded-lg border-2 border-green-600 hover:border-green-700 transition-all duration-200 text-center"
                        >
                          Crear Mi Menú
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Stats Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-20 text-center"
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-8">
              Únete a miles de restaurantes exitosos
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="text-4xl font-bold text-green-600 mb-2">500+</div>
                <div className="text-gray-600">Restaurantes activos</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-green-600 mb-2">35%</div>
                <div className="text-gray-600">Aumento promedio en ventas</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-green-600 mb-2">24/7</div>
                <div className="text-gray-600">Soporte disponible</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Demo;