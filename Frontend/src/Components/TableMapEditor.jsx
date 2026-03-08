import React, { useState, useRef, useCallback, useEffect } from 'react';

const SHAPES = {
  square: { label: 'Cuadrada', icon: '◻' },
  round:  { label: 'Redonda',  icon: '○' },
  rect:   { label: 'Rectangular', icon: '▭' }
};

const TABLE_COLORS = {
  idle:     'bg-emerald-100 border-emerald-400 text-emerald-800',
  selected: 'bg-blue-100 border-blue-500 text-blue-800',
  dragging: 'bg-amber-100 border-amber-400 text-amber-800 shadow-lg'
};

export default function TableMapEditor({ tables, onUpdateTable, onDeleteTable, onAddTable }) {
  const containerRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [editModal, setEditModal] = useState(null);

  const toPercent = useCallback((clientX, clientY) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    return { x, y };
  }, []);

  // Mouse drag
  const handleMouseDown = (e, table) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(table._id);
    const rect = containerRef.current.getBoundingClientRect();
    const tablePx = { x: (table.posX / 100) * rect.width, y: (table.posY / 100) * rect.height };
    setDragOffset({ x: e.clientX - rect.left - tablePx.x, y: e.clientY - rect.top - tablePx.y });
    setDragging(table._id);
  };

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const rawX = ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100;
      const rawY = ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100;
      const x = Math.max(0, Math.min(95, rawX));
      const y = Math.max(0, Math.min(95, rawY));
      onUpdateTable(dragging, { posX: Math.round(x * 10) / 10, posY: Math.round(y * 10) / 10 }, true);
    };
    const handleUp = () => setDragging(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
  }, [dragging, dragOffset, onUpdateTable]);

  // Touch drag
  const handleTouchStart = (e, table) => {
    e.stopPropagation();
    const touch = e.touches[0];
    setSelectedId(table._id);
    const rect = containerRef.current.getBoundingClientRect();
    const tablePx = { x: (table.posX / 100) * rect.width, y: (table.posY / 100) * rect.height };
    setDragOffset({ x: touch.clientX - rect.left - tablePx.x, y: touch.clientY - rect.top - tablePx.y });
    setDragging(table._id);
  };

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const rawX = ((touch.clientX - rect.left - dragOffset.x) / rect.width) * 100;
      const rawY = ((touch.clientY - rect.top - dragOffset.y) / rect.height) * 100;
      const x = Math.max(0, Math.min(95, rawX));
      const y = Math.max(0, Math.min(95, rawY));
      onUpdateTable(dragging, { posX: Math.round(x * 10) / 10, posY: Math.round(y * 10) / 10 }, true);
    };
    const handleEnd = () => setDragging(null);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    return () => { window.removeEventListener('touchmove', handleMove); window.removeEventListener('touchend', handleEnd); };
  }, [dragging, dragOffset, onUpdateTable]);

  const selectedTable = tables.find(t => t._id === selectedId);
  const editingTable = editModal ? tables.find(t => t._id === editModal) : null;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onAddTable}
          className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Agregar Mesa
        </button>

        {selectedTable && (
          <>
            <button
              onClick={() => setEditModal(selectedId)}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              ✏️ Editar
            </button>
            <button
              onClick={() => { onDeleteTable(selectedId); setSelectedId(null); }}
              className="px-3 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600"
            >
              🗑 Eliminar
            </button>
            <span className="text-sm text-gray-500">
              Mesa {selectedTable.tableNumber} — {selectedTable.capacity} pers.
            </span>
          </>
        )}
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative w-full bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl overflow-hidden select-none"
        style={{ aspectRatio: '16/10' }}
        onClick={() => setSelectedId(null)}
      >
        {/* Grid lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-10">
          {[10,20,30,40,50,60,70,80,90].map(p => (
            <React.Fragment key={p}>
              <line x1={`${p}%`} y1="0" x2={`${p}%`} y2="100%" stroke="#94a3b8" strokeWidth="1" />
              <line x1="0" y1={`${p}%`} x2="100%" y2={`${p}%`} stroke="#94a3b8" strokeWidth="1" />
            </React.Fragment>
          ))}
        </svg>

        {tables.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="text-lg">Arrastra las mesas para posicionarlas</p>
              <p className="text-sm mt-1">Haz clic en "Agregar Mesa" para empezar</p>
            </div>
          </div>
        )}

        {tables.map(table => {
          const isDragging = dragging === table._id;
          const isSelected = selectedId === table._id;
          const colorClass = isDragging ? TABLE_COLORS.dragging : isSelected ? TABLE_COLORS.selected : TABLE_COLORS.idle;
          const shapeClass = table.shape === 'round' ? 'rounded-full' : table.shape === 'rect' ? 'rounded-md' : 'rounded-lg';
          const w = table.shape === 'rect' ? (table.width || 10) * 1.6 : (table.width || 10);
          const h = table.height || 10;

          return (
            <div
              key={table._id}
              className={`absolute flex flex-col items-center justify-center border-2 cursor-grab active:cursor-grabbing transition-shadow ${colorClass} ${shapeClass} ${isDragging ? 'z-30' : isSelected ? 'z-20' : 'z-10'}`}
              style={{
                left: `${table.posX}%`,
                top: `${table.posY}%`,
                width: `${w}%`,
                height: `${h}%`,
                transform: table.rotation ? `rotate(${table.rotation}deg)` : undefined,
                touchAction: 'none'
              }}
              onMouseDown={(e) => handleMouseDown(e, table)}
              onTouchStart={(e) => handleTouchStart(e, table)}
              onDoubleClick={(e) => { e.stopPropagation(); setEditModal(table._id); }}
            >
              <span className="font-bold text-xs sm:text-sm leading-tight pointer-events-none">{table.tableNumber}</span>
              <span className="text-[10px] sm:text-xs opacity-70 pointer-events-none">{table.capacity}p</span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Arrastra las mesas para posicionarlas · Doble clic para editar · Clic para seleccionar
      </p>

      {/* Edit Modal */}
      {editModal && editingTable && (
        <EditTableModal
          table={editingTable}
          onSave={(updates) => { onUpdateTable(editModal, updates); setEditModal(null); }}
          onClose={() => setEditModal(null)}
        />
      )}
    </div>
  );
}

function EditTableModal({ table, onSave, onClose }) {
  const [form, setForm] = useState({
    tableNumber: table.tableNumber || '',
    tableName: table.tableName || '',
    capacity: table.capacity || 4,
    shape: table.shape || 'square',
    notes: table.notes || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.tableNumber.trim()) return;
    onSave({
      tableNumber: form.tableNumber.trim(),
      tableName: form.tableName.trim() || `Mesa ${form.tableNumber.trim()}`,
      capacity: parseInt(form.capacity) || 4,
      shape: form.shape,
      notes: form.notes.trim()
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-800 mb-4">Editar Mesa</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Número</label>
            <input
              type="text"
              value={form.tableNumber}
              onChange={e => setForm(f => ({ ...f, tableNumber: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Nombre (opcional)</label>
            <input
              type="text"
              value={form.tableName}
              onChange={e => setForm(f => ({ ...f, tableName: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder={`Mesa ${form.tableNumber}`}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-600 mb-1">Capacidad</label>
              <input
                type="number"
                min="1"
                max="20"
                value={form.capacity}
                onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-600 mb-1">Forma</label>
              <div className="flex gap-1">
                {Object.entries(SHAPES).map(([key, { label, icon }]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, shape: key }))}
                    className={`flex-1 py-2 rounded-lg text-lg border ${form.shape === key ? 'bg-blue-100 border-blue-500' : 'bg-gray-50 border-gray-200'}`}
                    title={label}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Notas</label>
            <input
              type="text"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Ej: Cerca de la ventana"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
              Guardar
            </button>
            <button type="button" onClick={onClose} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
