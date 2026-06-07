import { motion } from 'framer-motion';

export default function SACard({ children, className = '', hover = false, padding = 'p-5', onClick, as = 'div' }) {
  const base = `bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-xl ${padding} ${
    hover ? 'hover:bg-slate-50 dark:hover:bg-white/[0.04] hover:border-slate-300 dark:hover:border-white/[0.1] transition-all duration-200 cursor-pointer' : ''
  } ${className}`;

  if (onClick || hover) {
    return (
      <motion.div whileHover={hover ? { y: -1 } : undefined} onClick={onClick} className={base}>
        {children}
      </motion.div>
    );
  }

  const Tag = as;
  return <Tag className={base}>{children}</Tag>;
}

export function SACardHeader({ title, subtitle, action, children }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        {title && <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>}
        {subtitle && <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
      {children}
    </div>
  );
}
