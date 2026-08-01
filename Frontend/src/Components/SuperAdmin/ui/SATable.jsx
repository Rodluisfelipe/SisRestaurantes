import { motion } from 'framer-motion';

/**
 * SATable — lista de datos con columnas configurables.
 *
 * En escritorio es una tabla en grid; por debajo de `md` cada fila se convierte
 * en una tarjeta apilada con etiqueta y valor. Antes el gridTemplateColumns iba
 * inline —o sea, también en móvil— y las columnas ocultas dejaban huecos.
 *
 * @param {Array<{ key, label, width?, className?, render?, hideOnMobile?, primary? }>} props.columns
 *   `primary`: columna que hace de título de la tarjeta en móvil (por defecto, la primera).
 */
export default function SATable({ columns, data = [], onRowClick, rowKey = '_id', loading, stagger = true, emptyMessage }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 bg-slate-100 border border-slate-200 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data.length && emptyMessage) {
    return (
      <div className="py-12 text-center border border-slate-200 rounded-xl bg-white">
        <p className="text-sm text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  const template = columns.map((c) => c.width || '1fr').join(' ');
  const primaryCol = columns.find((c) => c.primary) || columns[0];
  const restCols = columns.filter((c) => c !== primaryCol && !c.hideOnMobile);

  return (
    <div className="w-full">
      {/* Encabezado — solo escritorio */}
      <div
        className="hidden md:grid items-center gap-3 px-4 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider"
        style={{ gridTemplateColumns: template }}
      >
        {columns.map((col) => (
          <span key={col.key} className={col.className || ''}>{col.label}</span>
        ))}
      </div>

      <div className="space-y-1.5 md:space-y-1">
        {data.map((row, i) => {
          const clickable = !!onRowClick;
          return (
            <motion.div
              key={row[rowKey] || i}
              initial={stagger ? { opacity: 0, y: 6 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={stagger ? { delay: Math.min(i, 12) * 0.025, duration: 0.22 } : undefined}
              onClick={clickable ? () => onRowClick(row) : undefined}
              className={`rounded-xl border border-slate-200 bg-white transition-colors duration-150 ${
                clickable ? 'cursor-pointer hover:bg-slate-50 hover:border-slate-300' : ''
              }`}
            >
              {/* ── Escritorio: grid ── */}
              <div className="hidden md:grid items-center gap-3 px-4 py-3" style={{ gridTemplateColumns: template }}>
                {columns.map((col) => (
                  <div key={col.key} className={`text-sm min-w-0 ${col.className || ''}`}>
                    {col.render ? col.render(row) : <span className="text-slate-700 truncate block">{row[col.key]}</span>}
                  </div>
                ))}
              </div>

              {/* ── Móvil: tarjeta apilada ── */}
              <div className="md:hidden p-3.5">
                <div className="text-sm font-semibold text-slate-800 mb-2 min-w-0">
                  {primaryCol.render ? primaryCol.render(row) : row[primaryCol.key]}
                </div>
                {restCols.length > 0 && (
                  <dl className="space-y-1.5">
                    {restCols.map((col) => (
                      <div key={col.key} className="flex items-start justify-between gap-3">
                        <dt className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider pt-0.5 shrink-0">
                          {col.label}
                        </dt>
                        <dd className="text-[13px] text-slate-700 text-right min-w-0">
                          {col.render ? col.render(row) : row[col.key]}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
