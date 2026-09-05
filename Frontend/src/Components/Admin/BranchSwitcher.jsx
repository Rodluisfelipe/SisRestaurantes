import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../Context/AuthContext';
import api from '../../services/api';
import { toast } from 'sonner';

export default function BranchSwitcher() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef(null);

  if (!user || user.role !== 'brand_admin' || !user.branches || user.branches.length < 2) return null;

  const current = user.branches.find(b => String(b._id) === String(user.businessId)) || user.branches[0];

  const handleSwitch = async (branch) => {
    if (String(branch._id) === String(user.businessId)) { setOpen(false); return; }
    setSwitching(true);
    setOpen(false);
    try {
      const { data } = await api.post('/auth/switch-branch', { targetBusinessId: branch._id });
      // Update stored tokens
      const updatedUser = { ...user, businessId: branch._id };
      sessionStorage.setItem('accessToken', data.token);
      localStorage.setItem('accessToken', data.token);
      sessionStorage.setItem('user', JSON.stringify(updatedUser));
      localStorage.setItem('user', JSON.stringify(updatedUser));
      // Navigate to new branch admin
      navigate(`/${branch.slug}/admin`, { replace: true });
      window.location.reload();
    } catch (err) {
      console.error('Error switching branch', err);
      // Critico: sin aviso, uno cree que cambio de sede y termina editando
      // el menu de la sucursal equivocada.
      toast.error(err?.response?.data?.message || 'No se pudo cambiar de sucursal.');
    } finally {
      setSwitching(false);
    }
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative px-4 pb-3">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={switching}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition-all duration-200 text-left"
      >
        <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" />
        </svg>
        <span className="text-[11px] font-semibold text-indigo-700 flex-1 truncate">
          {switching ? 'Cambiando…' : (current?.branchLabel || current?.businessName || 'Sucursal')}
        </span>
        <svg className={`w-3 h-3 text-indigo-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-4 right-4 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
          {user.branches.map(branch => {
            const isActive = String(branch._id) === String(user.businessId);
            return (
              <button
                key={branch._id}
                onClick={() => handleSwitch(branch)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors ${isActive ? 'bg-indigo-50' : ''}`}
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                <div className="flex-1 min-w-0">
                  <div className={`text-[11px] font-semibold truncate ${isActive ? 'text-indigo-700' : 'text-slate-700'}`}>
                    {branch.branchLabel || branch.businessName}
                  </div>
                  {branch.isMainBranch && (
                    <div className="text-[9px] text-slate-400 uppercase tracking-wide">Principal</div>
                  )}
                </div>
                {isActive && (
                  <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
