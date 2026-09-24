import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { imageAt, imageSrcSet, CARD_SIZES, HERO_SIZES } from '../utils/imageCdn';
import ProductToppingsSelector from './ProductToppingsSelector';
import { isPromoActive, getEffectivePrice, promoMsLeft, formatCountdown } from '../utils/promo';
import { useBusinessConfig } from "../Context/BusinessContext";
import BusinessClosedModal from './BusinessClosedModal';
import { useFlyToCart } from './FlyToCart';
import ProductPeekWrapper from './ProductPeekWrapper';
import { productNameSize } from '../utils/menuTokens';
import { leerPresentaciones } from '../utils/presentaciones';
import Presentaciones from './Presentaciones';
import { esTienda } from '../utils/tienda';
import { Flame, SlidersHorizontal, Check, ImageIcon, AlertTriangle } from 'lucide-react';
import { Boton, Insignia, Precio } from './ui';


/* `priority` lo ponen las primeras tarjetas de la rejilla: esas se ven sin
   desplazar, así que cargarlas en diferido solo retrasa el primer pintado. */
/* `insignia` va arriba a la izquierda de la foto (el "Destacado", la medalla
   de los más pedidos) y `meta` bajo el nombre, en lugar de la descripción
   ("12 pedidos esta semana"). Con eso las filas de destacados y más pedidos
   usan esta misma tarjeta en vez de copias propias que se desalineaban. */
function ProductCard({ product, addToCart, onToppingsOpen, onToppingsClose, subscriptionStatus, isHero = false, isViewOnly = false, priority = false, insignia = null, meta = null }) {
  const [showToppings, setShowToppings] = useState(false);
  const [showClosedModal, setShowClosedModal] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const { businessConfig, businessStatus } = useBusinessConfig();
  const flyToCart = useFlyToCart();

  const buttonColor = businessConfig?.theme?.buttonColor || '#f97316';
  const buttonTextColor = businessConfig?.theme?.buttonTextColor || '#ffffff';
  const hasToppings = product.toppingGroups && product.toppingGroups.length > 0;

  /* En una tienda la foto ES el producto, no el fondo de un precio: va
     cuadrada, limpia, sin degradado encima, y el precio y el botón bajan a la
     ficha. En un restaurante la card sigue idéntica a la de siempre. */
  const tienda = esTienda(businessConfig);

  /* Tiendas: con una sola referencia va el precio de siempre; con varias
     presentaciones el precio suelto no dice nada, así que arriba queda el
     "Desde" y el detalle se lista bajo el nombre. */
  const presentaciones = leerPresentaciones(product);

  /* Lo que queda es la suma de las tallas, no el contador del producto: con
     todas las tallas en cero la card decía "disponible" y el cliente solo se
     enteraba al abrir la ficha. Sigue mandando "Control de inventario": sin
     él, como en cualquier producto de MenuBy, se vende sin límite. */
  const existencias = presentaciones.hayVariantes ? presentaciones.stock : product.stock;
  const isOutOfStock = product.trackStock && existencias !== null && existencias !== undefined && existencias <= 0;
  const isLowStock = product.trackStock && existencias !== null && existencias !== undefined && existencias > 0 && existencias <= (product.lowStockAlert || 5);
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

  const varios = presentaciones.preciosDistintos;

  /* La segunda foto de la galería aparece al pasar el mouse, que es como se
     mira la ropa en cualquier catálogo. Solo en PC: en táctil no hay hover y
     bajarla sería peso muerto en datos móviles. */
  const segundaFoto = tienda && Array.isArray(product.images) && product.images.length > 1
    ? product.images[1]
    : null;

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
    setShowToppings(true);
    onToppingsOpen();
    document.body.classList.add('modal-open');
  };

  const handleCloseToppings = () => {
    setShowToppings(false);
    onToppingsClose();
    document.body.classList.remove('modal-open');
  };

  /* "Agregar" abre la ficha; todavía no agrega nada. La animación al carrito
     sale cuando de verdad entra (handleAddToCart), no al tocar aquí. */
  const agregar = (e) => {
    e.stopPropagation();
    handleShowToppings();
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
        className={`group relative h-full flex flex-col bg-superficie-tarjeta border border-linea rounded-tarjeta shadow-tarjeta overflow-hidden ${
          isOutOfStock ? 'opacity-50' : ''
        } ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {/* La foto, limpia: nada que leer encima salvo las etiquetas. */}
        <div className={`relative overflow-hidden ${tienda ? 'bg-white aspect-square' : `bg-superficie-2 ${isHero ? 'aspect-[2/1]' : 'aspect-[4/3]'}`}`}>
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
            /* Sin foto: el logo del negocio sobre su color, nunca un gris. */
            <div className="w-full h-full flex items-center justify-center bg-marca-suave">
              {businessConfig?.logo ? (
                <img
                  src={businessConfig.logo}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover opacity-40"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <ImageIcon className="w-10 h-10 text-marca opacity-40" strokeWidth={1.4} />
              )}
            </div>
          )}

          {segundaFoto && (
            <img
              src={imageAt(segundaFoto, 400)}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              className="hidden lg:block absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          )}

          {/* Arriba a la izquierda: lo que la fila quiera decir (medalla,
              "Destacado") y después lo del producto. Máximo dos etiquetas. */}
          <div className="absolute top-2 left-2 z-[3] flex flex-col items-start gap-1">
            {insignia}
            {promoActive ? (
              <>
                <Insignia tono="promo" icono={<Flame className="w-3 h-3" />} className="shadow-md max-w-[140px]">
                  <span className="truncate">{product.promo?.label || 'Producto del día'}</span>
                </Insignia>
                {msLeft !== null && msLeft !== undefined && <Insignia tono="oscuro" className="tabular-nums">⏱ {formatCountdown(msLeft)}</Insignia>}
              </>
            ) : isLowStock && !isOutOfStock ? (
              <Insignia tono="aviso" icono={<AlertTriangle className="w-3 h-3" />} className="shadow-sm">Últimas {existencias}</Insignia>
            ) : hasToppings && !insignia ? (
              <Insignia className="bg-white/95 text-tinta shadow-sm" icono={<SlidersHorizontal className="w-3 h-3 text-marca" />}>
                <span className="hidden sm:inline">Personalizable</span>
              </Insignia>
            ) : null}
          </div>

          {/* Arriba a la derecha: agotado manda; si no, "Favorito". */}
          {isOutOfStock ? (
            <Insignia tono="oscuro" className="absolute top-2 right-2 z-[3]">Agotado hoy</Insignia>
          ) : isFavorite && !promoActive ? (
            <Insignia tono="promo" className="absolute top-2 right-2 shadow-sm" icono={<Flame className="w-3 h-3" />}>
              <span className="hidden sm:inline">Favorito</span>
            </Insignia>
          ) : null}

          {/* La confirmación de que entró al carrito. */}
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
                  className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl bg-marca text-sobre-marca"
                >
                  <Check className="w-6 h-6" strokeWidth={3} />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nombre, descripción, PRECIO y AGREGAR. Así lo hacen los menús que
            mejor venden: se lee sin esfuerzo y el botón dice lo que hace. */}
        <div className={`flex-1 flex flex-col ${isHero ? 'p-3 sm:p-4' : 'p-3 sm:p-3.5'}`}>
          {/* El nombre no se corta con "…": hasta 2 líneas y, si es muy
              largo, se achica antes que cortarlo. */}
          <h3
            className={`font-extrabold text-tinta leading-tight line-clamp-2 ${productNameSize(product.name, { hero: isHero })}`}
            style={{ minHeight: '2.4em' }}
            title={product.name}
          >
            {product.name}
          </h3>
          {meta ? (
            <div className="mt-1">{meta}</div>
          ) : product.description ? (
            <p className={`text-tinta-2 leading-snug mt-1 line-clamp-2 ${isHero ? 'text-sm' : 'text-xs sm:text-[12.5px]'}`}>
              {product.description}
            </p>
          ) : null}
          <Presentaciones datos={presentaciones} />

          {/* El precio y el botón bajan al fondo: en una rejilla, todos los
              botones quedan alineados aunque las descripciones midan distinto. */}
          <div className="mt-auto pt-2">
            <Precio
              etiqueta
              desde={varios}
              valor={varios ? presentaciones.desde : (promoActive ? effPrice : product.price)}
              anterior={promoActive && !varios ? product.price : null}
              tamano={isHero ? 'lg' : 'md'}
            />
            {!isViewOnly && (
              <Boton
                bloque
                tamano="sm"
                mayusculas
                className="mt-2.5 h-10"
                onClick={agregar}
                disabled={isDisabled}
              >
                {isOutOfStock
                  ? 'Agotado'
                  : tienda && (presentaciones.varias || hasToppings) ? 'Elegir opciones' : 'Agregar'}
              </Boton>
            )}
          </div>
        </div>
      </motion.div>

      {showToppings && (
        <div onClick={(e) => e.stopPropagation()}>
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
  