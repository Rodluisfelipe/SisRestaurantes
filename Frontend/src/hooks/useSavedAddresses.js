import { useState, useCallback } from 'react';

const KEY = 'savedAddresses';
const MAX = 5;

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function useSavedAddresses() {
  const [addresses, setAddresses] = useState(load);

  const addAddress = useCallback((address, coords, city, label = '') => {
    // Normalize coords to always store { lat, lng } regardless of input format
    const normalized = { lat: coords.lat, lng: coords.lng ?? coords.lon };
    setAddresses(prev => {
      if (prev.some(a => a.address === address)) return prev;
      const next = [
        { id: Date.now().toString(), label, address, coords: normalized, city, createdAt: Date.now() },
        ...prev,
      ].slice(0, MAX);
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeAddress = useCallback((id) => {
    setAddresses(prev => {
      const next = prev.filter(a => a.id !== id);
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { addresses, addAddress, removeAddress };
}
