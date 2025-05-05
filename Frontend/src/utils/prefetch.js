export const prefetchRoutes = () => {
  // Prefetch de rutas comunes
  const routes = ['./Pages/Menu', './Pages/Admin', './Pages/Login'];
  
  routes.forEach(route => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = route;
    document.head.appendChild(link);
  });
}; 