/**
 * useCrewEmployer — Context + hook de auth para empleadores Crew.
 * Usa React Context para que todos los hijos compartan el mismo estado de auth.
 */
import { useState, useEffect, useCallback, useContext, createContext, useMemo } from 'react';
import crewEmployerApi, {
  setEmployerSession, clearEmployerSession, getCachedEmployer,
  EMPLOYER_TOKEN_KEY,
} from '../../services/crewEmployerApi';

const CrewEmployerContext = createContext(null);

export function CrewEmployerProvider({ children }) {
  const [employer, setEmployer] = useState(() => getCachedEmployer());
  const [loading, setLoading] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(EMPLOYER_TOKEN_KEY);
    if (!token) { setBootstrapped(true); return; }
    let cancelled = false;
    crewEmployerApi.get('/employers/me')
      .then((res) => {
        if (cancelled) return;
        if (res.data?.employer) {
          setEmployer(res.data.employer);
          setEmployerSession({ employer: res.data.employer });
        }
      })
      .catch(() => { setEmployer(null); })
      .finally(() => { if (!cancelled) setBootstrapped(true); });
    return () => { cancelled = true; };
  }, []);

  const signup = useCallback(async (payload) => {
    setLoading(true);
    try {
      const { data } = await crewEmployerApi.post('/employers/signup', payload);
      setEmployerSession({ token: data.token, employer: data.employer });
      setEmployer(data.employer);
      return data;
    } finally { setLoading(false); }
  }, []);

  const login = useCallback(async ({ phone, password }) => {
    setLoading(true);
    try {
      const { data } = await crewEmployerApi.post('/employers/login', { phone, password });
      setEmployerSession({ token: data.token, employer: data.employer });
      setEmployer(data.employer);
      return data;
    } finally { setLoading(false); }
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const { data } = await crewEmployerApi.get('/employers/me');
      setEmployer(data.employer);
      setEmployerSession({ employer: data.employer });
      return data.employer;
    } catch (e) {
      setEmployer(null);
      throw e;
    }
  }, []);

  const updateMe = useCallback(async (patch) => {
    const { data } = await crewEmployerApi.put('/employers/me', patch);
    setEmployer(data.employer);
    setEmployerSession({ employer: data.employer });
    return data.employer;
  }, []);

  const logout = useCallback(() => {
    clearEmployerSession();
    setEmployer(null);
  }, []);

  const value = useMemo(() => ({
    employer,
    loading,
    bootstrapped,
    isAuthed: !!employer,
    isApproved: employer?.status === 'approved',
    isPending: employer?.status === 'pending_approval',
    isRejected: employer?.status === 'rejected',
    signup, login, refreshMe, updateMe, logout,
  }), [employer, loading, bootstrapped, signup, login, refreshMe, updateMe, logout]);

  return (
    <CrewEmployerContext.Provider value={value}>
      {children}
    </CrewEmployerContext.Provider>
  );
}

export function useCrewEmployer() {
  const ctx = useContext(CrewEmployerContext);
  if (!ctx) throw new Error('useCrewEmployer must be used inside CrewEmployerProvider');
  return ctx;
}
