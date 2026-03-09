import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaGift, FaStar, FaTrophy, FaChartBar, FaPlus, FaEdit, FaTrash,
  FaToggleOn, FaToggleOff, FaSave, FaUsers, FaCoins, FaMedal,
  FaPercent, FaTruck, FaHamburger, FaChevronDown, FaChevronUp, FaTimes, FaSearch
} from 'react-icons/fa';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';

const REWARD_TYPES = [
  { value: 'discount_percent', label: 'Descuento %', icon: FaPercent, color: 'text-blue-600' },
  { value: 'discount_fixed', label: 'Descuento $', icon: FaCoins, color: 'text-green-600' },
  { value: 'free_product', label: 'Producto gratis', icon: FaHamburger, color: 'text-orange-600' },
  { value: 'free_delivery', label: 'Envío gratis', icon: FaTruck, color: 'text-purple-600' },
];

const ORDER_MODE_OPTIONS = [
  { value: 'inSite', label: 'En mesa' },
  { value: 'takeaway', label: 'Para llevar' },
  { value: 'delivery', label: 'Domicilio' },
];

const DEFAULT_TIERS = [
  { name: 'Bronce', minPoints: 0, multiplier: 1, color: '#cd7f32', icon: 'star', benefits: ['Acumula puntos'] },
  { name: 'Plata', minPoints: 500, multiplier: 1.5, color: '#94a3b8', icon: 'star', benefits: ['x1.5 puntos', 'Prioridad'] },
  { name: 'Oro', minPoints: 2000, multiplier: 2, color: '#eab308', icon: 'trophy', benefits: ['x2 puntos', '5% descuento'] },
  { name: 'VIP', minPoints: 5000, multiplier: 3, color: '#a855f7', icon: 'crown', benefits: ['x3 puntos', 'Producto gratis mensual'] },
];

const LoyaltyManager = () => {
  const { businessConfig, businessId } = useBusinessConfig();
  const bizId = businessId || businessConfig?._id;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState(null);
  const [topCustomers, setTopCustomers] = useState([]);
  const [activeSection, setActiveSection] = useState('config');

  const [program, setProgram] = useState({
    isActive: false,
    pointsPerAmount: 1,
    amountPerPoints: 10000,
    firstOrderBonus: 50,
    referralBonus: 0,
    pointsExpiryDays: 90,
    tiersEnabled: false,
    tiers: [],
    rewards: []
  });

  // Reward modal
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [editingReward, setEditingReward] = useState(null);
  const [rewardForm, setRewardForm] = useState({
    name: '', description: '', type: 'discount_percent',
    discountValue: 10, maxDiscount: 0, pointsCost: 100,
    productName: '', productId: '', isActive: true,
    applicableOrderModes: []
  });
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  const fetchProgram = useCallback(async () => {
    if (!bizId) return;
    try {
      setLoading(true);
      const { data } = await api.get(`/loyalty/program?businessId=${bizId}`);
      setProgram(data);
    } catch (err) {
      console.error('Error loading loyalty program:', err);
    } finally {
      setLoading(false);
    }
  }, [bizId]);

  const fetchStats = useCallback(async () => {
    if (!bizId) return;
    try {
      const [statsRes, topRes] = await Promise.all([
        api.get(`/loyalty/stats?businessId=${bizId}`),
        api.get(`/loyalty/top-customers?limit=10&businessId=${bizId}`)
      ]);
      setStats(statsRes.data);
      setTopCustomers(topRes.data);
    } catch (err) {
      console.error('Error loading loyalty stats:', err);
    }
  }, [bizId]);

  useEffect(() => { fetchProgram(); }, [fetchProgram]);
  useEffect(() => { if (activeSection === 'stats') fetchStats(); }, [activeSection, fetchStats]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const { data } = await api.put('/loyalty/program', { ...program, businessId: bizId });
      setProgram(data);
    } catch (err) {
      console.error('Error saving loyalty program:', err);
      alert('Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = () => {
    setProgram(p => ({ ...p, isActive: !p.isActive }));
  };

  const handleToggleTiers = () => {
    setProgram(p => ({
      ...p,
      tiersEnabled: !p.tiersEnabled,
      tiers: !p.tiersEnabled && p.tiers.length === 0 ? DEFAULT_TIERS : p.tiers
    }));
  };

  // Fetch products for the picker
  const fetchProducts = useCallback(async () => {
    if (!bizId) return;
    try {
      const { data } = await api.get(`/products?businessId=${bizId}`);
      setProducts(data.filter(p => p.active !== false));
    } catch (err) {
      console.error('Error loading products:', err);
    }
  }, [bizId]);

  // ── Reward CRUD ──
  const openRewardModal = (reward = null) => {
    fetchProducts();
    setProductSearch('');
    setShowProductDropdown(false);
    if (reward) {
      setEditingReward(reward);
      setRewardForm({
        name: reward.name, description: reward.description || '',
        type: reward.type, discountValue: reward.discountValue || 0,
        maxDiscount: reward.maxDiscount || 0, pointsCost: reward.pointsCost,
        productName: reward.productName || '', productId: reward.productId || '',
        isActive: reward.isActive,
        applicableOrderModes: reward.applicableOrderModes || []
      });
    } else {
      setEditingReward(null);
      setRewardForm({
        name: '', description: '', type: 'discount_percent',
        discountValue: 10, maxDiscount: 0, pointsCost: 100,
        productName: '', productId: '', isActive: true,
        applicableOrderModes: []
      });
    }
    setShowRewardModal(true);
  };

  const saveReward = () => {
    if (!rewardForm.name.trim() || !rewardForm.pointsCost) return;
    const newReward = { ...rewardForm };
    if (editingReward) {
      newReward._id = editingReward._id;
      newReward.timesRedeemed = editingReward.timesRedeemed || 0;
      setProgram(p => ({
        ...p,
        rewards: p.rewards.map(r => (r._id === editingReward._id ? newReward : r))
      }));
    } else {
      newReward._id = `temp_${Date.now()}`;
      setProgram(p => ({ ...p, rewards: [...p.rewards, newReward] }));
    }
    setShowRewardModal(false);
  };

  const deleteReward = (id) => {
    setProgram(p => ({ ...p, rewards: p.rewards.filter(r => r._id !== id) }));
  };

  // Tier management
  const updateTier = (idx, field, value) => {
    setProgram(p => {
      const tiers = [...p.tiers];
      tiers[idx] = { ...tiers[idx], [field]: value };
      return { ...p, tiers };
    });
  };

  const addTier = () => {
    const maxPts = program.tiers.length ? Math.max(...program.tiers.map(t => t.minPoints)) : 0;
    setProgram(p => ({
      ...p,
      tiers: [...p.tiers, { name: 'Nuevo nivel', minPoints: maxPts + 1000, multiplier: 1, color: '#94a3b8', icon: 'star', benefits: [] }]
    }));
  };

  const removeTier = (idx) => {
    setProgram(p => ({ ...p, tiers: p.tiers.filter((_, i) => i !== idx) }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const themeColor = businessConfig?.theme?.buttonColor || '#f97316';

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: themeColor + '18' }}>
            <FaGift className="w-5 h-5" style={{ color: themeColor }} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Programa de Fidelidad</h2>
            <p className="text-sm text-slate-500">Recompensa a tus clientes frecuentes</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleActive}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all ${
              program.isActive ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-50 text-slate-500 border border-slate-200'
            }`}
          >
            {program.isActive ? <FaToggleOn className="w-5 h-5" /> : <FaToggleOff className="w-5 h-5" />}
            {program.isActive ? 'Activo' : 'Inactivo'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-medium text-sm transition-all disabled:opacity-50"
            style={{ backgroundColor: themeColor }}
          >
            <FaSave className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1">
        {[
          { id: 'config', label: 'Configuración', icon: FaStar },
          { id: 'rewards', label: 'Recompensas', icon: FaGift },
          { id: 'tiers', label: 'Niveles', icon: FaTrophy },
          { id: 'stats', label: 'Estadísticas', icon: FaChartBar },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeSection === tab.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Config section */}
      {activeSection === 'config' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <FaCoins className="text-yellow-500" /> Forma de ganar puntos
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Por cada</label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-sm">$</span>
                  <input
                    type="number"
                    value={program.amountPerPoints}
                    onChange={e => setProgram(p => ({ ...p, amountPerPoints: Number(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
                    min="1"
                  />
                  <span className="text-slate-400 text-xs whitespace-nowrap">gastados</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Puntos a otorgar</label>
                <input
                  type="number"
                  value={program.pointsPerAmount}
                  onChange={e => setProgram(p => ({ ...p, pointsPerAmount: Number(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
                  min="1"
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Ejemplo: Por cada ${Number(program.amountPerPoints).toLocaleString('es-CO')} gastados, el cliente gana {program.pointsPerAmount} punto(s)
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <FaStar className="text-orange-500" /> Bonificaciones
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Bonus primer pedido</label>
                <input
                  type="number"
                  value={program.firstOrderBonus}
                  onChange={e => setProgram(p => ({ ...p, firstOrderBonus: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
                  min="0"
                  placeholder="0 = sin bonus"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Expiración de puntos (días)</label>
                <input
                  type="number"
                  value={program.pointsExpiryDays}
                  onChange={e => setProgram(p => ({ ...p, pointsExpiryDays: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
                  min="0"
                  placeholder="0 = nunca expiran"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rewards section */}
      {activeSection === 'rewards' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{program.rewards.length} recompensa(s) configuradas</p>
            <button
              onClick={() => openRewardModal()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-medium text-sm"
              style={{ backgroundColor: themeColor }}
            >
              <FaPlus className="w-3 h-3" /> Nueva recompensa
            </button>
          </div>

          {program.rewards.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
              <FaGift className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm mb-1">Aún no tienes recompensas</p>
              <p className="text-slate-400 text-xs">Crea recompensas para que tus clientes puedan canjear sus puntos</p>
            </div>
          )}

          <div className="grid gap-3">
            {program.rewards.map((reward) => {
              const rt = REWARD_TYPES.find(r => r.value === reward.type) || REWARD_TYPES[0];
              return (
                <div key={reward._id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-slate-50 ${rt.color}`}>
                    <rt.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-800 truncate">{reward.name}</h4>
                      {!reward.isActive && <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded">Inactiva</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {reward.type === 'discount_percent' && `${reward.discountValue}% de descuento`}
                      {reward.type === 'discount_fixed' && `$${Number(reward.discountValue).toLocaleString('es-CO')} de descuento`}
                      {reward.type === 'free_product' && `Producto gratis: ${reward.productName || 'Por definir'}`}
                      {reward.type === 'free_delivery' && 'Envío gratuito'}
                      {' · '}{reward.pointsCost} pts
                      {reward.applicableOrderModes?.length > 0 && (
                        <span className="ml-1 text-slate-400">
                          · {reward.applicableOrderModes.map(v => ORDER_MODE_OPTIONS.find(o => o.value === v)?.label).filter(Boolean).join(', ')}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">{reward.timesRedeemed || 0} canjeada(s)</span>
                    <button onClick={() => openRewardModal(reward)} className="p-2 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-600">
                      <FaEdit className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteReward(reward._id)} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
                      <FaTrash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tiers section */}
      {activeSection === 'tiers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={handleToggleTiers}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all border ${
                  program.tiersEnabled ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-500 border-slate-200'
                }`}
              >
                {program.tiersEnabled ? <FaToggleOn className="w-5 h-5" /> : <FaToggleOff className="w-5 h-5" />}
                {program.tiersEnabled ? 'Niveles activados' : 'Niveles desactivados'}
              </button>
            </div>
            {program.tiersEnabled && (
              <button onClick={addTier} className="flex items-center gap-2 px-3 py-2 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: themeColor }}>
                <FaPlus className="w-3 h-3" /> Nivel
              </button>
            )}
          </div>

          {program.tiersEnabled && (
            <div className="space-y-3">
              {program.tiers.map((tier, idx) => (
                <div key={idx} className="bg-white rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: tier.color + '30' }}>
                      <FaMedal className="w-4 h-4" style={{ color: tier.color }} />
                    </div>
                    <input
                      value={tier.name}
                      onChange={e => updateTier(idx, 'name', e.target.value)}
                      className="text-sm font-semibold text-slate-800 border-b border-transparent focus:border-slate-300 outline-none px-1"
                      placeholder="Nombre del nivel"
                    />
                    <button onClick={() => removeTier(idx)} className="ml-auto p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500">
                      <FaTrash className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-medium text-slate-400 mb-1">Puntos mínimos</label>
                      <input
                        type="number"
                        value={tier.minPoints}
                        onChange={e => updateTier(idx, 'minPoints', Number(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-slate-400 mb-1">Multiplicador</label>
                      <input
                        type="number"
                        value={tier.multiplier}
                        onChange={e => updateTier(idx, 'multiplier', Number(e.target.value) || 1)}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs"
                        min="1" step="0.5"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-slate-400 mb-1">Color</label>
                      <input
                        type="color"
                        value={tier.color}
                        onChange={e => updateTier(idx, 'color', e.target.value)}
                        className="w-full h-8 rounded-lg border border-slate-200 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!program.tiersEnabled && (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
              <FaTrophy className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm mb-1">Niveles desactivados</p>
              <p className="text-slate-400 text-xs">Activa niveles para que los clientes ganen multiplicadores en puntos según su lealtad</p>
            </div>
          )}
        </div>
      )}

      {/* Stats section */}
      {activeSection === 'stats' && (
        <div className="space-y-4">
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Miembros', value: stats.totalMembers || 0, icon: FaUsers, color: 'blue' },
                { label: 'Puntos emitidos', value: stats.totalPointsIssued || 0, icon: FaCoins, color: 'yellow' },
                { label: 'Puntos canjeados', value: stats.totalPointsRedeemed || 0, icon: FaGift, color: 'green' },
                { label: 'Puntos activos', value: stats.totalPointsActive || 0, icon: FaStar, color: 'orange' },
              ].map((stat, i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
                  <stat.icon className={`w-5 h-5 mx-auto mb-2 text-${stat.color}-500`} />
                  <p className="text-lg font-bold text-slate-800">{Number(stat.value).toLocaleString('es-CO')}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">{stat.label}</p>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <FaTrophy className="text-yellow-500" /> Clientes más leales
            </h3>
            {topCustomers.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Aún no hay datos</p>
            ) : (
              <div className="space-y-2">
                {topCustomers.map((c, i) => (
                  <div key={c._id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-slate-100 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-400'
                    }`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{c.customerId?.name || c.phone}</p>
                      <p className="text-[10px] text-slate-400">{c.phone} · {c.totalOrders} pedidos</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-800">{c.points} pts</p>
                      {c.currentTier && <p className="text-[10px] text-slate-400">{c.currentTier}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reward Modal */}
      <AnimatePresence>
        {showRewardModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setShowRewardModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between p-4 pb-2 shrink-0">
                <h3 className="text-base font-bold text-slate-800">
                  {editingReward ? 'Editar recompensa' : 'Nueva recompensa'}
                </h3>
                <button onClick={() => setShowRewardModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                  <FaTimes className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <div className="space-y-3 overflow-y-auto px-4 pb-2 flex-1 min-h-0">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Nombre</label>
                  <input
                    value={rewardForm.name}
                    onChange={e => setRewardForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    placeholder="Ej: Postre gratis"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
                  <div className="grid grid-cols-2 gap-2">
                    {REWARD_TYPES.map(rt => (
                      <button
                        key={rt.value}
                        onClick={() => setRewardForm(f => ({ ...f, type: rt.value }))}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                          rewardForm.type === rt.value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <rt.icon className={`w-4 h-4 ${rt.color}`} />
                        {rt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {(rewardForm.type === 'discount_percent' || rewardForm.type === 'discount_fixed') && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        Valor {rewardForm.type === 'discount_percent' ? '(%)' : '($)'}
                      </label>
                      <input
                        type="number"
                        value={rewardForm.discountValue}
                        onChange={e => setRewardForm(f => ({ ...f, discountValue: Number(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                        min="0"
                      />
                    </div>
                    {rewardForm.type === 'discount_percent' && (
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Máx. descuento ($)</label>
                        <input
                          type="number"
                          value={rewardForm.maxDiscount}
                          onChange={e => setRewardForm(f => ({ ...f, maxDiscount: Number(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                          min="0" placeholder="0 = sin límite"
                        />
                      </div>
                    )}
                  </div>
                )}

                {rewardForm.type === 'free_product' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Producto</label>
                    <button
                      type="button"
                      onClick={() => setShowProductDropdown(v => !v)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-all ${
                        rewardForm.productName
                          ? 'border-green-300 bg-green-50 text-green-700'
                          : 'border-slate-200 text-slate-400'
                      }`}
                    >
                      <span className="truncate">{rewardForm.productName || 'Seleccionar producto...'}</span>
                      <FaChevronDown className={`w-3 h-3 shrink-0 transition-transform ${showProductDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    {showProductDropdown && (
                      <div className="mt-1 rounded-lg border border-slate-200 bg-white overflow-hidden">
                        <div className="flex items-center border-b border-slate-100 px-2">
                          <FaSearch className="w-3 h-3 text-slate-400" />
                          <input
                            value={productSearch}
                            onChange={e => setProductSearch(e.target.value)}
                            className="w-full px-2 py-1.5 text-sm outline-none"
                            placeholder="Buscar..."
                            autoFocus
                          />
                        </div>
                        <div className="max-h-32 overflow-y-auto">
                          {products
                            .filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()))
                            .map(p => (
                              <button
                                key={p._id}
                                type="button"
                                onClick={() => {
                                  setRewardForm(f => ({ ...f, productId: p._id, productName: p.name }));
                                  setProductSearch('');
                                  setShowProductDropdown(false);
                                }}
                                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 flex items-center justify-between ${
                                  rewardForm.productId === p._id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                                }`}
                              >
                                <span className="truncate">{p.name}</span>
                                {p.price != null && <span className="text-[11px] text-slate-400 ml-2 shrink-0">${Number(p.price).toLocaleString('es-CO')}</span>}
                              </button>
                            ))}
                          {products.filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase())).length === 0 && (
                            <p className="px-3 py-2 text-xs text-slate-400">No se encontraron productos</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Costo en puntos</label>
                  <input
                    type="number"
                    value={rewardForm.pointsCost}
                    onChange={e => setRewardForm(f => ({ ...f, pointsCost: Number(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Descripción (opcional)</label>
                  <input
                    value={rewardForm.description}
                    onChange={e => setRewardForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    placeholder="Ej: Disfruta un postre por cuenta de la casa"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Aplica para</label>
                  <div className="flex gap-2">
                    {ORDER_MODE_OPTIONS.map(mode => {
                      const checked = rewardForm.applicableOrderModes.length === 0 || rewardForm.applicableOrderModes.includes(mode.value);
                      return (
                        <button
                          key={mode.value}
                          type="button"
                          onClick={() => {
                            setRewardForm(f => {
                              const current = f.applicableOrderModes.length === 0
                                ? ORDER_MODE_OPTIONS.map(m => m.value)
                                : [...f.applicableOrderModes];
                              const next = current.includes(mode.value)
                                ? current.filter(v => v !== mode.value)
                                : [...current, mode.value];
                              // If all selected, store empty (means all)
                              return { ...f, applicableOrderModes: next.length === ORDER_MODE_OPTIONS.length ? [] : next };
                            });
                          }}
                          className={`flex-1 py-2 rounded-lg border-2 text-xs font-medium transition-all ${
                            checked ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-400'
                          }`}
                        >
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {rewardForm.applicableOrderModes.length === 0 ? 'Aplica para todos los modos' : `Solo para: ${rewardForm.applicableOrderModes.map(v => ORDER_MODE_OPTIONS.find(o => o.value === v)?.label).join(', ')}`}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 p-4 pt-2 shrink-0">
                <button onClick={() => setShowRewardModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
                <button onClick={saveReward} className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: themeColor }}>
                  {editingReward ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LoyaltyManager;
