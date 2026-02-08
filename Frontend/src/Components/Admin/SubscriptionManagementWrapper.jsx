import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useBusinessConfig } from '../../Context/BusinessContext';
import { useAuth } from '../../Context/AuthContext';
import SubscriptionPaymentCard from '../SubscriptionPaymentCard';
import SubscriptionDetailsCard from '../SubscriptionDetailsCard';

/**
 * Wrapper que carga y muestra la suscripción del negocio.
 * Soporta modo SuperAdmin pasando businessId como query param.
 */
const SubscriptionManagementWrapper = () => {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const { businessId: businessIdFromConfig } = useBusinessConfig();
  const { user } = useAuth();

  const businessId = businessIdFromConfig || user?.businessId;

  useEffect(() => {
    if (businessId || user?.role === 'superadmin') {
      loadSubscription();
    }
  }, [businessId, user]);

  const loadSubscription = async () => {
    try {
      const url = user?.role === 'superadmin' && businessId
        ? `/subscriptions/me?businessId=${businessId}`
        : '/subscriptions/me';
      const res = await api.get(url);
      if (res.data.success && res.data.subscription) {
        setSubscription(res.data.subscription);
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <SubscriptionPaymentCard />
      {subscription && <SubscriptionDetailsCard subscription={subscription} />}
    </div>
  );
};

export default SubscriptionManagementWrapper;
