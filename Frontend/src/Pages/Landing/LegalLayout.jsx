/**
 * Marco común de las páginas legales.
 *
 * Existen porque el registro obliga a aceptar términos y política de privacidad
 * y ninguno de los dos existía: /terms mostraba la página de inicio y /privacy
 * no tenía ruta. Además Meta exige una URL de política de privacidad real para
 * aprobar la conexión de números de WhatsApp de terceros, y un revisor que abre
 * la landing rechaza la solicitud.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import useLandingSEO from '../../hooks/useLandingSEO';

export const EMPRESA = {
  nombre: 'MenuBy',
  sitio: 'https://menuby.tech',
  correo: 'administrador@menuby.tech',
  telefono: '+57 302 818 1520',
  pais: 'Colombia',
};

/** Fecha de la última revisión de los documentos. */
export const ACTUALIZADO = '9 de agosto de 2026';

export function Seccion({ titulo, children }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-slate-800 mb-3">{titulo}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

export function Tabla({ cabeceras, filas }) {
  return (
    /* Se desplaza dentro de su caja: en un celular, una tabla ancha no puede
       hacer que la página entera se mueva de lado. */
    <div className="overflow-x-auto -mx-1 my-4">
      <table className="min-w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
        <thead className="bg-slate-50">
          <tr>
            {cabeceras.map((h) => (
              <th key={h} className="text-left font-semibold text-slate-700 px-3 py-2 border-b border-slate-200">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i} className={i % 2 ? 'bg-slate-50/50' : ''}>
              {fila.map((celda, j) => (
                <td key={j} className="px-3 py-2 align-top text-slate-600 border-b border-slate-100">{celda}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LegalLayout({ titulo, descripcion, ruta, children }) {
  useLandingSEO({
    title: `${titulo} | ${EMPRESA.nombre}`,
    description: descripcion,
    // El hook antepone el dominio: acá va solo la ruta.
    canonical: ruta,
  });

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link to="/" className="text-lg font-extrabold text-slate-800">MenuBy</Link>
          <div className="flex gap-4 text-sm">
            <Link to="/privacidad" className="text-slate-500 hover:text-slate-800">Privacidad</Link>
            <Link to="/terminos" className="text-slate-500 hover:text-slate-800">Términos</Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-10">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{titulo}</h1>
        <p className="text-sm text-slate-400 mt-1 mb-8">Última actualización: {ACTUALIZADO}</p>
        {children}

        <div className="mt-12 pt-6 border-t border-slate-100 text-sm text-slate-500">
          <p className="font-semibold text-slate-700 mb-1">¿Dudas sobre este documento?</p>
          <p>
            Escríbenos a{' '}
            <a href={`mailto:${EMPRESA.correo}`} className="text-emerald-600 hover:underline">{EMPRESA.correo}</a>
            {' '}o al {EMPRESA.telefono}.
          </p>
        </div>
      </main>
    </div>
  );
}
