import React, { useState, useEffect } from 'react';
import { useBusinessConfig } from '../../Context/BusinessContext';
import api from '../../services/api';
import { toast } from 'sonner';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import { FaMotorcycle, FaUserPlus, FaTrash, FaCheck, FaBan, FaKey, FaTimes, FaCalendarDay, FaClock } from 'react-icons/fa';

const DomiStats = () => {
  const { businessId, businessConfig } = useBusinessConfig();
  const [domis, setDomis] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Create state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  
  // Daily Code State
  const [dailyCode, setDailyCode] = useState('');
  const [dailySession, setDailySession] = useState(null);

  useEffect(() => {
    if (!businessConfig?.slug) return;
    fetchData();
    fetchDailySession();
  }, [businessConfig?.slug]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const slug = businessConfig?.slug;
      const [personsRes, statsRes] = await Promise.all([
        api.get(`/delivery-admin/restaurants/${slug}/delivery-persons`),
        api.get(`/delivery-admin/restaurants/${slug}/delivery-stats`)
      ]);
      setDomis(personsRes.data);
      setStats(statsRes.data);
    } catch (err) {
      toast.error('Error cargando estadísticas y domiciliarios');
    } finally {
      setLoading(false);
    }
  };

  const fetchDailySession = async () => {
    try {
      const res = await api.get(`/delivery-admin/restaurants/${businessConfig?.slug}/delivery-session/today`);
      setDailySession(res.data);
      if(res.data) setDailyCode(res.data.dailyCode);
    } catch (err) {
      // Not generated today yet is normal (404)
    }
  };

  const handleGenerateDaily = async () => {
    try {
      const CodeValue = dailyCode || Math.random().toString(36).substr(2, 6).toUpperCase();
      const res = await api.post(`/delivery-admin/restaurants/${businessConfig?.slug}/delivery-session/generate`, { code: CodeValue });
      setDailySession(res.data);
      toast.success('Pase diario activado con éxito');
    } catch (err) {
      toast.error('Error generando pase diario');
    }
  };

  const handleCreateDomi = async (e) => {
    e.preventDefault();
    if(newCode.length !== 4) return toast.error('El código debe ser exactamente de 4 dígitos');
    try {
      await api.post(`/delivery-admin/restaurants/${businessConfig?.slug}/delivery-persons`, {
        name: newName,
        code: newCode
      });
      toast.success('Perfil creado exitosamente');
      setNewName('');
      setNewCode('');
      setShowCreate(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al crear perfil');
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando datos de entrega...</div>;

  return (
    <div className="space-y-4 lg:space-y-6 max-w-6xl mx-auto px-0 lg:p-6 pb-20">
       <div className="flex justify-between items-center bg-white p-4 lg:p-6 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-sm border border-slate-100 lg:border-slate-100">
           <div>
              <h1 className="text-lg lg:text-2xl font-bold text-slate-800 flex items-center gap-3">
                  <FaMotorcycle className="text-red-500" />
                  Módulo de Domicilios
              </h1>
              <p className="hidden lg:block text-slate-500 text-sm mt-1">Gestiona tu equipo de entregas y analiza su rendimiento.</p>
           </div>
       </div>

       {/* Daily Mode Widget */}
       <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl shadow-lg p-4 lg:p-6 text-white text-sm sm:text-base">
           <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                 <h2 className="font-bold text-lg text-white mb-1">Modo Diario (Domi Fijo Único)</h2>
                 <p className="text-slate-300">Si usas un solo domiciliario hoy, genérale un pase temporal para que reciba los pedidos del día en ruta.</p>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                 <input 
                   type="text" 
                   maxLength="6"
                   value={dailyCode}
                   onChange={e => setDailyCode(e.target.value.toUpperCase())}
                   placeholder="Ej. DOMI24"
                   className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white font-bold tracking-widest text-center w-32 focus:ring-2 focus:ring-red-400 outline-none"
                   disabled={!!dailySession}
                 />
                 {!dailySession ? (
                    <button onClick={handleGenerateDaily} className="bg-red-500 hover:bg-red-600 py-3 px-5 rounded-lg font-bold flex-1 sm:flex-none">Activar Hoy</button>
                 ) : (
                    <div className="bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 px-5 py-3 rounded-lg flex items-center gap-2">
                        <FaCheck /> Activo
                    </div>
                 )}
              </div>
           </div>
           
           <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between text-slate-400 italic text-xs">
              <p>Tu link para domiciliarios: <span className="text-white select-all">https://menuby.tech/{businessConfig?.slug}/domi</span></p>
              {dailySession && <p>Expira a media noche</p>}
           </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* STATS */}
          <div className="col-span-1 lg:col-span-2 space-y-6">
             {/* Kpis */}
             <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4">
                 <div className="bg-white rounded-2xl lg:rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-sm border border-slate-100 lg:border-slate-100 p-4 lg:p-5">
                     <div className="flex items-center gap-3">
                       <div className="w-10 h-10 lg:w-9 lg:h-9 rounded-xl bg-gradient-to-br from-red-500 to-red-600 lg:bg-red-50 lg:from-transparent lg:to-transparent shadow-sm lg:shadow-none flex items-center justify-center">
                         <FaMotorcycle className="text-white lg:text-red-500 text-base lg:text-sm" />
                       </div>
                       <div>
                         <p className="text-slate-500 text-[11px] lg:text-xs font-medium">Activas</p>
                         <p className="text-[20px] lg:text-xl font-bold text-slate-800 leading-tight">{stats?.activeOrders || 0}</p>
                       </div>
                     </div>
                 </div>
                 <div className="bg-white rounded-2xl lg:rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-sm border border-slate-100 lg:border-slate-100 p-4 lg:p-5">
                     <div className="flex items-center gap-3">
                       <div className="w-10 h-10 lg:w-9 lg:h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 lg:bg-blue-50 lg:from-transparent lg:to-transparent shadow-sm lg:shadow-none flex items-center justify-center">
                         <FaCalendarDay className="text-white lg:text-blue-500 text-base lg:text-sm" />
                       </div>
                       <div>
                         <p className="text-slate-500 text-[11px] lg:text-xs font-medium">Hoy</p>
                         <p className="text-[20px] lg:text-xl font-bold text-blue-600 leading-tight">{stats?.todayDeliveries || 0}</p>
                       </div>
                     </div>
                 </div>
                 <div className="bg-white rounded-2xl lg:rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-sm border border-slate-100 lg:border-slate-100 p-4 lg:p-5">
                     <div className="flex items-center gap-3">
                       <div className="w-10 h-10 lg:w-9 lg:h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 lg:bg-emerald-50 lg:from-transparent lg:to-transparent shadow-sm lg:shadow-none flex items-center justify-center">
                         <FaCheck className="text-white lg:text-emerald-500 text-base lg:text-sm" />
                       </div>
                       <div>
                         <p className="text-slate-500 text-[11px] lg:text-xs font-medium">Total</p>
                         <p className="text-[20px] lg:text-xl font-bold text-slate-800 leading-tight">{stats?.totalDeliveries || 0}</p>
                       </div>
                     </div>
                 </div>
                 <div className="bg-white rounded-2xl lg:rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-sm border border-slate-100 lg:border-slate-100 p-4 lg:p-5">
                     <div className="flex items-center gap-3">
                       <div className="w-10 h-10 lg:w-9 lg:h-9 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 lg:bg-violet-50 lg:from-transparent lg:to-transparent shadow-sm lg:shadow-none flex items-center justify-center">
                         <FaClock className="text-white lg:text-violet-500 text-base lg:text-sm" />
                       </div>
                       <div>
                         <p className="text-slate-500 text-[11px] lg:text-xs font-medium">Prom.</p>
                         <p className="text-[20px] lg:text-xl font-bold text-emerald-600 leading-tight">{stats?.avgMinutes || 0} <span className="text-[11px] font-normal text-slate-500">min</span></p>
                       </div>
                     </div>
                 </div>
             </div>
             
             {/* Chart */}
             <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-sm border border-slate-100 lg:border-slate-100 p-4 lg:p-6">
                 <h3 className="font-bold text-slate-800 mb-6">Tendencia de Entregas (7 días)</h3>
                 <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats?.chartData || []}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis dataKey="date" stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                          <RechartsTooltip cursor={{fill: '#F1F5F9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'}} />
                          <Bar dataKey="count" fill="#F87171" radius={[4, 4, 0, 0]} name="Entregas" />
                        </BarChart>
                    </ResponsiveContainer>
                 </div>
             </div>
          </div>
          
          {/* PERFILES */}
          <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-sm border border-slate-100 lg:border-slate-100 p-4 lg:p-6 flex flex-col max-h-[600px]">
             <div className="flex justify-between items-center mb-6">
                 <h3 className="font-bold text-slate-800">Perfiles de Domiciliarios</h3>
                 <button onClick={() => setShowCreate(!showCreate)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors">
                    {showCreate ? <FaTimes /> : <FaUserPlus />}
                 </button>
             </div>
             
             {showCreate && (
                 <form onSubmit={handleCreateDomi} className="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-200">
                    <h4 className="font-bold text-sm mb-3">Nuevo Perfil</h4>
                    <div className="space-y-3">
                        <input className="w-full text-sm p-2 rounded border border-slate-300 outline-none focus:border-red-400" placeholder="Nombre (ej. Juan Pérez)" value={newName} onChange={e => setNewName(e.target.value)} required />
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Pin secreto de 4 dígitos:</p>
                          <input type="password" maxLength={4} className="w-full text-sm p-2 rounded border border-slate-300 outline-none focus:border-red-400 font-mono tracking-widest" placeholder="1234" value={newCode} onChange={e => setNewCode(e.target.value.replace(/\D/g, ''))} required />
                        </div>
                        <button type="submit" className="w-full bg-slate-800 text-white font-bold py-2 rounded-lg text-sm hover:bg-slate-900 mt-2">Crear Perfil</button>
                    </div>
                 </form>
             )}
             
             <div className="overflow-y-auto flex-1 pr-2 space-y-3">
                 {domis.length === 0 ? (
                     <p className="text-sm text-slate-500 text-center py-6">No hay perfiles registrados.</p>
                 ) : (
                     domis.map(d => (
                         <div key={d._id} className="relative p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors">
                             <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-slate-800">{d.name}</h4>
                                {d.status === 'on_delivery' && <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">En Ruta</span>}
                                {d.status === 'available' && <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Conectado</span>}
                                {(d.status === 'disconnected' || d.status === 'offline') && <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">Desconectado</span>}
                             </div>
                             
                             <div className="flex items-center gap-4 mt-3">
                                 <div className="text-xs flex items-center gap-1.5 text-slate-500">
                                    <FaKey className="opacity-50" />
                                    ****{/* Ocultamos el pin por seguridad, el admin no lo ve, solo si lo blanquea luego */}
                                 </div>
                                 <div className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 font-medium">
                                    Histórico: {d.totalDeliveries || 0}
                                 </div>
                             </div>
                             
                             <div className="absolute right-3 bottom-3 flex gap-2">
                                {/* Opciones futuras como desactivar/borrar */}
                             </div>
                         </div>
                     ))
                 )}
             </div>
          </div>
       </div>
    </div>
  );
};

export default DomiStats;