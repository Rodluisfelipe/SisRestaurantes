import { useState, useEffect, useMemo } from 'react';
import superadminApi from '../../services/superadminApi';
import { can, hasMinRole, NAV_BY_ROLE } from './permissions';

/**
 * Carga el perfil del usuario actual y expone helpers de autorización.
 *
 * Devuelve:
 *   me       — { id, email, name, role }
 *   loading
 *   can(action)            — true/false según la matriz de permisos
 *   hasMinRole(minRole)    — true/false por nivel jerárquico
 *   canAccessTab(tabId)    — atajo para NAV_BY_ROLE
 *   isReadOnly             — true si el rol es auditor
 */
export function useTeamPermissions() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    superadminApi.get('/team/me')
      .then((res) => {
        if (!cancelled) setMe(res.data?.me || null);
      })
      .catch(() => { if (!cancelled) setMe(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

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
    };
  }, [me, loading]);
}
