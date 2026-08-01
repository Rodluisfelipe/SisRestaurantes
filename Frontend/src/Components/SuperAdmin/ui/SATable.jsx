import { motion } from 'framer-motion';

/**
 * SATable — responsive data list with configurable columns.
 *
 * @param {Object} props
 * @param {Array<{ key: string, label: string, className?: string, render?: (row) => JSX, hideOnMobile?: boolean }>} props.columns
 * @param {Array} props.data — array of row objects
 * @param {Function} [props.onRowClick] — (row) => void
 * @param {string} [props.rowKey] — key to use as unique id, default '_id'
 * @param {boolean} [props.loading]
 * @param {boolean} [props.stagger] — stagger row entrance animations
 */
export default function SATable({ columns, data = [], onRowClick, rowKey = '_id', loading, stagger = true }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 bg-slate-100 border border-slate-200 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Desktop header */}
      <div className="hidden md:grid items-center gap-3 px-4 py-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider"
        style={{ gridTemplateColumns: columns.map(c => c.width || '1fr').join(' ') }}>
        {columns.map(col => (
          <span key={col.key} className={col.className || ''}>{col.label}</span>
        ))}
      </div>

      {/* Rows */}
      <div className="space-y-1">
        {data.map((row, i) => (
          <motion.div
            key={row[rowKey] || i}
            initial={stagger ? { opacity: 0, y: 6 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={stagger ? { delay: i * 0.03, duration: 0.25 } : undefined}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={`grid items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 bg-white
 hover:bg-slate-50 hover:border-slate-300 transition-all duration-150
 ${onRowClick ? 'cursor-pointer' : ''}`}
            style={{ gridTemplateColumns: columns.map(c => c.width || '1fr').join(' ') }}
          >
            {columns.map(col => (
              <div key={col.key} className={`text-sm ${col.hideOnMobile ? 'hidden md:block' : ''} ${col.className || ''}`}>
                {col.render ? col.render(row) : <span className="text-slate-700 truncate">{row[col.key]}</span>}
              </div>
            ))}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
