const mongoose = require('mongoose');

// Models
const BusinessConfig = require('./Models/BusinessConfig');
const Subscription = require('./Models/Subscription');
const Product = require('./Models/Product');
const Category = require('./Models/Category');
const Order = require('./Models/Order');
const CompletedOrder = require('./Models/CompletedOrder');
const Table = require('./Models/Table');
const Admin = require('./Models/Admin');
const DeliveryZone = require('./Models/DeliveryZone');
const ToppingGroup = require('./Models/ToppingGroup');
const Customer = require('./Models/Customer');

// Plan limits for comparison
const PLANS = {
  free:    { name: 'Gratis',   products: 20, categories: 5,  monthlyOrders: 30,  tables: 5,  staff: 1, zones: 1, price: 0 },
  starter: { name: 'Starter',  products: 60, categories: 12, monthlyOrders: 350, tables: 15, staff: 3, zones: 3, price: 39900 },
  pro:     { name: 'Pro',      products: null, categories: null, monthlyOrders: null, tables: null, staff: null, zones: null, price: 59900 },
  pro_max: { name: 'Pro Max',  products: null, categories: null, monthlyOrders: null, tables: null, staff: null, zones: null, price: 89900 }
};

async function analyze() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const businesses = await BusinessConfig.find({}).lean();
    console.log(`=== TOTAL NEGOCIOS: ${businesses.length} ===\n`);

    // Get current month range (Colombia timezone)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const results = [];

    for (const biz of businesses) {
      const bizId = biz._id;

      // Parallel queries
      const [
        subscription,
        productCount,
        categoryCount,
        activeOrders,
        completedOrders,
        monthActiveOrders,
        monthCompletedOrders,
        tableCount,
        staffCount,
        zoneCount,
        toppingCount,
        customerCount,
        totalCompletedAllTime
      ] = await Promise.all([
        Subscription.findOne({ businessId: bizId }).lean(),
        Product.countDocuments({ businessId: bizId }),
        Category.countDocuments({ businessId: bizId }),
        Order.countDocuments({ businessId: bizId }),
        CompletedOrder.countDocuments({ businessId: bizId }),
        Order.countDocuments({ businessId: bizId, createdAt: { $gte: monthStart, $lt: monthEnd } }),
        CompletedOrder.countDocuments({ businessId: bizId, createdAt: { $gte: monthStart, $lt: monthEnd } }),
        Table.countDocuments({ businessId: bizId }),
        Admin.countDocuments({ businessId: bizId }),
        DeliveryZone.countDocuments({ businessId: bizId }),
        ToppingGroup.countDocuments({ businessId: bizId }),
        Customer.countDocuments({ businessId: bizId }),
        CompletedOrder.countDocuments({ businessId: bizId })
      ]);

      const monthOrders = monthActiveOrders + monthCompletedOrders;
      const totalOrders = activeOrders + completedOrders;

      // Determine current plan
      const currentPlan = subscription?.commercialPlan || 'free';
      const subStatus = subscription ? subscription.status : 'none';
      const paymentStatus = subscription ? subscription.paymentStatus : 'none';
      const periodEnd = subscription?.periodEnd || subscription?.endDate;
      const isActive = subscription ? (subscription.isActive !== false) : false;

      // Determine minimum plan needed based on actual usage
      let minPlanNeeded = 'free';
      const usage = { products: productCount, categories: categoryCount, monthlyOrders: monthOrders, tables: tableCount, staff: staffCount, zones: zoneCount };

      // Check against each plan
      for (const planId of ['free', 'starter']) {
        const plan = PLANS[planId];
        let fits = true;
        if (plan.products !== null && usage.products > plan.products) fits = false;
        if (plan.categories !== null && usage.categories > plan.categories) fits = false;
        if (plan.monthlyOrders !== null && usage.monthlyOrders > plan.monthlyOrders) fits = false;
        if (plan.tables !== null && usage.tables > plan.tables) fits = false;
        if (plan.staff !== null && usage.staff > plan.staff) fits = false;
        if (plan.zones !== null && usage.zones > plan.zones) fits = false;

        if (fits && planId === 'free') { minPlanNeeded = 'free'; break; }
        if (fits && planId === 'starter') { minPlanNeeded = 'starter'; break; }
        if (!fits && planId === 'starter') { minPlanNeeded = 'pro'; }
      }

      // Check what limits would be exceeded
      const exceeds = [];
      const assignedPlan = PLANS[currentPlan] || PLANS.free;
      for (const [key, limit] of Object.entries({ products: assignedPlan.products, categories: assignedPlan.categories, monthlyOrders: assignedPlan.monthlyOrders, tables: assignedPlan.tables, staff: assignedPlan.staff, zones: assignedPlan.zones })) {
        if (limit !== null && usage[key] > limit) {
          exceeds.push(`${key}: ${usage[key]}/${limit}`);
        }
      }

      // Risk assessment
      let risk = 'NONE';
      if (currentPlan === 'free' && minPlanNeeded !== 'free') risk = 'LOW - Exceeds free limits';
      if (exceeds.length > 0) risk = 'HIGH - Exceeds CURRENT plan limits';

      results.push({
        name: biz.businessName || 'Sin nombre',
        id: bizId.toString().slice(-6),
        currentPlan,
        subStatus,
        paymentStatus,
        isActive,
        periodEnd: periodEnd ? periodEnd.toISOString().split('T')[0] : 'N/A',
        products: productCount,
        categories: categoryCount,
        monthOrders: monthOrders,
        totalOrders,
        totalCompleted: totalCompletedAllTime,
        tables: tableCount,
        staff: staffCount,
        zones: zoneCount,
        toppings: toppingCount,
        customers: customerCount,
        minPlanNeeded,
        exceeds: exceeds.length > 0 ? exceeds.join(', ') : 'ninguno',
        risk,
        hasToppings: toppingCount > 0
      });
    }

    // Sort by risk (HIGH first), then by totalOrders desc
    results.sort((a, b) => {
      if (a.risk.startsWith('HIGH') && !b.risk.startsWith('HIGH')) return -1;
      if (!a.risk.startsWith('HIGH') && b.risk.startsWith('HIGH')) return 1;
      return b.totalOrders - a.totalOrders;
    });

    // Print results
    console.log('╔══════════════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                         ANALISIS DE NEGOCIOS - MIGRACION DE PLANES                     ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════════════════════╝\n');

    for (const r of results) {
      console.log(`┌─── ${r.name} (ID: ...${r.id}) ───`);
      console.log(`│ Plan actual:     ${r.currentPlan.toUpperCase()} | Status: ${r.subStatus} | Payment: ${r.paymentStatus} | Active: ${r.isActive}`);
      console.log(`│ Vence:           ${r.periodEnd}`);
      console.log(`│ Productos:       ${r.products} | Categorías: ${r.categories} | Toppings: ${r.toppings}`);
      console.log(`│ Pedidos mes:     ${r.monthOrders} | Total pedidos: ${r.totalOrders} | Completados: ${r.totalCompleted}`);
      console.log(`│ Mesas:           ${r.tables} | Staff: ${r.staff} | Zonas: ${r.zones} | Clientes: ${r.customers}`);
      console.log(`│ Plan mínimo:     ${r.minPlanNeeded.toUpperCase()}`);
      console.log(`│ Límites excedidos: ${r.exceeds}`);
      console.log(`│ ⚠️  Riesgo:       ${r.risk}`);
      console.log(`└──────────────────────────────────────────────`);
      console.log('');
    }

    // Summary
    console.log('\n═══ RESUMEN ═══');
    const planCounts = { free: 0, starter: 0, pro: 0, pro_max: 0 };
    const neededCounts = { free: 0, starter: 0, pro: 0, pro_max: 0 };
    let highRisk = 0;
    for (const r of results) {
      planCounts[r.currentPlan] = (planCounts[r.currentPlan] || 0) + 1;
      neededCounts[r.minPlanNeeded] = (neededCounts[r.minPlanNeeded] || 0) + 1;
      if (r.risk.startsWith('HIGH')) highRisk++;
    }

    console.log('\nDistribucion actual de planes:');
    for (const [plan, count] of Object.entries(planCounts)) {
      console.log(`  ${plan.toUpperCase().padEnd(10)} ${count} negocios`);
    }

    console.log('\nPlan minimo necesario por uso real:');
    for (const [plan, count] of Object.entries(neededCounts)) {
      console.log(`  ${plan.toUpperCase().padEnd(10)} ${count} negocios`);
    }

    console.log(`\nNegocios con riesgo ALTO (exceden su plan actual): ${highRisk}`);
    console.log(`Total negocios: ${results.length}`);

    // Specific migration concerns
    console.log('\n═══ IMPACTO DE MIGRACION ═══');
    console.log('\nStarter ahora tiene 350 pedidos/mes (antes 250):');
    const starterBusinesses = results.filter(r => r.currentPlan === 'starter');
    for (const r of starterBusinesses) {
      const status = r.monthOrders <= 350 ? 'OK' : 'EXCEDE 350';
      console.log(`  ${r.name}: ${r.monthOrders} pedidos/mes → ${status}`);
    }

    console.log('\nNegocios en Free que exceden limites Free:');
    const freeExceeders = results.filter(r => r.currentPlan === 'free' && r.minPlanNeeded !== 'free');
    if (freeExceeders.length === 0) {
      console.log('  Ninguno - todos caben en Free');
    } else {
      for (const r of freeExceeders) {
        console.log(`  ${r.name}: necesita ${r.minPlanNeeded.toUpperCase()} (${r.exceeds})`);
      }
    }

    console.log('\nNegocios Pro/Pro Max - sin limite, sin impacto:');
    const proBusinesses = results.filter(r => r.currentPlan === 'pro' || r.currentPlan === 'pro_max');
    for (const r of proBusinesses) {
      console.log(`  ${r.name}: ${r.currentPlan.toUpperCase()} - ${r.totalOrders} pedidos totales, sin restricciones`);
    }

    await mongoose.disconnect();
    console.log('\nDone.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

analyze();
