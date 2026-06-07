import { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

/**
 * Card con efecto 3D parallax sutil al pasar el mouse (desktop).
 * En mobile no afecta (touch no tiene hover).
 */
export default function TiltCard({ children, maxTilt = 6, className = '', ...props }) {
  const ref = useRef(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const smx = useSpring(mx, { stiffness: 300, damping: 28 });
  const smy = useSpring(my, { stiffness: 300, damping: 28 });
  const rotateX = useTransform(smy, [-0.5, 0.5], [maxTilt, -maxTilt]);
  const rotateY = useTransform(smx, [-0.5, 0.5], [-maxTilt, maxTilt]);

  const onMouseMove = (e) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    mx.set(px);
    my.set(py);
  };
  const onMouseLeave = () => { mx.set(0); my.set(0); };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d', transformPerspective: 1000 }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
