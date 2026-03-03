import React from 'react';
import { motion } from 'framer-motion';
import useLandingSEO from '../../hooks/useLandingSEO';

const CONTACT_METHODS = [
  {
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
    ),
    title: 'WhatsApp',
    detail: '+57 302 818 1520',
    sub: 'Respuesta inmediata',
    href: 'https://wa.me/573028181520?text=Hola%2C%20quiero%20saber%20m%C3%A1s%20sobre%20Menuby',
    color: 'bg-green-50 text-green-600',
    primary: true,
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
    ),
    title: 'Email',
    detail: 'administrador@menuby.tech',
    sub: 'Respuesta en menos de 24h',
    href: 'mailto:administrador@menuby.tech',
    color: 'bg-red-50 text-red-600',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
    ),
    title: 'Teléfono',
    detail: '+57 302 818 1520',
    sub: 'Lun-Vie 9AM - 6PM',
    href: 'tel:+573028181520',
    color: 'bg-blue-50 text-blue-600',
  },
];

const FAQ = [
  { q: '¿Cuánto tiempo toma configurar mi menú?', a: 'Solo 5 minutos para el registro. Tu menú completo puede estar listo en menos de una hora.' },
  { q: '¿Hay costo de configuración?', a: 'No, la configuración es completamente gratuita. Solo pagas $30.000/mes.' },
  { q: '¿Puedo cambiar mi menú cuando quiera?', a: 'Sí, puedes actualizar tu menú en tiempo real desde cualquier dispositivo.' },
  { q: '¿Ofrecen soporte técnico?', a: 'Sí, por WhatsApp con respuesta inmediata durante horario laboral y email 24/7.' },
];

const Contact = () => {
  useLandingSEO({
    title: 'Contacto | Menuby - Menú Digital para Restaurantes en Colombia',
    description: 'Contáctanos por WhatsApp, email o teléfono. Soporte inmediato para configurar tu menú digital. +57 302 818 1520.',
    canonical: '/contact',
    keywords: 'contacto menuby, soporte menú digital, menú digital Colombia contacto',
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="pt-28 pb-16 bg-gradient-to-br from-white via-red-50/40 to-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-4">Contáctanos</h1>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              ¿Tienes preguntas o necesitas ayuda? Estamos aquí para ti.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact Methods */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-5">
            {CONTACT_METHODS.map((m, i) => (
              <motion.a
                key={i}
                href={m.href}
                target={m.href.startsWith('http') ? '_blank' : undefined}
                rel={m.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`block rounded-2xl p-6 border transition-all hover:shadow-lg hover:-translate-y-0.5 ${
                  m.primary ? 'border-green-200 bg-green-50/30 hover:shadow-green-100' : 'border-gray-200 bg-white hover:shadow-gray-100'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl ${m.color} flex items-center justify-center mb-4`}>
                  {m.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">{m.title}</h3>
                <p className="text-sm text-gray-700 font-medium">{m.detail}</p>
                <p className="text-xs text-gray-400 mt-1">{m.sub}</p>
              </motion.a>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl font-extrabold text-gray-900 text-center mb-10">Preguntas Frecuentes</h2>
          <div className="space-y-4">
            {FAQ.map((item, i) => (
              <div key={i} className="bg-white rounded-xl p-5 border border-gray-200">
                <h3 className="text-sm font-bold text-gray-800 mb-2">{item.q}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
