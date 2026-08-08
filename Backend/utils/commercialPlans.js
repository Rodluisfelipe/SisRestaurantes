const PLAN_IDS = {
  FREE: 'free',
  STARTER: 'starter',
  PRO: 'pro',
  PRO_MAX: 'pro_max'
};

const BILLING_CYCLES = {
  MONTHLY: 'monthly',
  ANNUAL: 'annual'
};

const COMMERCIAL_PLANS = {
  [PLAN_IDS.FREE]: {
    id: PLAN_IDS.FREE,
    name: 'Gratis',
    pricing: {
      monthly: 0,
      annualMonthly: 0
    },
    limits: {
      products: 20,
      categories: 5,
      monthlyOrders: 30,
      tables: 5,
      staffUsers: 1,
      deliveryZones: 1,
      coupons: 0,
      banners: 0,
      autoprintPrinters: 1
    },
    features: {
      inAppOrdering: true,
      pos: false,
      pushNotifications: false,
      toppings: false,
      kds: false,
      bookings: false,
      bookingReminders: false,
      loyaltyRewards: false,
      loyaltyTiers: false,
      abandonedCarts: false,
      advancedAnalytics: false,
      aiTools: false,
      popularSection: false,
      exclusiveEvents: false,
      premiumTutorials: false,
      earlyAccessFeatures: false
    }
  },
  [PLAN_IDS.STARTER]: {
    id: PLAN_IDS.STARTER,
    name: 'Starter',
    pricing: {
      monthly: 39900,
      annualMonthly: 34900
    },
    limits: {
      products: 60,
      categories: 12,
      monthlyOrders: 350,
      tables: 15,
      staffUsers: 3,
      deliveryZones: null,
      coupons: 3,
      banners: 1,
      autoprintPrinters: null
    },
    features: {
      inAppOrdering: true,
      pos: false,
      pushNotifications: true,
      toppings: true,
      kds: true,
      bookings: false,
      bookingReminders: false,
      loyaltyRewards: true,
      loyaltyTiers: false,
      abandonedCarts: false,
      advancedAnalytics: false,
      aiTools: false,
      popularSection: true,
      exclusiveEvents: false,
      premiumTutorials: false,
      earlyAccessFeatures: false
    }
  },
  [PLAN_IDS.PRO]: {
    id: PLAN_IDS.PRO,
    name: 'Pro',
    pricing: {
      monthly: 59900,
      annualMonthly: 49900
    },
    limits: {
      products: null,
      categories: null,
      monthlyOrders: null,
      tables: null,
      staffUsers: null,
      deliveryZones: null,
      coupons: null,
      banners: null,
      autoprintPrinters: null
    },
    features: {
      inAppOrdering: true,
      pos: true,
      pushNotifications: true,
      toppings: true,
      kds: true,
      bookings: true,
      bookingReminders: true,
      loyaltyRewards: true,
      loyaltyTiers: true,
      abandonedCarts: true,
      advancedAnalytics: true,
      aiTools: true,
      popularSection: true,
      exclusiveEvents: false,
      premiumTutorials: false,
      earlyAccessFeatures: false
    }
  },
  [PLAN_IDS.PRO_MAX]: {
    id: PLAN_IDS.PRO_MAX,
    name: 'Pro Max',
    pricing: {
      monthly: 89900,
      annualMonthly: 74900
    },
    limits: {
      products: null,
      categories: null,
      monthlyOrders: null,
      tables: null,
      staffUsers: null,
      deliveryZones: null,
      coupons: null,
      banners: null,
      autoprintPrinters: null
    },
    features: {
      inAppOrdering: true,
      pos: true,
      pushNotifications: true,
      toppings: true,
      kds: true,
      bookings: true,
      bookingReminders: true,
      loyaltyRewards: true,
      loyaltyTiers: true,
      abandonedCarts: true,
      advancedAnalytics: true,
      aiTools: true,
      popularSection: true,
      exclusiveEvents: true,
      premiumTutorials: true,
      earlyAccessFeatures: true
    }
  }
};

/**
 * Complementos que se venden aparte del plan.
 *
 * Un plan es una escalera: para tener `pos` hay que subir a Pro. Un complemento
 * es ortogonal: cualquier plan puede contratarlo sin cambiar de escalón. Por eso
 * no son un plan más ni un feature más — viven en su propia lista y se suman a
 * los features del plan cuando están activos.
 *
 * `feature` es la llave que termina viendo el resto del código, así que un
 * complemento puede activar algo que además exista en un plan superior sin que
 * nadie tenga que preguntar por ambos.
 */
const ADDONS = {
  whatsapp_inbox: {
    key: 'whatsapp_inbox',
    feature: 'whatsappInbox',
    name: 'WhatsApp del negocio',
    description: 'Conecta el número propio del negocio y recibe y responde sus chats desde el panel.',
    pricing: {
      monthly: 29900,
      annualMonthly: 24900
    }
  },
  whatsapp_agent: {
    key: 'whatsapp_agent',
    feature: 'whatsappAgent',
    name: 'Agente de IA en WhatsApp',
    description: 'Atiende los chats y arma el pedido solo; pasa a una persona cuando no sabe.',
    // Requiere la bandeja: sin número conectado no hay a quién atender.
    requiere: 'whatsapp_inbox',
    pricing: {
      monthly: 49900,
      annualMonthly: 41900
    }
  }
};

function getAddonConfig(addonKey) {
  return ADDONS[String(addonKey || '').trim()] || null;
}

/** Complementos vigentes hoy, ya normalizados. */
function getActiveAddonKeys(subscription, now = new Date()) {
  if (!Array.isArray(subscription?.addons)) return [];
  return subscription.addons
    .filter((a) => {
      if (!getAddonConfig(a?.key)) return false;
      if (a.status !== 'active') return false;
      // Sin fecha de fin se entiende vigente (cortesía, canje, prueba).
      return !a.periodEnd || new Date(a.periodEnd) >= now;
    })
    .map((a) => a.key);
}

/**
 * Features efectivos = los del plan + los que aportan los complementos activos.
 * El complemento solo suma; nunca apaga algo que el plan ya daba.
 */
function getEffectiveFeatures(planConfig, subscription, now = new Date()) {
  const features = { ...(planConfig?.features || {}) };
  const activos = getActiveAddonKeys(subscription, now);

  for (const key of activos) {
    const addon = getAddonConfig(key);
    /* Un complemento que depende de otro no sirve suelto: el agente de IA sin
       la bandeja no tiene número al que contestar, y darlo por activo haría
       que la pantalla ofrezca algo que no puede funcionar. */
    if (addon.requiere && !activos.includes(addon.requiere)) continue;
    features[addon.feature] = true;
  }
  return features;
}

function getAddonPrice(addonKey, billingCycle) {
  const addon = getAddonConfig(addonKey);
  if (!addon) return 0;
  const cycle = normalizeBillingCycle(billingCycle) || BILLING_CYCLES.MONTHLY;
  return cycle === BILLING_CYCLES.ANNUAL
    ? addon.pricing.annualMonthly * 12
    : addon.pricing.monthly;
}

const RESOURCE_META = {
  products: { label: 'productos' },
  categories: { label: 'categorías' },
  monthlyOrders: { label: 'pedidos por mes' },
  tables: { label: 'mesas' },
  staffUsers: { label: 'usuarios' },
  deliveryZones: { label: 'zonas de entrega' },
  coupons: { label: 'cupones' },
  banners: { label: 'banners' },
  autoprintPrinters: { label: 'impresoras autoprint' }
};

function normalizeCommercialPlan(plan) {
  if (!plan) return null;

  const value = String(plan).trim().toLowerCase();
  if (value === 'gratis') return PLAN_IDS.FREE;
  if (value === 'promax' || value === 'pro-max' || value === 'pro max') return PLAN_IDS.PRO_MAX;
  if (value === PLAN_IDS.FREE || value === PLAN_IDS.STARTER || value === PLAN_IDS.PRO || value === PLAN_IDS.PRO_MAX) {
    return value;
  }

  return null;
}

function normalizeBillingCycle(cycle) {
  if (!cycle) return null;

  const value = String(cycle).trim().toLowerCase();
  if (value === 'anual' || value === 'yearly') return BILLING_CYCLES.ANNUAL;
  if (value === BILLING_CYCLES.MONTHLY || value === BILLING_CYCLES.ANNUAL) {
    return value;
  }

  return null;
}

function getPlanConfig(plan) {
  const normalized = normalizeCommercialPlan(plan) || PLAN_IDS.FREE;
  return COMMERCIAL_PLANS[normalized];
}

function getCycleMonths(billingCycle) {
  const normalized = normalizeBillingCycle(billingCycle) || BILLING_CYCLES.MONTHLY;
  return normalized === BILLING_CYCLES.ANNUAL ? 12 : 1;
}

function getCyclePrice(plan, billingCycle) {
  const planConfig = getPlanConfig(plan);
  const normalizedCycle = normalizeBillingCycle(billingCycle) || BILLING_CYCLES.MONTHLY;

  if (planConfig.id === PLAN_IDS.FREE) return 0;

  if (normalizedCycle === BILLING_CYCLES.ANNUAL) {
    return planConfig.pricing.annualMonthly * 12;
  }

  return planConfig.pricing.monthly;
}

function getMonthlyEquivalent(plan, billingCycle) {
  const planConfig = getPlanConfig(plan);
  const normalizedCycle = normalizeBillingCycle(billingCycle) || BILLING_CYCLES.MONTHLY;

  if (planConfig.id === PLAN_IDS.FREE) return 0;

  return normalizedCycle === BILLING_CYCLES.ANNUAL
    ? planConfig.pricing.annualMonthly
    : planConfig.pricing.monthly;
}

function inferLegacyPlanTypeFromMonths(months) {
  if (months >= 12) return 'annual';
  if (months >= 6) return 'semiannual';
  if (months >= 3) return 'quarterly';
  return 'monthly';
}

function resolveSubscriptionCommercialPlan(subscription) {
  if (!subscription) return PLAN_IDS.FREE;

  const explicitPlan = normalizeCommercialPlan(subscription.commercialPlan);
  if (explicitPlan) return explicitPlan;

  if (subscription.isTrialPeriod) return PLAN_IDS.FREE;

  const hasLegacyPayment =
    (subscription.lastMonthsPurchased && subscription.lastMonthsPurchased > 0) ||
    (subscription.paymentStatus === 'paid' && !!subscription.lastPaymentAt);

  return hasLegacyPayment ? PLAN_IDS.PRO : PLAN_IDS.FREE;
}

function resolveSubscriptionBillingCycle(subscription) {
  if (!subscription) return BILLING_CYCLES.MONTHLY;

  const explicitCycle = normalizeBillingCycle(subscription.billingCycle);
  if (explicitCycle) return explicitCycle;

  if (subscription.planType === 'annual' || subscription.lastMonthsPurchased === 12) {
    return BILLING_CYCLES.ANNUAL;
  }

  return BILLING_CYCLES.MONTHLY;
}

function resolvePaymentSelection(input = {}) {
  const requestedPlan = normalizeCommercialPlan(input.commercialPlan || input.plan);
  const requestedCycle = normalizeBillingCycle(input.billingCycle || input.cycle);

  if (requestedPlan) {
    const cycle = requestedCycle || BILLING_CYCLES.MONTHLY;
    return {
      commercialPlan: requestedPlan,
      billingCycle: cycle,
      months: getCycleMonths(cycle),
      legacy: false
    };
  }

  // Legacy fallback: months -> Starter monthly/annual.
  const months = Number.parseInt(input.months, 10);
  if (Number.isInteger(months)) {
    const cycle = months >= 12 ? BILLING_CYCLES.ANNUAL : BILLING_CYCLES.MONTHLY;
    return {
      commercialPlan: PLAN_IDS.STARTER,
      billingCycle: cycle,
      months: getCycleMonths(cycle),
      legacy: true
    };
  }

  return null;
}

function isUnlimited(limitValue) {
  return limitValue === null || limitValue === undefined;
}

function isLimitReached(limitValue, currentCount) {
  if (isUnlimited(limitValue)) return false;
  return currentCount >= limitValue;
}

function getLimitExceededMessage(plan, resourceKey, limitValue) {
  const planConfig = getPlanConfig(plan);
  const resource = RESOURCE_META[resourceKey] || { label: resourceKey };

  return `Tu plan ${planConfig.name} permite hasta ${limitValue} ${resource.label}. Actualiza tu suscripción para continuar.`;
}

function getPaidPlanOptions() {
  const planIds = [PLAN_IDS.STARTER, PLAN_IDS.PRO, PLAN_IDS.PRO_MAX];
  const cycles = [BILLING_CYCLES.MONTHLY, BILLING_CYCLES.ANNUAL];

  const options = [];
  for (const planId of planIds) {
    for (const cycle of cycles) {
      const months = getCycleMonths(cycle);
      const basePrice = getCyclePrice(planId, cycle);
      options.push({
        commercialPlan: planId,
        billingCycle: cycle,
        months,
        label: `${getPlanConfig(planId).name} ${cycle === BILLING_CYCLES.ANNUAL ? 'Anual' : 'Mensual'}`,
        basePrice,
        total: basePrice,
        commission: 0,
        pricePerMonth: getMonthlyEquivalent(planId, cycle)
      });
    }
  }

  return options;
}

module.exports = {
  PLAN_IDS,
  BILLING_CYCLES,
  COMMERCIAL_PLANS,
  ADDONS,
  getAddonConfig,
  getActiveAddonKeys,
  getEffectiveFeatures,
  getAddonPrice,
  normalizeCommercialPlan,
  normalizeBillingCycle,
  getPlanConfig,
  getCycleMonths,
  getCyclePrice,
  getMonthlyEquivalent,
  inferLegacyPlanTypeFromMonths,
  resolveSubscriptionCommercialPlan,
  resolveSubscriptionBillingCycle,
  resolvePaymentSelection,
  isUnlimited,
  isLimitReached,
  getLimitExceededMessage,
  getPaidPlanOptions
};
