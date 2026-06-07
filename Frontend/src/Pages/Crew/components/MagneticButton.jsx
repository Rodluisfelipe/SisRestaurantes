import { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

/**
 * Botón con efecto magnético: en desktop sigue ligeramente el cursor.
 * En móvil se reduce a un tap con scale + tilt suave.
 * Mantiene look MenuBy (gradient rojo).
 */
export default function MagneticButton({ children, onClick, disabled, className = '', glow = true }) {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 300, damping: 25 });
  const sy = useSpring(y, { stiffness: 300, damping: 25 });
  const rotateX = useTransform(sy, [-30, 30], [10, -10]);
  const rotateY = useTransform(sx, [-30, 30], [-10, 10]);
  const [hovered, setHovered] = useState(false);

  const onMouseMove = (e) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = e.clientX - rect.left - rect.width / 2;
    const cy = e.clientY - rect.top - rect.height / 2;
    x.set(cx * 0.25);
    y.set(cy * 0.4);
  };
  const onMouseLeave = () => { x.set(0); y.set(0); setHovered(false); };

  return (
    <motion.button
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      disabled={disabled}
      style={{ x: sx, y: sy, rotateX, rotateY, transformStyle: 'preserve-3d' }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      className={`relative ${className}`}
    >
      {/* Glow halo on hover */}
      {glow && (
        <motion.span
          animate={{ opacity: hovered ? 1 : 0 }}
          className="absolute -inset-2 rounded-2xl bg-red-500/30 blur-xl pointer-events-none -z-10"
        />
      )}
      <span style={{ transform: 'translateZ(20px)' }} className="block">
        {children}
      </span>
    </motion.button>
  );
}
