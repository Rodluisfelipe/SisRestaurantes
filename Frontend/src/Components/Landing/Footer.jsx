import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  const year = new Date().getFullYear();

  const sections = [
    {
      title: 'Soluciones',
      links: [
        { name: 'Menú para Restaurantes', to: '/menu-digital-restaurante' },
        { name: 'Menú para Bares', to: '/menu-digital-bar' },
        { name: 'Menú para Cafeterías', to: '/menu-digital-cafeteria' },
        { name: 'Menú para Pizzerías', to: '/menu-digital-pizzeria' },
        { name: 'Menú para Hamburgueserías', to: '/menu-digital-hamburgueseria' },
        { name: 'Menú para Hoteles', to: '/menu-digital-hotel' },
        { name: 'Menú para Food Trucks', to: '/menu-digital-food-truck' },
        { name: 'Menú para Panaderías', to: '/menu-digital-panaderia' },
        { name: 'Menú para Comida Rápida', to: '/menu-digital-comida-rapida' },
        { name: 'Menú para Sushi', to: '/menu-digital-sushi' },
        { name: 'Menú para Asaderos', to: '/menu-digital-asadero' },
        { name: 'Menú para Heladerías', to: '/menu-digital-heladeria' },
      ],
    },
    {
      title: 'Funcionalidades',
      links: [
        { name: 'Menú Digital con QR', to: '/features' },
        { name: 'Pedidos a Domicilio', to: '/features' },
        { name: 'Pantalla de Cocina', to: '/features' },
        { name: 'Pagos en Línea', to: '/features' },
        { name: 'Zonas de Entrega', to: '/features' },
        { name: 'Notificaciones Push', to: '/features' },
        { name: 'Reportes de Ventas', to: '/features' },
        { name: 'WhatsApp Integrado', to: '/features' },
      ],
    },
    {
      title: 'Recursos',
      links: [
        { name: 'Blog', to: '/blog' },
        { name: 'Cómo Crear Menú Digital', to: '/blog/como-crear-menu-digital-restaurante' },
        { name: 'Menú Digital vs Impreso', to: '/blog/ventajas-menu-digital-vs-menu-impreso' },
        { name: 'Pedidos por WhatsApp', to: '/blog/como-recibir-pedidos-por-whatsapp' },
        { name: 'Código QR Restaurantes', to: '/blog/codigo-qr-para-restaurantes' },
        { name: 'Aumentar Ventas', to: '/blog/como-aumentar-ventas-restaurante-menu-digital' },
        { name: 'Menú sin Comisiones', to: '/blog/menu-digital-sin-comisiones-colombia' },
        { name: 'Tendencias 2025', to: '/blog/tendencias-restaurantes-digitales-2025' },
      ],
    },
    {
      title: 'Producto',
      links: [
        { name: 'Características', to: '/features' },
        { name: 'Precios', to: '/pricing' },
        { name: 'Demo', to: '/demo' },
        { name: 'Restaurantes', to: '/restaurantes' },
        { name: 'Registrarse Gratis', to: '/register' },
        { name: 'Iniciar Sesión', to: '/login' },
      ],
    },
    {
      title: 'Soporte',
      links: [
        { name: 'Contacto', to: '/contact' },
        { name: 'WhatsApp', href: 'https://wa.me/573028181520' },
        { name: 'Email', href: 'mailto:administrador@menuby.tech' },
      ],
    },
  ];

  const display = "'Bricolage Grotesque', sans-serif";

  return (
    <footer className="bg-[#F4F0EB] text-stone-600 border-t border-[#E4DDD5]">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 pt-12 sm:pt-16 pb-10 sm:pb-12">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-8 lg:gap-6">
          {/* Brand */}
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-2.5 mb-4 sm:mb-5">
              <img src="/logo.jpeg" alt="Menuby - Menú Digital para Restaurantes" width="36" height="36" className="w-9 h-9 rounded-[11px] object-cover" style={{ boxShadow: '0 2px 10px rgba(232,0,45,0.15)' }} />
              <span className="text-xl font-extrabold tracking-tight text-[#17120F]" style={{ fontFamily: display }}>
                Menu<span className="text-red-600">by</span>
              </span>
            </Link>
            <p className="text-stone-500 text-sm leading-relaxed mb-5 sm:mb-6 max-w-xs">
              La plataforma #1 de menú digital para restaurantes en Colombia. Sin comisiones, sin complicaciones. Más de 500 negocios confían en nosotros.
            </p>
            <a
              href="https://wa.me/573028181520"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-green-600 transition-colors py-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
              +57 302 818 1520
            </a>
          </div>

          {/* Links */}
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="text-[#17120F] text-xs font-bold uppercase tracking-wider mb-3 sm:mb-4">{section.title}</h3>
              <ul className="space-y-1.5 sm:space-y-2">
                {section.links.map((link) => (
                  <li key={link.name}>
                    {link.to ? (
                      <Link to={link.to} className="text-xs sm:text-sm text-stone-500 hover:text-red-600 transition-colors py-0.5 inline-block leading-snug">
                        {link.name}
                      </Link>
                    ) : (
                      <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-xs sm:text-sm text-stone-500 hover:text-red-600 transition-colors py-0.5 inline-block leading-snug">
                        {link.name}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[#E4DDD5]">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-5 sm:py-6 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <p className="text-xs text-stone-400">© {year} Menuby. Todos los derechos reservados.</p>
          <div className="flex items-center gap-4 text-xs text-stone-400">
            <span>Hecho con pasión para restaurantes en Colombia 🇨🇴</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
