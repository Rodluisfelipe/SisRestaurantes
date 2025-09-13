import React from 'react';
import { motion } from 'framer-motion';

const ModernAdminSidebar = ({ activeTab, setActiveTab, businessConfig, handleLogout, pendingOrdersCount }) => {
  const menuItems = [
    { id: 'orders', label: 'Pedidos', icon: '📋', badge: pendingOrdersCount },
    { id: 'products', label: 'Productos', icon: '🍔' },
    { id: 'categories', label: 'Categorías', icon: '📂' },
    { id: 'toppings', label: 'Extras', icon: '🧀' },
    { id: 'tables', label: 'Mesas', icon: '🪑' },
    { id: 'completed_orders', label: 'Pedidos Completados', icon: '✅' },
    { id: 'business', label: 'Configuración', icon: '⚙️' },
    { id: 'theme', label: 'Tema', icon: '🎨' },
    { id: 'change-password', label: 'Cambiar Contraseña', icon: '🔒' },
  ];

  return (
    <motion.div 
      initial={{ x: -300 }}
      animate={{ x: 0 }}
      className="w-72 bg-white shadow-xl min-h-screen border-r border-slate-200"
    >
      <div className="p-6">
        {/* Header with Logo */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          {/* Restaurant Logo and Name */}
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg">
              {businessConfig?.logo ? (
                <img 
                  src={businessConfig.logo} 
                  alt={businessConfig?.businessName || 'Logo'} 
                  className="w-12 h-12 rounded-xl object-cover"
                />
              ) : (
                <span className="text-2xl">🍔</span>
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{businessConfig?.businessName || 'GO BURGER'}</h1>
              <p className="text-sm text-slate-500">Sistema de gestión</p>
            </div>
          </div>
          
          {/* Admin Panel Title */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-100">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Panel de Administración</h2>
            <p className="text-sm text-slate-600">Gestiona tu restaurante desde aquí</p>
          </div>
        </motion.div>

        {/* Navigation Menu */}
        <nav className="space-y-2">
          {menuItems.map((item, index) => (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ x: 4, transition: { duration: 0.2 } }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all duration-200 group ${
                activeTab === item.id
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-lg">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </div>
              
              {item.badge && item.badge > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    activeTab === item.id
                      ? 'bg-white bg-opacity-20 text-white'
                      : 'bg-red-500 text-white'
                  }`}
                >
                  {item.badge}
                </motion.div>
              )}
            </motion.button>
          ))}
        </nav>

        {/* Logout Button */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mt-8 pt-6 border-t border-slate-200"
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700 transition-all duration-200 group"
          >
            <span className="text-lg">🚪</span>
            <span className="font-medium">Cerrar Sesión</span>
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default ModernAdminSidebar;
