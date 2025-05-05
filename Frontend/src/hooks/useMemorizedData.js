import { useState, useEffect, useMemo } from 'react';

export const useMemorizedData = (getData, dependencies = [], options = {}) => {
  const { ttl = 5 * 60 * 1000 } = options; // 5 minutos por defecto
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const shouldUpdate = useMemo(() => {
    if (!lastUpdate) return true;
    return Date.now() - lastUpdate > ttl;
  }, [lastUpdate, ttl]);

  useEffect(() => {
    const fetchData = async () => {
      if (!shouldUpdate && data) return;

      try {
        setLoading(true);
        const result = await getData();
        setData(result);
        setLastUpdate(Date.now());
        setError(null);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [...dependencies, shouldUpdate]);

  return { data, loading, error, refetch: () => setLastUpdate(null) };
}; 