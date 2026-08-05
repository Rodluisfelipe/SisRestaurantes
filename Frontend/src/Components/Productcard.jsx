import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { imageAt, imageSrcSet, CARD_SIZES, HERO_SIZES } from '../utils/imageCdn';
import ProductToppingsSelector from './ProductToppingsSelector';
import { isPromoActive, getEffectivePrice, promoMsLeft, formatCountdown } from '../utils/promo';
import ErrorBoundary from './ErrorBoundary';
import { useBusinessConfig } from "../Context/BusinessContext";
import BusinessClosedModal from './BusinessClosedModal';
import { useFlyToCart } from './FlyToCart';
import ProductPeekWrapper from './ProductPeekWrapper';
import { radii, shadows, productNameSize, alpha, TOUCH_TARGET } from '../utils/menuTokens';

/* ── SVG icons (stroke-based) ── */
const PCI = {
  plus: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  check: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>,
  sliders: (cls = 'w-3 h-3') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>,
  flame: (cls = 'w-3 h-3') => <svg className={cls} viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 23c-3.6 0-7-2.4-7-7 0-3.2 2.1-5.8 3.8-7.8L12 4l3.2 4.2C16.9 10.2 19 12.8 19 16c0 4.6-3.4 7-7 7zm0-15.5L9.8 10.4C8.4 12.1 7 14.1 7 16c0 3.3 2.2 5 5 5s5-1.7 5-5c0-1.9-1.4-3.9-2.8-5.6L12 7.5z"/></svg>,
  image: (cls = 'w-8 h-8') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>,
};

/* `priority` lo ponen las primeras tarjetas de la rejilla: esas se ven sin
   desplazar, así que cargarlas en diferido solo retrasa el primer pintado. */
function ProductCard({ product, addToCart, onToppingsOpen, onToppingsClose, subscriptionStatus, isHero = false, isViewOnly = false, priority = false }) {
  const [showToppings, setShowToppings] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showClosedModal, setShowClosedModal] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const { businessConfig, businessId, businessStatus } = useBusinessConfig();
  const flyToCart = useFlyToCart();

  const buttonColor = businessConfig?.theme?.buttonColor || '#f97316';
  const buttonTextColor = businessConfig?.theme?.buttonTextColor || '#ffffff';
  /* Menú V2: la card consume los tokens (--mb-*) y afina tipografía. Apagado
     el flag, todo queda EXACTAMENTE igual que hoy (criterio de aceptación:
     con menuV2:false el menú es pixel-idéntico). */
  const menuV2 = !!businessConfig?.features?.menuV2;
  const accentBg = menuV2 ? 'var(--mb-accent)' : `${buttonColor}e0`;
  const accentFg = menuV2 ? 'var(--mb-on-accent)' : buttonTextColor;
  const hasToppings = product.toppingGroups && product.toppingGroups.length > 0;
  const isOutOfStock = product.trackStock && product.stock !== null && product.stock !== undefined && product.stock <= 0;
  const isLowStock = product.trackStock && product.stock !== null && product.stock !== undefined && product.stock > 0 && product.stock <= (product.lowStockAlert || 5);
  const isDisabled = subscriptionStatus === 'suspended' || !businessStatus?.isOpen || isOutOfStock;
  const isFavorite = businessConfig?.reviewStats?.favoriteProductIds?.some(
    id => id === product._id || id?.toString() === product._id?.toString()
  );

  // Promo / Producto del día con cuenta regresiva. El tick (1s) solo corre si la
  // promo tiene fecha de fin, para no poner intervalos en todos los productos.
  const hasPromoEnds = !!product?.promo?.active && !!product?.promo?.endsAt;
  const [, setNowTick] = useState(0);
  useEffect(() => {
    if (!hasPromoEnds) return;
    const id = setInterval(() => setNowTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [hasPromoEnds]);
  const promoActive = isPromoActive(product);
  const effPrice = getEffectivePrice(product);
  const msLeft = promoMsLeft(product);

  const flashAdded = useCallback(() => {
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  }, []);

  const handleAddToCart = (productWithToppings) => {
    addToCart(productWithToppings);
    setShowToppings(false);
    onToppingsClose();
    flashAdded();
    document.body.classList.remove('modal-open');
    // Fly animation for toppings products — launch from center of viewport
    if (flyToCart?.triggerFly) {
      flyToCart.triggerFly({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        image: productWithToppings.image,
        color: buttonColor
      });
    }
  };

  const handleShowToppings = () => {
    if (isViewOnly) return;
    if (subscriptionStatus === 'suspended') return;
    if (!businessStatus?.isOpen) {
      setShowClosedModal(true);
      return;
    }
    setHasError(false);
    setShowToppings(true);
    onToppingsOpen();
    document.body.classList.add('modal-open');
  };

  const handleCloseToppings = () => {
    setShowToppings(false);
    onToppingsClose();
    document.body.classList.remove('modal-open');
  };

  const handleError = (error) => {
    console.error("Error en ProductCard:", error);
    setHasError(true);
    setShowToppings(false);
  };

  return (
    <ProductPeekWrapper product={product} buttonColor={buttonColor} buttonTextColor={buttonTextColor}>
      <motion.div
        onClick={() => {
          if (isViewOnly || subscriptionStatus === 'suspended') return;
          handleShowToppings();
        }}
        whileHover={!isDisabled ? { y: -3 } : {}}
        whileTap={!isDisabled ? { scale: 0.98 } : {}}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className={`group relative bg-white border border-slate-100 overflow-hidden transition-shadow duration-300 ${
          isOutOfStock ? 'opacity-50' : ''
        } ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        style={{ borderRadius: radii.card, boxShadow: shadows.card }}
      >
        {/* Product Image — ratio 4:3 (hero en panorámico) */}
        <div className={`relative overflow-hidden bg-slate-50 ${isHero ? 'aspect-[2/1]' : 'aspect-[4/3]'}`}>
          {product.image ? (
            <motion.img
              src={imageAt(product.image, isHero ? 800 : 400)}
              srcSet={imageSrcSet(product.image) || undefined}
              sizes={imageSrcSet(product.image) ? (isHero ? HERO_SIZES : CARD_SIZES) : undefined}
              alt={product.name}
              loading={priority ? 'eager' : 'lazy'}
              fetchpriority={priority ? 'high' : undefined}
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            /* Placeholder de marca: patrón con el logo del restaurante en su
               color, nunca un gris genérico. */
            <div
              className="w-full h-full flex items-center justify-center relative overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${alpha(buttonColor, 0.14)}, ${alpha(buttonColor, 0.05)})` }}
            >
              <div
                className="absolute inset-0 opacity-[0.07]"
                style={{
                  backgroundImage: `radial-gradient(${buttonColor} 1.5px, transparent 1.5px)`,
                  backgroundSize: '14px 14px',
                }}
              />
              {businessConfig?.logo ? (
                <img
                  src={businessConfig.logo}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover opacity-30"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <span className="relative opacity-25" style={{ color: buttonColor }}>
                  {PCI.image('w-10 h-10 sm:w-12 sm:h-12')}
                </span>
              )}
            </div>
          )}

          {/* Cinematic gradient overlay — always on for price/button readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent pointer-events-none" />

          {/* Promo / Producto del día con cuenta regresiva */}
          {promoActive && (
            <div className="absolute top-2 left-2 z-[3] flex flex-col items-start gap-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-bold text-white shadow-md bg-gradient-to-r from-red-500 to-orange-500">
                {PCI.flame('w-2.5 h-2.5')}
                <span className="truncate max-w-[110px]">{product.promo?.label || 'Producto del día'}</span>
              </span>
              {msLeft != null && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-black/70 text-white backdrop-blur-sm tabular-nums">
                  ⏱ {formatCountdown(msLeft)}
                </span>
              )}
            </div>
          )}

          {/* "Personalizable" badge for products with toppings */}
          {hasToppings && !promoActive && (
            <div className="absolute top-2 left-2">
              <span 
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-semibold shadow-sm bg-white/90 border border-white/50"
                style={{ color: buttonColor }}
              >
                {PCI.sliders('w-2.5 h-2.5 sm:w-3 sm:h-3')}
                <span className="hidden sm:inline">Personalizable</span>
              </span>
            </div>
          )}

          {/* "Favorito" — se oculta si ya hay otro badge, para no pasar de 2 */}
          {isFavorite && !isOutOfStock && !promoActive && (
            <div className="absolute top-2 right-2">
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm">
                {PCI.flame('w-2.5 h-2.5')}
                <span className="hidden sm:inline ml-0.5">Favorito</span>
              </span>
            </div>
          )}

          {/* Agotado: la card baja a 50% (arriba) y se marca, pero NO se tapa
              ni desaparece — evita la sensación de menú vacío. */}
          {isOutOfStock && (
            <div className="absolute top-2 right-2 z-[3]">
              <span className="bg-slate-900/85 text-white text-[10px] font-bold px-2.5 py-1 rounded-full tracking-wide">
                Agotado hoy
              </span>
            </div>
          )}
          {isLowStock && !isOutOfStock && !promoActive && (
            <div className="absolute top-2 left-2 z-[2]">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500 text-white shadow-sm">
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/></svg>
                Últimas {product.stock}
              </span>
            </div>
          )}

          {/* Price — overlaid on image bottom-left (con precio promo tachado si aplica) */}
          <div className="absolute bottom-2.5 left-3 z-[2] flex items-end gap-1.5">
            {promoActive && (
              <span className="text-white/70 line-through drop-shadow text-[11px] sm:text-xs mb-0.5">
                ${Number(product.price).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
              </span>
            )}
            {/* El precio nunca es tímido: 17px/800 tabular-nums */}
            <span
              className={`font-extrabold tabular-nums drop-shadow-lg ${promoActive ? 'text-amber-300' : 'text-white'} ${isHero ? 'text-xl sm:text-2xl' : menuV2 ? 'text-[15.5px]' : 'text-[17px]'}`}
              style={{ fontWeight: 800 }}
            >
              ${Number(promoActive ? effPrice : product.price).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>

          {/* Botón de agregar, flotando sobre la foto (oculto en modo solo-vista).
              Sin backdrop-blur: su fondo es opaco, así que el desenfoque no se
              veía y aun así obligaba al compositor a desenfocar la región bajo
              cada botón. Repetido en una rejilla de 29 tarjetas, era lo que
              hacía sentir pesado el menú en Android de gama media. */}
          {!isViewOnly && (
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                if (flyToCart?.triggerFly && !hasToppings) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  flyToCart.triggerFly({
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                    image: product.image,
                    color: buttonColor
                  });
                }
                handleShowToppings();
              }}
              whileTap={!isDisabled ? { scale: 0.85 } : {}}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className={`absolute bottom-2 right-2.5 z-[2] flex items-center justify-center shadow-lg transition-all duration-200 ${
                isDisabled ? 'opacity-40 cursor-not-allowed' : 'active:shadow-xl'
              }`}
              style={{
                width: TOUCH_TARGET,
                height: TOUCH_TARGET,
                borderRadius: radii.button,
                backgroundColor: isDisabled ? 'rgba(226,232,240,0.8)' : accentBg,
                color: accentFg,
                boxShadow: isDisabled ? undefined : `0 4px 16px ${alpha(buttonColor, 0.25)}`
              }}
              aria-label={isOutOfStock ? "Agotado" : isDisabled ? "No disponible" : "Agregar al carrito"}
              disabled={isDisabled}
            >
              {PCI.plus('w-4 h-4')}
            </motion.button>
          )}

          {/* "Added" feedback overlay */}
          <AnimatePresence>
            {justAdded && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10 pointer-events-none"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.3, 1] }}
                  transition={{ duration: 0.5 }}
                  className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl"
                  style={{ backgroundColor: buttonColor, color: buttonTextColor }}
                >
                  {PCI.check('w-6 h-6')}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Product Info — compact, name + description only */}
        <div className={isHero ? 'px-3 py-2.5 sm:px-4 sm:py-3' : 'px-3 py-2 sm:px-3.5'}>
          {/* El nombre no se trunca jamás: hasta 2 líneas y, si es muy largo,
              se reduce el tamaño antes que cortar con "…". */}
          <h3
            className={`font-semibold text-slate-800 leading-tight line-clamp-2 group-hover:text-slate-900 transition-colors ${productNameSize(product.name, { hero: isHero })}`}
            style={{ minHeight: '2.4em' }}
            title={product.name}
          >
            {product.name}
          </h3>
          {product.description && (
            <p className={`text-slate-400 leading-relaxed mt-0.5 line-clamp-1 ${isHero ? 'text-xs' : 'text-[10px] sm:text-[11px]'}`}>
              {product.description}
            </p>
          )}
        </div>
      </motion.div>

      {showToppings && (
        <div onClick={(e) => e.stopPropagation()} className="debugging-wrapper">
          <ProductToppingsSelector
            product={{
              ...product,
              price: getEffectivePrice(product), // cobra el precio promo si está activa
              toppingGroups: Array.isArray(product.toppingGroups) ? product.toppingGroups : []
            }}
            onAddToCart={(p) => {
              handleAddToCart(p);
            }}
            onClose={() => {
              handleCloseToppings();
            }}
          />
        </div>
      )}
      
      {hasError && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md mx-4">
            <h3 className="text-xl font-bold text-red-600 mb-4">Error</h3>
            <p className="mb-4">
              Ha ocurrido un problema al cargar las opciones del producto. Por favor, intenta de nuevo.
            </p>
            <div className="flex justify-end">
              <button
                onClick={handleCloseToppings}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de negocio cerrado */}
      <BusinessClosedModal
        isOpen={showClosedModal}
        onClose={() => setShowClosedModal(false)}
        businessStatus={businessStatus}
      />
    </ProductPeekWrapper>
  );
}


export default React.memo(ProductCard);
  