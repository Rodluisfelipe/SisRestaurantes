import { motion } from 'framer-motion';

/**
 * SAStats — grid of stat cards.
 *
 * @param {Array<{ label: string, value: string|number, icon?: JSX, trend?: string, trendUp?: boolean, color?: string }>} props.items
 */
export default function SAStats({ items = [] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, duration: 0.3 }}
          className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4"
        >
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-medium text-white/35 uppercase tracking-wider">{item.label}</span>
            {item.icon && <span className="text-white/20">{item.icon}</span>}
          </div>
          <div className="flex items-end gap-2">
            <span className={`text-2xl font-semibold tabular-nums ${item.color || 'text-white'}`}>
              {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
            </span>
            {item.trend && (
              <span className={`text-[11px] font-medium mb-0.5 ${item.trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
                {item.trend}
              </span>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
