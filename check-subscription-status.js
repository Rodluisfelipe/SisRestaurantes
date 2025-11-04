const mongoose = require('mongoose');
const Subscription = require('./Models/Subscription');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const businessId = '68dcac91ee3c0da327230ea2';
  const sub = await Subscription.findOne({ businessId: mongoose.Types.ObjectId(businessId) }).sort({ createdAt: -1 });
  
  if (sub) {
    console.log('\n=== SUSCRIPCIÓN ACTUAL ===');
    console.log('Status:', sub.status);
    console.log('PaymentStatus:', sub.paymentStatus);
    console.log('PlanType:', sub.planType);
    console.log('StartDate:', sub.startDate);
    console.log('EndDate:', sub.endDate);
    console.log('GracePeriodEnd:', sub.gracePeriodEnd);
    console.log('WompiTransactionId:', sub.wompiTransactionId);
    console.log('WompiReference:', sub.wompiReference);
    console.log('LastPaymentAttempt:', sub.lastPaymentAttempt);
    const now = new Date();
    console.log('\n=== VERIFICACIONES ===');
    console.log('Ahora:', now);
    console.log('EndDate > Now:', sub.endDate > now);
    console.log('isSubscriptionActive():', sub.isSubscriptionActive());
    console.log('isInGracePeriod():', sub.isInGracePeriod());
    console.log('getDaysRemaining():', sub.getDaysRemaining());
  } else {
    console.log('No se encontró suscripción');
  }
  
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

