import React, { useState, useEffect, useCallback } from 'react';
import { useBusinessConfig } from '../Context/BusinessContext';
import api from '../services/api';
import TableMapEditor from './TableMapEditor';

const TableSettings = () => {
  const { businessId, businessConfig } = useBusinessConfig();
  const isHotel = businessConfig?.businessType === 'hotel';
  const tableLabel = isHotel ? 'habitación' : 'mesa';
  const tableLabelCap = isHotel ? 'Habitación' : 'Mesa';
  const tableLabelPlural = isHotel ? 'habitaciones' : 'mesas';

  // --- Floors ---
  const [floors, setFloors] = useState([]);
  const [activeFloor, setActiveFloor] = useState(null);
  const [newFloorName, setNewFloorName] = useState('');
  const [editingFloorId, setEditingFloorId] = useState(null);
  const [editFloorName, setEditFloorName] = useState('');

  // --- Tables ---
  const [tables, setTables] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveTimer, setSaveTimer] = useState(null);

  // Load floors
  useEffect(() => {
    if (!businessId) return;
    api.get(`/floors?businessId=${businessId}`).then(r => {
      setFloors(r.data);
      if (r.data.length > 0 && !activeFloor) setActiveFloor(r.data[0]._id);
    }).catch(() => {});
  }, [businessId]);

  // Load tables for active floor
  useEffect(() => {
    if (!businessId) return;
    api.get(`/tables?businessId=${businessId}`).then(r => {
      setTables(r.data);
    }).catch(() => {});
  }, [businessId]);

  const floorTables = activeFloor ? tables.filter(t => t.floorId === activeFloor) : tables.filter(t => !t.floorId);

  // --- Floor CRUD ---
  const addFloor = async () => {
    if (!newFloorName.trim()) return;
    try {
      const r = await api.post('/floors', { businessId, name: newFloorName.trim() });
      setFloors(prev => [...prev, r.data]);
      setActiveFloor(r.data._id);
      setNewFloorName('');
    } catch (err) {
      alert(err.response?.data?.message || 'Error al crear salón');
    }
  };

  const updateFloor = async (id) => {
    if (!editFloorName.trim()) return;
    try {
      const r = await api.put(`/floors/${id}`, { name: editFloorName.trim() });
      setFloors(prev => prev.map(f => f._id === id ? r.data : f));
      setEditingFloorId(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Error al actualizar salón');
    }
  };

  const deleteFloor = async (id) => {
    if (!confirm(`¿Eliminar este salón? Las ${tableLabelPlural} quedarán sin asignar.`)) return;
    try {
      await api.delete(`/floors/${id}?businessId=${businessId}`);
      setFloors(prev => prev.filter(f => f._id !== id));
      setTables(prev => prev.map(t => t.floorId === id ? { ...t, floorId: null } : t));
      if (activeFloor === id) setActiveFloor(floors.find(f => f._id !== id)?._id || null);
    } catch (err) {
      alert(err.response?.data?.message || 'Error al eliminar salón');
    }
  };

  // --- Table CRUD ---
  const addTable = async () => {
    const maxNum = tables.reduce((max, t) => {
      const n = parseInt(t.tableNumber);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);
    const nextNum = String(maxNum + 1);
    try {
      const r = await api.post('/tables', {
        businessId,
        tableNumber: nextNum,
        tableName: `${tableLabelCap} ${nextNum}`,
        floorId: activeFloor || undefined,
        posX: 10 + (floorTables.length % 8) * 11,
        posY: 10 + Math.floor(floorTables.length / 8) * 14,
        shape: 'square',
        capacity: 4
      });
      setTables(prev => [...prev, r.data]);
    } catch (err) {
      alert(err.response?.data?.message || `Error al crear ${tableLabel}`);
    }
  };

  // Debounced save for drag positions
  const debouncedSavePosition = useCallback((tableId, posX, posY) => {
    if (saveTimer) clearTimeout(saveTimer);
    const timer = setTimeout(async () => {
      try {
        const table = tables.find(t => t._id === tableId);
        if (!table) return;
        await api.put(`/tables/${tableId}`, { businessId, posX, posY });
      } catch {}
    }, 500);
    setSaveTimer(timer);
  }, [tables, businessId, saveTimer]);

  const handleUpdateTable = useCallback((tableId, updates, isDrag = false) => {
    setTables(prev => prev.map(t => t._id === tableId ? { ...t, ...updates } : t));
    if (isDrag) {
      debouncedSavePosition(tableId, updates.posX, updates.posY);
    } else {
      // Direct property update
      setSaving(true);
      api.put(`/tables/${tableId}`, { businessId, ...updates })
        .then(r => setTables(prev => prev.map(t => t._id === tableId ? r.data : t)))
        .catch(err => alert(err.response?.data?.message || `Error al actualizar ${tableLabel}`))
        .finally(() => setSaving(false));
    }
  }, [businessId, debouncedSavePosition]);

  const handleDeleteTable = async (tableId) => {
    if (!confirm(`¿Eliminar esta ${tableLabel}?`)) return;
    try {
      await api.delete(`/tables/${tableId}?businessId=${businessId}`);
      setTables(prev => prev.filter(t => t._id !== tableId));
    } catch (err) {
      alert(err.response?.data?.message || `Error al eliminar ${tableLabel}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* ═══ Section 1: Floors (Salones) ═══ */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <h2 className="text-lg font-bold text-gray-800 mb-3">Salones</h2>

        {/* Floor tabs */}
        <div className="flex flex-wrap gap-2 mb-3">
          {floors.map(floor => (
            <div key={floor._id} className="flex items-center">
              {editingFloorId === floor._id ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={editFloorName}
                    onChange={e => setEditFloorName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && updateFloor(floor._id)}
                    className="border rounded px-2 py-1 text-sm w-28"
                    autoFocus
                  />
                  <button onClick={() => updateFloor(floor._id)} className="text-green-600 text-sm font-bold">✓</button>
                  <button onClick={() => setEditingFloorId(null)} className="text-gray-400 text-sm">✕</button>
                </div>
              ) : (
                <button
                  onClick={() => setActiveFloor(floor._id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeFloor === floor._id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {floor.name}
                </button>
              )}
              {activeFloor === floor._id && editingFloorId !== floor._id && (
                <div className="flex ml-1 gap-0.5">
                  <button
                    onClick={() => { setEditingFloorId(floor._id); setEditFloorName(floor.name); }}
                    className="text-gray-400 hover:text-blue-500 p-1 text-xs"
                    title="Renombrar"
                  >✏️</button>
                  <button
                    onClick={() => deleteFloor(floor._id)}
                    className="text-gray-400 hover:text-red-500 p-1 text-xs"
                    title="Eliminar"
                  >🗑</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add floor */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newFloorName}
            onChange={e => setNewFloorName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addFloor()}
            placeholder="Nombre del nuevo salón..."
            className="border rounded-lg px-3 py-1.5 text-sm flex-1 max-w-xs"
          />
          <button
            onClick={addFloor}
            disabled={!newFloorName.trim()}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            + Salón
          </button>
        </div>
      </div>

      {/* ═══ Section 2: Table Map ═══ */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800">
            {floors.find(f => f._id === activeFloor)?.name || `${tableLabelCap}s sin salón`}
          </h2>
          {saving && <span className="text-xs text-gray-400 animate-pulse">Guardando...</span>}
        </div>

        <TableMapEditor
          tables={floorTables}
          onUpdateTable={handleUpdateTable}
          onDeleteTable={handleDeleteTable}
          onAddTable={addTable}
        />

        {/* Table list below map */}
        {floorTables.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Lista de {tableLabelPlural}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {floorTables.map(table => (
                <div
                  key={table._id}
                  className="border rounded-lg p-2 text-center transition-colors"
                >
                  <div className="font-bold text-sm text-gray-800">{tableLabelCap} {table.tableNumber}</div>
                  <div className="text-xs text-gray-500">{table.capacity} personas</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TableSettings; 