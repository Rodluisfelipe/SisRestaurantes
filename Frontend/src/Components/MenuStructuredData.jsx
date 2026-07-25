import { useEffect } from 'react';

/**
 * Inyecta datos estructurados (JSON-LD) en el <head> para que Google muestre
 * tarjetas enriquecidas: nombre, estrella, precio, horario y menú.
 *
 * Schema: Restaurant / LocalBusiness + hasMenu + aggregateRating (reseñas internas,
 * que sí están visibles en la página → cumple las guías de Google).
 */

const SERVICE_TYPES = ['salon', 'spa', 'clinic', 'services'];
const DAY_SCHEMA = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

function buildOpeningHours(businessHours) {
  if (!businessHours) return undefined;
  const specs = [];
  for (const [key, day] of Object.entries(businessHours)) {
    if (day?.isOpen && DAY_SCHEMA[key]) {
      specs.push({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: `https://schema.org/${DAY_SCHEMA[key]}`,
        opens: day.openTime || '00:00',
        closes: day.closeTime || '23:59',
      });
    }
  }
  return specs.length ? specs : undefined;
}

function buildMenu(products, categories, currency) {
  if (!Array.isArray(products) || !Array.isArray(categories)) return undefined;
  const active = products.filter(p => p && p.active !== false);
  const sections = [];
  let itemCount = 0;
  const sorted = [...categories].sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));

  for (const cat of sorted) {
    const items = active
      .filter(p => p.category === cat._id)
      .slice(0, 30)
      .map(p => {
        const item = { '@type': 'MenuItem', name: p.name };
        if (p.description) item.description = String(p.description).slice(0, 300);
        if (p.image) item.image = p.image;
        if (typeof p.price === 'number' && p.price > 0) {
          item.offers = { '@type': 'Offer', price: String(p.price), priceCurrency: currency };
        }
        return item;
      });
    if (items.length) {
      sections.push({ '@type': 'MenuSection', name: cat.name, hasMenuItem: items });
      itemCount += items.length;
    }
    if (itemCount >= 120) break; // mantener el JSON en tamaño razonable
  }
  return sections.length ? { '@type': 'Menu', hasMenuSection: sections } : undefined;
}

function priceRangeSymbol(products) {
  const prices = (products || []).map(p => p?.price).filter(n => typeof n === 'number' && n > 0);
  if (!prices.length) return undefined;
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  // Heurística para pesos colombianos
  if (avg < 20000) return '$';
  if (avg < 45000) return '$$';
  return '$$$';
}

function buildSchema(businessConfig, products, categories) {
  if (!businessConfig?.businessName) return null;
  const isService = SERVICE_TYPES.includes(businessConfig.businessType);
  const currency = businessConfig.currency || 'COP';
  const url = typeof window !== 'undefined' ? window.location.href.split('?')[0] : undefined;

  const data = {
    '@context': 'https://schema.org',
    '@type': isService ? 'LocalBusiness' : 'Restaurant',
    name: businessConfig.businessName,
  };
  if (url) data.url = url;

  const images = [];
  if (businessConfig.logo) images.push(businessConfig.logo);
  if (businessConfig.coverImage) images.push(businessConfig.coverImage);
  if (images.length) data.image = images;

  if (businessConfig.whatsappNumber) {
    const cc = businessConfig.phoneCountryCode || '';
    data.telephone = `${cc}${businessConfig.whatsappNumber}`.trim();
  }

  if (businessConfig.address || businessConfig.location?.address) {
    data.address = {
      '@type': 'PostalAddress',
      streetAddress: businessConfig.address || businessConfig.location?.address,
      addressCountry: 'CO',
    };
  }

  const lat = businessConfig.location?.coordinates?.lat;
  const lng = businessConfig.location?.coordinates?.lng;
  if (typeof lat === 'number' && typeof lng === 'number') {
    data.geo = { '@type': 'GeoCoordinates', latitude: lat, longitude: lng };
  }

  const hours = buildOpeningHours(businessConfig.businessHours);
  if (hours) data.openingHoursSpecification = hours;

  if (!isService) {
    const pr = priceRangeSymbol(products);
    if (pr) data.priceRange = pr;
    data.servesCuisine = businessConfig.businessType || 'Restaurant';
  }

  // aggregateRating: solo reseñas internas (visibles en la página) para cumplir guías
  const rs = businessConfig.reviewStats;
  if (rs && rs.totalReviews > 0 && rs.averageRating > 0) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(rs.averageRating).toFixed(1),
      reviewCount: rs.totalReviews,
      bestRating: 5,
      worstRating: 1,
    };
  }

  const menu = buildMenu(products, categories, currency);
  if (menu) data.hasMenu = menu;

  return data;
}

const MenuStructuredData = ({ businessConfig, products, categories }) => {
  useEffect(() => {
    const ID = 'menu-jsonld';
    const existing = document.getElementById(ID);
    const schema = buildSchema(businessConfig, products, categories);

    if (!schema) {
      if (existing) existing.remove();
      return;
    }

    let script = existing;
    if (!script) {
      script = document.createElement('script');
      script.id = ID;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(schema);

    return () => {
      const el = document.getElementById(ID);
      if (el) el.remove();
    };
  }, [businessConfig, products, categories]);

  return null;
};

export default MenuStructuredData;
