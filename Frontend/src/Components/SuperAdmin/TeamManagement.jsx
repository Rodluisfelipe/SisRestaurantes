import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import superadminApi from '../../services/superadminApi';
import { SAButton, SAModal, SAInput, SASelect, SABadge, SAEmptyState, SAToast } from './ui';

const ROLE_INFO = {
  owner: {
    label: 'Owner',
    badge: 'warning',
    desc: 'Control total. Puede gestionar el equipo.',
    color: 'text-amber-700 dark:text-amber-400',
  },
  admin: {
    label: 'Admin',
    badge: 'purple',
    desc: 'Operaciones del día a día. No puede gestionar equipo.',
    color: 'text-purple-700 dark:text-purple-400',
  },
  support: {
    label: 'Soporte',
    badge: 'info',
    desc: 'Aprobaciones y atención. No toca suscripciones ni borra.',
    color: 'text-cyan-700 dark:text-cyan-400',
  },
  auditor: {
    label: 'Auditor',
    badge: 'neutral',
    desc: 'Solo lectura. No puede modificar nada.',
    color: 'text-slate-700 dark:text-white/60',
  },
};

function formatRelative(iso) {
  if (!iso) return 'Nunca';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Hace un momento';
  if (min < 60) return `Hace ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `Hace ${days}d`;
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function initials(name, email) {
  const src = (name || email || '?').trim();
  return src.slice(0, 2).toUpperCase();
}

export default function TeamManagement() {
  const [me, setMe] = useState(null);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ visible: false, type: 'success', message: '' });

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [resetPwdTarget, setResetPwdTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const showToast = useCallback((type, message) => {
    setToast({ visible: true, type, message });
  }, []);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [meRes, teamRes] = await Promise.all([
        superadminApi.get('/team/me'),
        superadminApi.get('/team').catch((e) => {
          // If user has no permission to list team, just empty
          if (e?.response?.status === 403) return { data: { team: [] } };
          throw e;
        }),
      ]);
      setMe(meRes.data);
      setTeam(teamRes.data?.team || []);
    } catch (e) {
      setError(e?.response?.data?.message || 'No se pudo cargar el equipo');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const canManage = me?.permissions?.canManageTeam;
  const myId = me?.me?.id;

  const teamSorted = useMemo(() => {
    const order = { owner: 0, admin: 1, support: 2, auditor: 3 };
    return [...team].sort((a, b) => {
      const r = (order[a.role] ?? 9) - (order[b.role] ?? 9);
      if (r !== 0) return r;
      return (a.email || '').localeCompare(b.email || '');
    });
  }, [team]);

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-xl h-16" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-xl h-20" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-6 text-center">
        <p className="text-sm text-red-700 dark:text-red-400 font-medium">{error}</p>
        <SAButton variant="filled" onClick={load} className="mt-3">Reintentar</SAButton>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-slate-600 dark:text-white/60">
            {team.length} {team.length === 1 ? 'miembro' : 'miembros'} en el panel SuperAdmin
          </p>
          {!canManage && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
              Necesitas rol <strong>owner</strong> para invitar o modificar miembros.
            </p>
          )}
        </div>
        {canManage && (
          <SAButton
            variant="primary"
            onClick={() => setCreateOpen(true)}
            icon={
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
              </svg>
            }
          >
            Invitar miembro
          </SAButton>
        )}
      </div>

      {/* Role legend */}
      <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-xl p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-white/35 mb-2.5">Roles disponibles</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {Object.entries(ROLE_INFO).map(([k, v]) => (
            <div key={k} className="flex items-start gap-2">
              <SABadge variant={v.badge}>{v.label}</SABadge>
              <p className="text-[11px] text-slate-600 dark:text-white/50 leading-snug">{v.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Team list */}
      {teamSorted.length === 0 ? (
        <SAEmptyState
          title="Sin miembros visibles"
          subtitle={canManage ? 'Invita al primer miembro.' : 'Tu rol no te permite ver la lista del equipo.'}
        />
      ) : (
        <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-xl overflow-hidden">
          {teamSorted.map((m, i) => (
            <TeamRow
              key={m._id}
              member={m}
              isLast={i === teamSorted.length - 1}
              isMe={String(m._id) === String(myId)}
              canManage={canManage}
              onEdit={() => setEditTarget(m)}
              onToggleActive={async () => {
                try {
                  const res = await superadminApi.patch(`/team/${m._id}/active`, { active: !m.active });
                  setTeam((prev) => prev.map((x) => (x._id === m._id ? { ...x, ...res.data.member } : x)));
                  showToast('success', `Miembro ${res.data.member.active ? 'activado' : 'desactivado'}`);
                } catch (e) {
                  showToast('error', e?.response?.data?.message || 'Error al cambiar estado');
                }
              }}
              onResetPassword={() => setResetPwdTarget(m)}
              onDelete={() => setDeleteTarget(m)}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      {createOpen && (
        <CreateMemberModal
          onClose={() => setCreateOpen(false)}
          onCreated={(member) => {
            setTeam((prev) => [...prev, member]);
            setCreateOpen(false);
            showToast('success', `${member.email} agregado al equipo`);
          }}
          onError={(msg) => showToast('error', msg)}
        />
      )}

      {/* Edit modal */}
      {editTarget && (
        <EditMemberModal
          member={editTarget}
          isMe={String(editTarget._id) === String(myId)}
          onClose={() => setEditTarget(null)}
          onSaved={(updated) => {
            setTeam((prev) => prev.map((x) => (x._id === updated._id ? { ...x, ...updated } : x)));
            setEditTarget(null);
            showToast('success', 'Miembro actualizado');
          }}
          onError={(msg) => showToast('error', msg)}
        />
      )}

      {/* Reset password modal */}
      {resetPwdTarget && (
        <ResetPasswordModal
          member={resetPwdTarget}
          onClose={() => setResetPwdTarget(null)}
          onDone={() => {
            setResetPwdTarget(null);
            showToast('success', 'Contraseña actualizada y sesiones revocadas');
          }}
          onError={(msg) => showToast('error', msg)}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <DeleteMemberModal
          member={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setTeam((prev) => prev.filter((x) => x._id !== deleteTarget._id));
            setDeleteTarget(null);
            showToast('success', `${deleteTarget.email} eliminado`);
          }}
          onError={(msg) => showToast('error', msg)}
        />
      )}

      <SAToast {...toast} onClose={() => setToast((t) => ({ ...t, visible: false }))} />
    </div>
  );
}

/* ─── Row ─── */
function TeamRow({ member, isLast, isMe, canManage, onEdit, onToggleActive, onResetPassword, onDelete }) {
  const info = ROLE_INFO[member.role] || ROLE_INFO.auditor;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${!isLast ? 'border-b border-slate-100 dark:border-white/[0.04]' : ''} ${!member.active ? 'opacity-60' : ''}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br ${
        member.role === 'owner' ? 'from-amber-400 to-orange-500' :
        member.role === 'admin' ? 'from-purple-400 to-violet-500' :
        member.role === 'support' ? 'from-cyan-400 to-blue-500' :
        'from-slate-400 to-slate-500'
      } flex items-center justify-center text-[11px] font-bold text-white shadow-sm`}>
        {initials(member.name, member.email)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
            {member.name || member.email.split('@')[0]}
            {isMe && <span className="ml-2 text-[10px] font-bold text-cyan-700 dark:text-cyan-400">(tú)</span>}
          </p>
          <SABadge variant={info.badge}>{info.label}</SABadge>
          {!member.active && <SABadge variant="danger">Desactivado</SABadge>}
        </div>
        <p className="text-[12px] text-slate-500 dark:text-white/40 truncate">
          {member.email} · último ingreso: {formatRelative(member.lastLoginAt)}
        </p>
      </div>

      {/* Actions */}
      {canManage && !isMe && (
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1.5 rounded-lg text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            aria-label="Acciones"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
            </svg>
          </button>
          <AnimatePresence>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1 z-20 w-48 bg-white dark:bg-[#141419] border border-slate-200 dark:border-white/[0.08] rounded-xl shadow-xl shadow-slate-900/10 dark:shadow-black/40 overflow-hidden"
                >
                  <MenuItem onClick={() => { onEdit(); setMenuOpen(false); }} label="Editar rol / nombre" />
                  <MenuItem onClick={() => { onToggleActive(); setMenuOpen(false); }} label={member.active ? 'Desactivar' : 'Activar'} />
                  <MenuItem onClick={() => { onResetPassword(); setMenuOpen(false); }} label="Resetear contraseña" />
                  <MenuItem onClick={() => { onDelete(); setMenuOpen(false); }} label="Eliminar" danger />
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function MenuItem({ onClick, label, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2 text-[13px] font-medium transition-colors ${
        danger
          ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10'
          : 'text-slate-700 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
      }`}
    >
      {label}
    </button>
  );
}

/* ─── Create Modal ─── */
function CreateMemberModal({ onClose, onCreated, onError }) {
  const [form, setForm] = useState({ email: '', name: '', role: 'support', password: '' });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.email || !form.password) {
      onError('Email y contraseña son requeridos');
      return;
    }
    if (form.password.length < 8) {
      onError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    setSaving(true);
    try {
      const res = await superadminApi.post('/team', form);
      onCreated(res.data.member);
    } catch (e) {
      onError(e?.response?.data?.message || 'Error al crear miembro');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SAModal
      isOpen
      onClose={onClose}
      title="Invitar miembro al equipo"
      subtitle="Tendrá acceso al panel SuperAdmin con el rol que elijas"
      width="max-w-md"
      footer={
        <>
          <SAButton variant="ghost" onClick={onClose}>Cancelar</SAButton>
          <SAButton variant="primary" onClick={submit} loading={saving}>Crear</SAButton>
        </>
      }
    >
      <div className="space-y-3">
        <SAInput label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="persona@menuby.tech" />
        <SAInput label="Nombre (opcional)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre completo" />
        <SASelect label="Rol" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="auditor">Auditor — solo lectura</option>
          <option value="support">Soporte — aprobaciones</option>
          <option value="admin">Admin — operaciones</option>
          <option value="owner">Owner — control total</option>
        </SASelect>
        <SAInput label="Contraseña inicial (mínimo 8)" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
        <p className="text-[11px] text-slate-500 dark:text-white/40">El miembro podrá cambiar su contraseña desde su propio panel.</p>
      </div>
    </SAModal>
  );
}

/* ─── Edit Modal ─── */
function EditMemberModal({ member, isMe, onClose, onSaved, onError }) {
  const [form, setForm] = useState({ name: member.name || '', role: member.role });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const res = await superadminApi.put(`/team/${member._id}`, form);
      onSaved(res.data.member);
    } catch (e) {
      onError(e?.response?.data?.message || 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SAModal
      isOpen
      onClose={onClose}
      title={`Editar ${member.email}`}
      width="max-w-md"
      footer={
        <>
          <SAButton variant="ghost" onClick={onClose}>Cancelar</SAButton>
          <SAButton variant="primary" onClick={submit} loading={saving}>Guardar</SAButton>
        </>
      }
    >
      <div className="space-y-3">
        <SAInput label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <SASelect label="Rol" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="auditor">Auditor</option>
          <option value="support">Soporte</option>
          <option value="admin">Admin</option>
          <option value="owner">Owner</option>
        </SASelect>
        {isMe && form.role !== 'owner' && (
          <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug">
            ⚠️ Estás cambiando tu propio rol. Si te bajas de owner, no podrás volver a subirte tú mismo.
          </p>
        )}
      </div>
    </SAModal>
  );
}

/* ─── Reset Password Modal ─── */
function ResetPasswordModal({ member, onClose, onDone, onError }) {
  const [pwd, setPwd] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (pwd.length < 8) {
      onError('Mínimo 8 caracteres');
      return;
    }
    setSaving(true);
    try {
      await superadminApi.post(`/team/${member._id}/reset-password`, { newPassword: pwd });
      onDone();
    } catch (e) {
      onError(e?.response?.data?.message || 'Error al resetear');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SAModal
      isOpen
      onClose={onClose}
      title="Resetear contraseña"
      subtitle={`${member.email} — las sesiones activas se cerrarán`}
      width="max-w-md"
      footer={
        <>
          <SAButton variant="ghost" onClick={onClose}>Cancelar</SAButton>
          <SAButton variant="danger" onClick={submit} loading={saving}>Resetear</SAButton>
        </>
      }
    >
      <SAInput
        label="Nueva contraseña (mínimo 8)"
        type="text"
        value={pwd}
        onChange={(e) => setPwd(e.target.value)}
        placeholder="••••••••"
      />
      <p className="text-[11px] text-slate-500 dark:text-white/40 mt-2">
        Comparte la nueva contraseña al miembro por un canal seguro. Pídele que la cambie al ingresar.
      </p>
    </SAModal>
  );
}

/* ─── Delete Confirm Modal ─── */
function DeleteMemberModal({ member, onClose, onDeleted, onError }) {
  const [confirmEmail, setConfirmEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const canSubmit = confirmEmail === member.email;

  const submit = async () => {
    setSaving(true);
    try {
      await superadminApi.delete(`/team/${member._id}`);
      onDeleted();
    } catch (e) {
      onError(e?.response?.data?.message || 'Error al eliminar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SAModal
      isOpen
      onClose={onClose}
      title="Eliminar miembro"
      subtitle="Esta acción no se puede deshacer"
      width="max-w-md"
      footer={
        <>
          <SAButton variant="ghost" onClick={onClose}>Cancelar</SAButton>
          <SAButton variant="danger" onClick={submit} disabled={!canSubmit} loading={saving}>
            Eliminar permanente
          </SAButton>
        </>
      }
    >
      <p className="text-sm text-slate-700 dark:text-white/70 mb-3">
        Vas a eliminar a <strong>{member.email}</strong> ({ROLE_INFO[member.role]?.label}).
      </p>
      <SAInput
        label={`Escribe "${member.email}" para confirmar`}
        value={confirmEmail}
        onChange={(e) => setConfirmEmail(e.target.value)}
        placeholder={member.email}
      />
    </SAModal>
  );
}
