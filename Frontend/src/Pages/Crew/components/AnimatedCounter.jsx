import { useEffect, useState } from 'react';
import { useSpring, useTransform, motion } from 'framer-motion';

/**
 * AnimatedCounter — anima un número desde 0 (o `from`) al `value`.
 * Útil para stats, balance, XP, etc.
 */
export default function AnimatedCounter({
  value, from = 0, duration = 1.1, format = (v) => Math.round(v).toLocaleString('es-CO'),
  className = '',
}) {
  const spring = useSpring(from, { stiffness: 80, damping: 18, mass: 0.6 });
  const display = useTransform(spring, format);

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  const [text, setText] = useState(format(from));
  useEffect(() => {
    const unsub = display.on('change', setText);
    return unsub;
  }, [display]);

  return <motion.span className={`tabular-nums ${className}`}>{text}</motion.span>;
}
