import React from 'react';
import { motion } from 'framer-motion';
import SubscriptionStatus from './SubscriptionStatus';

const ModernAdminSidebar = ({ activeTab, setActiveTab, businessConfig, handleLogout, pendingOrdersCount }) => {
  const menuItems = [
    { id: 'orders', label: 'Pedidos', icon: '📋', badge: pendingOrdersCount, color: 'from-blue-500 to-blue-600' },
    { id: 'products', label: 'Productos', icon: '🍔', color: 'from-orange-500 to-red-500' },
    { id: 'product-order', label: 'Orden', icon: '🔄', color: 'from-purple-500 to-purple-600' },
    { id: 'categories', label: 'Categorías', icon: '📂', color: 'from-yellow-500 to-orange-500' },
    { id: 'toppings', label: 'Extras', icon: '🧀', color: 'from-amber-500 to-yellow-500' },
    { id: 'customers', label: 'Clientes', icon: '👥', color: 'from-teal-500 to-cyan-500' },
    { id: 'coupons', label: 'Cupones', icon: '🎫', color: 'from-pink-500 to-rose-500' },
    { id: 'tables', label: 'Mesas', icon: '🪑', color: 'from-indigo-500 to-blue-500' },
    { id: 'delivery-zones', label: 'Zonas', icon: '🗺️', color: 'from-green-500 to-emerald-500' },
    { id: 'completed_orders', label: 'Completados', icon: '✅', color: 'from-lime-500 to-green-500' },
    { id: 'catalog', label: 'Catálogo', icon: '📢', color: 'from-violet-500 to-purple-500' },
    { id: 'whatsapp', label: 'WhatsApp', icon: '💬', color: 'from-green-600 to-green-700' },
    { id: 'subscription', label: 'Suscripción', icon: '💳', color: 'from-blue-600 to-indigo-600' },
    { id: 'business', label: 'Negocio', icon: '⚙️', color: 'from-slate-600 to-slate-700' },
    { id: 'theme', label: 'Tema', icon: '🎨', color: 'from-fuchsia-500 to-pink-500' },
    { id: 'location', label: 'Ubicación', icon: '📍', color: 'from-red-500 to-rose-500' },
    { id: 'change-password', label: 'Contraseña', icon: '🔒', color: 'from-gray-600 to-slate-600' },
  ];

  const handleMenuItemClick = (itemId) => {
    setActiveTab(itemId);
  };

  const SidebarContent = () => (
    <div className="h-full flex flex-col">
      <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
        {/* Header with Logo */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 sm:mb-8"
        >
          {/* Restaurant Logo and Name */}
          <div className="flex items-center space-x-3 mb-4 sm:mb-6">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shrink-0">
              {businessConfig?.logo ? (
                <img 
                  src={businessConfig.logo} 
                  alt={businessConfig?.businessName || 'Logo'} 
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl object-cover"
                />
              ) : (
                <span className="text-xl sm:text-2xl">🍔</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-xl font-bold text-slate-900 truncate">{businessConfig?.businessName || 'GO BURGER'}</h1>
              <p className="text-xs sm:text-sm text-slate-500">Sistema de gestión</p>
            </div>
          </div>
          
          {/* Subscription Status - Solo cuando está activa */}
          {businessConfig && businessConfig._id && (
            <SubscriptionStatus 
              businessId={businessConfig._id}
              onNavigateToSubscription={() => setActiveTab('subscription')}
              compact={true}
            />
          )}
        </motion.div>

        {/* Navigation Menu */}
        <nav className="space-y-1.5 sm:space-y-2">
          {menuItems.map((item, index) => (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ x: 4, transition: { duration: 0.2 } }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleMenuItemClick(item.id)}
              className={`w-full flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-left transition-all duration-200 group ${
                activeTab === item.id
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                <span className="text-base sm:text-lg shrink-0">{item.icon}</span>
                <span className="font-medium text-sm sm:text-base truncate">{item.label}</span>
              </div>
              
              {item.badge && item.badge > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={`px-2 py-0.5 sm:py-1 rounded-full text-xs font-semibold shrink-0 ${
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
      </div>

      {/* Logout Button */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="p-4 sm:p-6 pt-4 border-t border-slate-200"
      >
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleLogout}
          className="w-full flex items-center space-x-2 sm:space-x-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700 transition-all duration-200 group"
        >
          <span className="text-base sm:text-lg">🚪</span>
          <span className="font-medium text-sm sm:text-base">Cerrar Sesión</span>
        </motion.button>
      </motion.div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar - Solo visible en desktop */}
      <motion.div 
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        className="hidden lg:block w-72 bg-white shadow-xl min-h-screen border-r border-slate-200 sticky top-0"
      >
        <SidebarContent />
      </motion.div>
    </>
  );
};

export default ModernAdminSidebar;
