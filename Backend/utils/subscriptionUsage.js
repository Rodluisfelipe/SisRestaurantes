const Product = require('../Models/Product');
const Category = require('../Models/Category');
const Order = require('../Models/Order');
const CompletedOrder = require('../Models/CompletedOrder');
const Table = require('../Models/Table');
const DeliveryZone = require('../Models/DeliveryZone');
const BusinessCoupon = require('../Models/BusinessCoupon');
const Banner = require('../Models/Banner');
const Admin = require('../Models/Admin');
const { BANNER_STATUS } = require('../utils/constants');
const { startOfMonthCOL, endOfMonthCOL } = require('../utils/timezone');

const RESOURCE_ORDER = [
  'products',
  'categories',
  'monthlyOrders',
  'tables',
  'staffUsers',
  'deliveryZones',
  'coupons',
  'banners'
];

const RESOURCE_LABELS = {
  products: 'Productos',
  categories: 'Categorias',
  monthlyOrders: 'Pedidos del mes',
  tables: 'Mesas',
  staffUsers: 'Usuarios del equipo',
  deliveryZones: 'Zonas de entrega',
  coupons: 'Cupones',
  banners: 'Banners'
};

async function getBusinessResourceUsage(businessId) {
  const monthStart = startOfMonthCOL();
  const monthEnd = endOfMonthCOL();

  const [
    products,
    categories,
    activeOrdersMonth,
    completedOrdersMonth,
    tables,
    staffUsers,
    deliveryZones,
    coupons,
    banners
  ] = await Promise.all([
    Product.countDocuments({ businessId }),
    Category.countDocuments({ businessId }),
    Order.countDocuments({ businessId, createdAt: { $gte: monthStart, $lt: monthEnd } }),
    CompletedOrder.countDocuments({ businessId, createdAt: { $gte: monthStart, $lt: monthEnd } }),
    Table.countDocuments({ businessId, isActive: true }),
    Admin.countDocuments({ businessId, role: { $in: ['admin', 'staff', 'manager'] } }),
    DeliveryZone.countDocuments({ businessId, isActive: true }),
    BusinessCoupon.countDocuments({ businessId, isActive: true }),
    Banner.countDocuments({ businessId, status: { $ne: BANNER_STATUS.REJECTED } })
  ]);

  return {
    products,
    categories,
    monthlyOrders: activeOrdersMonth + completedOrdersMonth,
    tables,
    staffUsers,
    deliveryZones,
    coupons,
    banners
  };
}

function mapUsageWithLimits(planConfig, usageValues) {
  const limits = planConfig?.limits || {};
  const usage = {};

  for (const key of RESOURCE_ORDER) {
    const used = usageValues[key] || 0;
    const rawLimit = limits[key];
    const unlimited = rawLimit === null || rawLimit === undefined;
    const limit = unlimited ? null : rawLimit;
    const remaining = unlimited ? null : Math.max(0, limit - used);
    const percent = unlimited
      ? null
      : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));

    let status = 'ok';
    if (!unlimited && used >= limit) {
      status = 'limit';
    } else if (!unlimited && used >= Math.floor(limit * 0.8)) {
      status = 'warning';
    }

    usage[key] = {
      key,
      label: RESOURCE_LABELS[key] || key,
      used,
      limit,
      unlimited,
      remaining,
      percent,
      status
    };
  }

  return usage;
}

module.exports = {
  RESOURCE_ORDER,
  getBusinessResourceUsage,
  mapUsageWithLimits
};
