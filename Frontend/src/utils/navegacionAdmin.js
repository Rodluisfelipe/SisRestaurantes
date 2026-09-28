import {
  FaClipboardList, FaHamburger, FaSortAmountDown, FaFolderOpen, FaCheese, FaUsers,
  FaTicketAlt, FaChair, FaMapMarkedAlt, FaMotorcycle, FaUndo, FaCheckCircle, FaBullhorn,
  FaWhatsapp, FaCreditCard, FaPalette, FaMapMarkerAlt, FaLock, FaShoppingBag, FaStore,
  FaTools, FaCog, FaMoneyBillWave, FaStar, FaGift, FaPrint, FaCashRegister, FaCalendarAlt,
  FaShareAlt, FaCodeBranch, FaLink, FaCalculator, FaBoxOpen, FaChrome, FaChartLine,
  FaHandHoldingUsd, FaTruck, FaUserClock, FaImages, FaChartBar,
} from 'react-icons/fa';
import { esTienda } from './tienda';
import { SECCIONES_OCULTAS } from './seccionesOcultas';

/**
 * El menú del panel, UNA sola vez para escritorio y celular.
 *
 * Antes cada uno tenía su lista y no coincidían: algo estaba en el menú de
 * la PC y no en el del celular, o con otro nombre en otro grupo.
 *
 * El orden sale del uso real (sep 2026, 8 negocios activos): el 89 % de los
 * pedidos se crean desde el panel, y lo que más se toca después es editar,
 * pausar y crear productos. Arriba va lo de todos los días; lo que casi nadie
 * usa queda en "Más herramientas", plegado al final. No se borra nada.
 */

/** Las pestañas que ve el personal (rol staff). */
export const PESTANAS_PERSONAL = ['orders', 'completed_orders', 'cash-closings', 'change-password'];

export function seccionesDelPanel({ businessConfig, esPersonal = false, pedidosPendientes = 0, whatsappSinLeer = 0 }) {
  const servicio = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);
  const hotel = businessConfig?.businessType === 'hotel';
  const tienda = esTienda(businessConfig);
  const conPos = !!businessConfig?.features?.posBetaEnabled;
  const conAgenda = !!businessConfig?.enableBookings;
  const conDomicilios = !servicio && !hotel;

  const secciones = [
    {
      id: 'dia',
      label: 'Día a día',
      color: 'bg-red-500',
      items: [
        { id: 'orders', label: servicio ? 'Citas' : 'Pedidos', Icon: servicio ? FaCalendarAlt : FaClipboardList, badge: pedidosPendientes },
        { id: 'cajas', label: 'Caja', Icon: FaCashRegister },
        { id: 'completed_orders', label: servicio ? 'Citas atendidas' : 'Pedidos terminados', Icon: FaCheckCircle },
        ...(conPos ? [{ id: 'cash-closings', label: 'Cierres de caja', Icon: FaCashRegister }] : []),
        ...(conAgenda ? [{ id: 'bookings', label: 'Agenda', Icon: FaCalendarAlt }] : []),
        ...(tienda ? [{ id: 'devoluciones', label: 'Devoluciones', Icon: FaUndo }] : []),
        ...(conDomicilios ? [{ id: 'delivery', label: 'Domiciliarios', Icon: FaMotorcycle }] : []),
      ],
    },
    {
      id: 'menu',
      label: servicio ? 'Mis servicios' : 'Mi menú',
      color: 'bg-orange-500',
      items: [
        { id: 'products', label: servicio ? 'Servicios' : 'Productos', Icon: servicio ? FaTools : FaHamburger },
        { id: 'categories', label: 'Categorías', Icon: FaFolderOpen },
        { id: 'toppings', label: servicio ? 'Opciones' : tienda ? 'Complementos' : 'Extras y adiciones', Icon: servicio ? FaCog : FaCheese },
        { id: 'inventory', label: 'Inventario', Icon: FaBoxOpen },
        { id: 'product-order', label: 'Orden en el menú', Icon: FaSortAmountDown },
      ],
    },
    {
      id: 'clientes',
      label: 'Clientes',
      color: 'bg-cyan-500',
      items: [
        { id: 'customers', label: hotel ? 'Huéspedes' : 'Clientes', Icon: FaUsers },
        { id: 'whatsapp-inbox', label: 'Chats WhatsApp', Icon: FaWhatsapp, badge: whatsappSinLeer },
        { id: 'credito', label: 'Cuentas por cobrar', Icon: FaHandHoldingUsd },
        { id: 'reviews', label: 'Reseñas', Icon: FaStar },
        { id: 'loyalty', label: 'Puntos y premios', Icon: FaGift },
        { id: 'coupons', label: 'Cupones', Icon: FaTicketAlt },
      ],
    },
    {
      id: 'dinero',
      label: 'Cuentas',
      color: 'bg-emerald-600',
      items: [
        { id: 'reports', label: 'Ventas y estadísticas', Icon: FaChartBar },
        { id: 'rentabilidad', label: 'Ganancias', Icon: FaChartLine },
        { id: 'monthly-closing', label: 'Cierre del mes', Icon: FaCalendarAlt },
      ],
    },
    {
      id: 'negocio',
      label: 'Mi negocio',
      color: 'bg-slate-500',
      items: [
        { id: 'business', label: 'Datos y horario', Icon: FaStore },
        { id: 'payment-config', label: 'Formas de pago', Icon: FaMoneyBillWave },
        ...(conDomicilios ? [{ id: 'delivery-zones', label: 'Zonas de domicilio', Icon: FaMapMarkedAlt }] : []),
        ...(!servicio && !tienda ? [{ id: 'tables', label: hotel ? 'Habitaciones' : 'Mesas y QR', Icon: FaChair }] : []),
        { id: 'printer', label: 'Impresoras', Icon: FaPrint },
        { id: 'team', label: 'Equipo y asistencia', Icon: FaUserClock },
        { id: 'theme', label: 'Colores del menú', Icon: FaPalette },
        { id: 'location', label: 'Ubicación', Icon: FaMapMarkerAlt },
        { id: 'subscription', label: 'Mi plan', Icon: FaCreditCard },
        { id: 'change-password', label: 'Contraseña', Icon: FaLock },
      ],
    },
    {
      id: 'mas',
      label: 'Más herramientas',
      color: 'bg-violet-500',
      plegada: true,
      items: [
        { id: 'popups', label: 'Anuncios del menú', Icon: FaBullhorn },
        { id: 'catalog', label: 'Banners', Icon: FaImages },
        { id: 'whatsapp', label: 'Mensaje de WhatsApp del menú', Icon: FaWhatsapp },
        { id: 'sales-tracking', label: 'De dónde llegan los pedidos', Icon: FaChartLine },
        { id: 'wa-campaign', label: 'Campañas por WhatsApp', Icon: FaWhatsapp },
        { id: 'referrals', label: 'Referidos', Icon: FaShareAlt },
        { id: 'compras', label: 'Compras', Icon: FaTruck },
        { id: 'supplier-orders', label: businessConfig?.isSupplier ? 'Pedidos B2B' : 'Pedidos a proveedores', Icon: FaClipboardList },
        { id: 'marketplace', label: 'Marketplace', Icon: FaShoppingBag },
        { id: 'crew', label: 'Personal por turnos (Crew)', Icon: FaUsers },
        { id: 'tools', label: 'Calculadoras', Icon: FaCalculator },
        { id: 'branches', label: 'Sucursales', Icon: FaCodeBranch },
        { id: 'milink', label: 'Mi link', Icon: FaLink },
        { id: 'portafolio', label: 'Mi página de negocios', Icon: FaLink },
        { id: 'extension', label: 'Extensión Chrome', Icon: FaChrome },
      ],
    },
  ];

  return secciones
    .map((s) => ({
      ...s,
      items: s.items
        .filter((i) => !SECCIONES_OCULTAS.has(i.id))
        .filter((i) => !esPersonal || PESTANAS_PERSONAL.includes(i.id)),
    }))
    .filter((s) => s.items.length > 0);
}
