import { useState, useEffect, useMemo } from 'react';
import superadminApi from '../../services/superadminApi';
import { can, hasMinRole, NAV_BY_ROLE } from './permissions';

/**
 * Carga el perfil del usuario actual y expone helpers de autorización.
 *
 * IMPORTANTE: solo dispara la llamada si hay un token en localStorage.
 * De lo contrario, el interceptor 401 de superadminApi nos redirigiría a /superadmin
 * en bucle infinito al abrir la pantalla de login.
 *
 * Devuelve:
 *   me                     — { id, email, name, role } | null
 *   loading
 *   role
 *   can(action)            — true/false según la matriz de permisos
 *   hasMinRole(minRole)    — true/false por nivel jerárquico
 *   canAccessTab(tabId)    — atajo para NAV_BY_ROLE
 *   isReadOnly             — true si el rol es auditor
 *   refresh()              — re-fetch manual (úsalo justo después de login)
 */
export function useTeamPermissions(enabled = true) {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setMe(null);
      setLoading(false);
      return;
    }
    // Sin token = no autenticado. NO llamar — evitar loop de redirect.
    const token = (() => { try { return localStorage.getItem('superadmin_token'); } catch { return null; } })();
    if (!token) {
      setMe(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    superadminApi.get('/team/me')
      .then((res) => { if (!cancelled) setMe(res.data?.me || null); })
      .catch(() => { if (!cancelled) setMe(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled, tick]);

  return useMemo(() => {
    const role = me?.role || null;
    const allowedTabs = role ? new Set(NAV_BY_ROLE[role] || []) : null;
    return {
      me,
      loading,
      role,
      can: (action) => (role ? can(role, action) : false),
      hasMinRole: (minRole) => (role ? hasMinRole(role, minRole) : false),
      canAccessTab: (tabId) => (allowedTabs ? allowedTabs.has(tabId) : false),
      isReadOnly: role === 'auditor',
      refresh: () => setTick((t) => t + 1),
    };
  }, [me, loading]);
}
