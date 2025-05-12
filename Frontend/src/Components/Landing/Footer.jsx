import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../Context/ThemeContext';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { theme, colors } = useTheme();
  const isDark = theme === 'dark';

  const footerSections = [
    {
      title: 'Producto',
      links: [
        { name: 'Características', path: '/features' },
        { name: 'Precios', path: '/pricing' },
        { name: 'Demo', path: '/demo' },
        { name: 'Actualizaciones', path: '/updates' }
      ]
    },
    {
      title: 'Soporte',
      links: [
        { name: 'Documentación', path: '/docs' },
        { name: 'Tutoriales', path: '/tutorials' },
        { name: 'Centro de ayuda', path: '/help' },
        { name: 'FAQ', path: '/faq' }
      ]
    },
    {
      title: 'Empresa',
      links: [
        { name: 'Sobre nosotros', path: '/about' },
        { name: 'Blog', path: '/blog' },
        { name: 'Contacto', path: '/contact' },
        { name: 'Carreras', path: '/careers' }
      ]
    },
    {
      title: 'Legal',
      links: [
        { name: 'Privacidad', path: '/privacy' },
        { name: 'Términos', path: '/terms' },
        { name: 'Cookies', path: '/cookies' }
      ]
    }
  ];

  const socialLinks = [
    { name: 'Facebook', icon: 'facebook', url: 'https://www.instagram.com/menubyco?igsh=MWEwYWIyaGt3bHBhbQ==' },
    { name: 'Twitter', icon: 'twitter', url: 'https://www.instagram.com/menubyco?igsh=MWEwYWIyaGt3bHBhbQ==' },
    { name: 'Instagram', icon: 'instagram', url: 'https://www.instagram.com/menubyco?igsh=MWEwYWIyaGt3bHBhbQ==' },
    { name: 'LinkedIn', icon: 'linkedin', url: 'https://www.instagram.com/menubyco?igsh=MWEwYWIyaGt3bHBhbQ==' }
  ];

  // Iconos sociales
  const getSocialIcon = (name) => {
    switch (name.toLowerCase()) {
      case 'facebook':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z" />
          </svg>
        );
      case 'twitter':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
          </svg>
        );
      case 'instagram':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
          </svg>
        );
      case 'linkedin':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4.98 3.5c0 1.381-1.11 2.5-2.48 2.5s-2.48-1.119-2.48-2.5c0-1.38 1.11-2.5 2.48-2.5s2.48 1.12 2.48 2.5zm.02 4.5h-5v16h5v-16zm7.982 0h-4.968v16h4.969v-8.399c0-4.67 6.029-5.052 6.029 0v8.399h4.988v-10.131c0-7.88-8.922-7.593-11.018-3.714v-2.155z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <footer className={`${isDark ? 'bg-[#051C2C] text-[#D1D9FF]' : 'bg-[#E5EAF5] text-[#6C7A92]'}`}>
      <div className="container mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-2 md:grid-cols-4">
          {footerSections.map((section) => (
            <div key={section.title} className="mb-4 sm:mb-0">
              <h3 className={`${isDark ? 'text-white' : 'text-[#1F2937]'} font-semibold text-base sm:text-lg mb-3 sm:mb-4`}>{section.title}</h3>
              <ul className="space-y-1.5 sm:space-y-2">
                {section.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      to={link.path}
                      className={`${isDark ? 'text-[#A5B9FF] hover:text-[#5FF9B4]' : 'text-[#6C7A92] hover:text-[#3A7AFF]'} text-sm transition-colors duration-300`}
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className={`border-t ${isDark ? 'border-[#333F50]' : 'border-[#DCE4F5]'} mt-10 pt-8`}>
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-6 md:mb-0">
              <Link to="/" className={`text-xl sm:text-2xl font-bold ${isDark ? 'text-white' : 'text-[#1F2937]'}`}>
                Menuby
              </Link>
              <p className={`mt-2 text-xs sm:text-sm ${isDark ? 'text-[#A5B9FF]' : 'text-[#6C7A92]'} max-w-md`}>
                Menuby © 2025 — Tu menú digital siempre disponible. Sin comisiones, sin complicaciones. Hecho con pasión en Colombia.
              </p>
            </div>
            <div className="flex space-x-4">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${isDark ? 'text-[#A5B9FF] hover:text-[#5FF9B4]' : 'text-[#6C7A92] hover:text-[#3A7AFF]'} transition-colors duration-300`}
                  aria-label={social.name}
                >
                  {getSocialIcon(social.icon)}
                </a>
              ))}
            </div>
          </div>

          <div className={`border-t ${isDark ? 'border-[#333F50]' : 'border-[#DCE4F5]'} mt-6 sm:mt-8 pt-6 sm:pt-8 flex flex-col md:flex-row justify-between items-center text-xs sm:text-sm ${isDark ? 'text-[#A5B9FF]' : 'text-[#6C7A92]'}`}>
            <p>© {currentYear} Menuby. Todos los derechos reservados.</p>
            <div className="mt-4 md:mt-0 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-6 items-center">
              <Link to="/privacy" className={`${isDark ? 'hover:text-[#5FF9B4]' : 'hover:text-[#3A7AFF]'} transition-colors duration-300`}>
                Política de privacidad
              </Link>
              <Link to="/terms" className={`${isDark ? 'hover:text-[#5FF9B4]' : 'hover:text-[#3A7AFF]'} transition-colors duration-300`}>
                Términos y condiciones
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 