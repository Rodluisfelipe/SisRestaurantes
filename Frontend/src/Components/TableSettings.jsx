import React, { useState, useEffect, useCallback } from 'react';
import { useBusinessConfig } from '../Context/BusinessContext';
import { QRCodeSVG } from 'qrcode.react';
import { FaDownload } from 'react-icons/fa';
import api from '../services/api';
import TableMapEditor from './TableMapEditor';

const TableSettings = () => {
  const { businessId } = useBusinessConfig();

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

  // --- QR ---
  const [qrTable, setQrTable] = useState(null);

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
    if (!confirm('¿Eliminar este salón? Las mesas quedarán sin asignar.')) return;
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
        tableName: `Mesa ${nextNum}`,
        floorId: activeFloor || undefined,
        posX: 10 + (floorTables.length % 8) * 11,
        posY: 10 + Math.floor(floorTables.length / 8) * 14,
        shape: 'square',
        capacity: 4
      });
      setTables(prev => [...prev, r.data]);
    } catch (err) {
      alert(err.response?.data?.message || 'Error al crear mesa');
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
        .catch(err => alert(err.response?.data?.message || 'Error al actualizar mesa'))
        .finally(() => setSaving(false));
    }
  }, [businessId, debouncedSavePosition]);

  const handleDeleteTable = async (tableId) => {
    if (!confirm('¿Eliminar esta mesa?')) return;
    try {
      await api.delete(`/tables/${tableId}?businessId=${businessId}`);
      setTables(prev => prev.filter(t => t._id !== tableId));
    } catch (err) {
      alert(err.response?.data?.message || 'Error al eliminar mesa');
    }
  };

  // --- QR ---
  const getMenuQRCodeUrl = (tableNumber) => {
    const baseUrl = window.location.origin;
    return tableNumber ? `${baseUrl}/${businessId}/mesa/${tableNumber}` : `${baseUrl}/${businessId}`;
  };

  const handleDownloadQR = (tableNumber) => {
    const svgElement = document.getElementById('table-qr-code');
    if (!svgElement) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 300;
    canvas.height = 300;
    const image = new Image();
    image.onload = function() {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, 300, 300);
      const pngUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = pngUrl;
      link.download = `mesa-${tableNumber || 'menu'}-qr.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    image.src = URL.createObjectURL(svgBlob);
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
            {floors.find(f => f._id === activeFloor)?.name || 'Mesas sin salón'}
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
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Lista de mesas</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {floorTables.map(table => (
                <div
                  key={table._id}
                  className="border rounded-lg p-2 text-center hover:border-blue-400 cursor-pointer transition-colors"
                  onClick={() => setQrTable(table)}
                >
                  <div className="font-bold text-sm text-gray-800">Mesa {table.tableNumber}</div>
                  <div className="text-xs text-gray-500">{table.capacity} personas</div>
                  <div className="text-[10px] text-blue-500 mt-1">QR ↗</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══ Section 3: QR Code del Menú General ═══ */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-800 mb-2">Código QR del Menú</h2>
          <p className="text-gray-500 text-sm mb-4">
            Los clientes pueden escanear este código para acceder al menú de tu negocio
          </p>
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-white border-2 border-gray-200 rounded-lg shadow-sm">
              <QRCodeSVG
                id="menu-qr-code"
                value={getMenuQRCodeUrl()}
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg mb-4 max-w-md mx-auto">
            <p className="text-xs text-gray-500 break-all font-mono">{getMenuQRCodeUrl()}</p>
          </div>
          <button
            onClick={() => {
              // Temporarily swap id for download
              const el = document.getElementById('menu-qr-code');
              if (el) { el.id = 'table-qr-code'; handleDownloadQR('menu'); el.id = 'menu-qr-code'; }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 inline-flex items-center gap-2"
          >
            <FaDownload size={14} /> Descargar QR
          </button>
        </div>
      </div>

      {/* ═══ QR Modal for individual table ═══ */}
      {qrTable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setQrTable(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-800 mb-1">Mesa {qrTable.tableNumber}</h3>
              <p className="text-sm text-gray-500 mb-4">Escanea para pedir desde esta mesa</p>
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-white border-2 border-gray-200 rounded-lg">
                  <QRCodeSVG
                    id="table-qr-code"
                    value={getMenuQRCodeUrl(qrTable.tableNumber)}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-4 break-all">{getMenuQRCodeUrl(qrTable.tableNumber)}</p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => handleDownloadQR(qrTable.tableNumber)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2"
                >
                  <FaDownload size={14} /> Descargar
                </button>
                <button onClick={() => setQrTable(null)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableSettings; 