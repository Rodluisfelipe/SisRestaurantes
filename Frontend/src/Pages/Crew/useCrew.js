import { useState, useEffect, useCallback } from 'react';
import crewApi from '../../services/crewApi';

const TOKEN_KEY = 'crew_token';
const WORKER_KEY = 'crew_worker';

export function useCrew() {
  const [worker, setWorker] = useState(() => {
    try { return JSON.parse(localStorage.getItem(WORKER_KEY) || 'null'); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const isAuthed = !!worker && !!localStorage.getItem(TOKEN_KEY);

  const persist = useCallback((token, w) => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    if (w) {
      localStorage.setItem(WORKER_KEY, JSON.stringify(w));
      setWorker(w);
    }
  }, []);

  const signup = useCallback(async ({ phone, name, password }) => {
    setLoading(true);
    try {
      const { data } = await crewApi.post('/workers/signup', { phone, name, password });
      persist(data.token, data.worker);
      return data.worker;
    } finally { setLoading(false); }
  }, [persist]);

  const login = useCallback(async ({ phone, password }) => {
    setLoading(true);
    try {
      const { data } = await crewApi.post('/workers/login', { phone, password });
      persist(data.token, data.worker);
      return data.worker;
    } finally { setLoading(false); }
  }, [persist]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(WORKER_KEY);
    setWorker(null);
  }, []);

  const refreshMe = useCallback(async () => {
    if (!localStorage.getItem(TOKEN_KEY)) return null;
    try {
      const { data } = await crewApi.get('/workers/me');
      persist(null, data.worker);
      return data.worker;
    } catch (e) {
      if (e?.response?.status === 401) logout();
      return null;
    }
  }, [persist, logout]);

  useEffect(() => {
    if (localStorage.getItem(TOKEN_KEY) && !worker) refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { worker, isAuthed, loading, signup, login, logout, refreshMe };
}
