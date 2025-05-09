export function getBusinessSlug() {
  if (typeof window === "undefined") return null;

  const { hostname, pathname } = window.location;
  let slug = null;

  // En Vercel: usar el pathname
  // Ej: tu-logo-aqui.vercel.app/tu-logo-aqui
  if (hostname.endsWith(".vercel.app")) {
    // Si estamos en la raíz, extraer el slug del hostname
    if (pathname === "/") {
      slug = hostname.split(".")[0];
    } else {
      // Si no, usar el pathname
      const match = pathname.match(/^\/([^/]+)/);
      if (match) {
        slug = match[1];
      }
    }
  } else {
    // En local: ruta /<slug>
    // Ej: localhost:3000/tacos
    const match = pathname.match(/^\/([^/]+)/);
    if (match) {
      slug = match[1];
    }
  }

  console.log('getBusinessSlug - Extracted slug:', slug, 'from pathname:', pathname, 'hostname:', hostname);
  return slug;
}

import { getBusinessBySlug } from '../services/api';

export async function getBusinessIdFromSlug() {
  const slug = getBusinessSlug();
  console.log('getBusinessIdFromSlug - Starting with slug:', slug);
  
  if (!slug) {
    console.log('getBusinessIdFromSlug - No slug found');
    return null;
  }
  
  try {
    console.log('getBusinessIdFromSlug - Fetching business with slug:', slug);
    const business = await getBusinessBySlug(slug);
    
    if (!business || !business._id) {
      console.error('getBusinessIdFromSlug - No valid business found for slug:', slug);
      return null;
    }
    
    console.log('getBusinessIdFromSlug - Found businessId:', business._id, 'for slug:', slug);
    return business._id;
  } catch (error) {
    console.error('getBusinessIdFromSlug - Error fetching business by slug:', slug, error);
    return null;
  }
} 