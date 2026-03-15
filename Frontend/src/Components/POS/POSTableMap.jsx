import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useBusinessConfig } from '../../Context/BusinessContext';

const STATUS_COLORS = {
  available: 'bg-emerald-100 border-emerald-400 text-emerald-800',
  occupied:  'bg-orange-100 border-orange-400 text-orange-800',
  held:      'bg-amber-100 border-amber-400 text-amber-800',
  selected:  'bg-blue-100 border-blue-500 text-blue-800 ring-2 ring-blue-400',
};

export default function POSTableMap({ businessId, selectedTable, onSelectTable, activeOrders, heldOrders }) {
  const { businessConfig } = useBusinessConfig();
  const isHotel = businessConfig?.businessType === 'hotel';
  const tableLabel = isHotel ? 'Hab.' : 'Mesa';
  const [floors, setFloors] = useState([]);
  const [tables, setTables] = useState([]);
  const [activeFloor, setActiveFloor] = useState(null);

  useEffect(() => {
    if (!businessId) return;
    Promise.all([
      api.get(`/floors?businessId=${businessId}`),
      api.get(`/tables?businessId=${businessId}`)
    ]).then(([fRes, tRes]) => {
      setFloors(fRes.data || []);
      setTables(tRes.data || []);
      if (fRes.data.length > 0) setActiveFloor(fRes.data[0]._id);
    }).catch(() => {});
  }, [businessId]);

  // Build a set of occupied table numbers from active orders
  const occupiedTables = new Set();
  (activeOrders || []).forEach(o => {
    if (o.tableNumber) occupiedTables.add(String(o.tableNumber));
  });

  // Build a set of held table numbers
  const heldTableNums = new Set();
  (heldOrders || []).forEach(h => {
    if (h.tableNumber) heldTableNums.add(String(h.tableNumber));
  });

  const getTableStatus = (table) => {
    if (selectedTable?._id === table._id) return 'selected';
    if (occupiedTables.has(String(table.tableNumber))) return 'occupied';
    if (heldTableNums.has(String(table.tableNumber))) return 'held';
    return 'available';
  };

  const floorTables = activeFloor
    ? tables.filter(t => t.floorId === activeFloor)
    : tables.filter(t => !t.floorId);

  const displayTables = floorTables.length > 0 ? floorTables : tables;

  if (tables.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 px-6 text-center">
        <svg className="w-16 h-16 mb-3 text-slate-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
        <p className="text-sm font-medium">{isHotel ? 'Sin habitaciones configuradas' : 'Sin mesas configuradas'}</p>
        <p className="text-xs text-slate-300 mt-1">{isHotel ? 'Configura habitaciones desde el panel de administración' : 'Configura mesas desde el panel de administración'}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Floor tabs */}
      {floors.length > 0 && (
        <div className="flex gap-1 px-3 pt-3 pb-2 overflow-x-auto flex-shrink-0">
          {floors.map(floor => (
            <button
              key={floor._id}
              onClick={() => setActiveFloor(floor._id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeFloor === floor._id
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
            >
              {floor.name}
            </button>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-3 px-3 pb-2 flex-shrink-0">
        <span className="flex items-center gap-1 text-[10px] text-slate-500">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Libre
        </span>
        <span className="flex items-center gap-1 text-[10px] text-slate-500">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-400" /> Ocupada
        </span>
        <span className="flex items-center gap-1 text-[10px] text-slate-500">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Congelada
        </span>
        <span className="flex items-center gap-1 text-[10px] text-slate-500">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-400" /> Seleccionada
        </span>
      </div>

      {/* Table map */}
      <div className="flex-1 relative mx-3 mb-3 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden" style={{ minHeight: '300px' }}>
        {/* Grid */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.06]">
          {[10,20,30,40,50,60,70,80,90].map(p => (
            <React.Fragment key={p}>
              <line x1={`${p}%`} y1="0" x2={`${p}%`} y2="100%" stroke="#64748b" strokeWidth="1" />
              <line x1="0" y1={`${p}%`} x2="100%" y2={`${p}%`} stroke="#64748b" strokeWidth="1" />
            </React.Fragment>
          ))}
        </svg>

        {displayTables.map(table => {
          const status = getTableStatus(table);
          const colorClass = STATUS_COLORS[status];
          const shapeClass = table.shape === 'round' ? 'rounded-full' : table.shape === 'rect' ? 'rounded-md' : 'rounded-lg';
          const w = table.shape === 'rect' ? (table.width || 10) * 1.6 : (table.width || 10);
          const h = table.height || 10;

          return (
            <button
              key={table._id}
              className={`absolute flex flex-col items-center justify-center border-2 transition-all cursor-pointer hover:scale-105 active:scale-95 ${colorClass} ${shapeClass}`}
              style={{
                left: `${table.posX}%`,
                top: `${table.posY}%`,
                width: `${w}%`,
                height: `${h}%`,
                transform: table.rotation ? `rotate(${table.rotation}deg)` : undefined,
              }}
              onClick={() => onSelectTable(status === 'selected' ? null : table)}
              title={`${tableLabel} ${table.tableNumber} — ${table.capacity}p — ${status === 'available' ? 'Libre' : status === 'occupied' ? 'Ocupada' : status === 'held' ? 'Congelada' : 'Seleccionada'}`}
            >
              <span className="font-bold text-xs sm:text-sm leading-tight">{table.tableNumber}</span>
              <span className="text-[9px] sm:text-[10px] opacity-70">{table.capacity}p</span>
            </button>
          );
        })}
      </div>

      {/* Selected table action */}
      {selectedTable && (
        <div className="px-3 pb-3 flex-shrink-0">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-blue-800">{tableLabel} {selectedTable.tableNumber}</p>
              <p className="text-[11px] text-blue-600">{selectedTable.capacity} personas · {selectedTable.tableName || `${tableLabel} ${selectedTable.tableNumber}`}</p>
            </div>
            <button
              onClick={() => onSelectTable(null)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
            >
              Quitar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
