import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Lightweight confetti burst — pure CSS + Framer Motion.
 * Renders a fixed overlay of colourful particles that scatter and fade.
 * No external libraries needed.
 */

const PARTICLE_COUNT = 40;
const COLORS = ['#f97316', '#facc15', '#22c55e', '#3b82f6', '#ec4899', '#a855f7', '#ef4444', '#14b8a6'];
const SHAPES = ['circle', 'square', 'strip'];

const randomBetween = (a, b) => Math.random() * (b - a) + a;

const Particle = React.memo(({ color, shape, delay }) => {
  const style = useMemo(() => {
    const startX = randomBetween(30, 70); // % from left (concentrated center)
    const endX = startX + randomBetween(-35, 35);
    const startY = 40; // % from top — burst origin
    const endY = randomBetween(-10, 95);
    const size = shape === 'strip' ? { w: randomBetween(3, 6), h: randomBetween(14, 24) } : { w: randomBetween(6, 12), h: randomBetween(6, 12) };
    const rotation = randomBetween(0, 720);

    return { startX, startY, endX, endY, size, rotation, color };
  }, [color, shape]);

  return (
    <motion.div
      initial={{
        left: `${style.startX}%`,
        top: `${style.startY}%`,
        opacity: 1,
        scale: 0,
        rotate: 0,
      }}
      animate={{
        left: `${style.endX}%`,
        top: `${style.endY}%`,
        opacity: [1, 1, 0],
        scale: [0, 1.2, 0.8],
        rotate: style.rotation,
      }}
      transition={{
        duration: randomBetween(1, 1.8),
        delay: delay,
        ease: [0.16, 1, 0.3, 1], // expressive ease-out
      }}
      className="absolute pointer-events-none"
      style={{
        width: style.size.w,
        height: style.size.h,
        backgroundColor: style.color,
        borderRadius: shape === 'circle' ? '50%' : shape === 'strip' ? '2px' : '2px',
      }}
    />
  );
});

Particle.displayName = 'Particle';

const ConfettiBurst = ({ show, onComplete }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  const particles = useMemo(() =>
    Array.from({ length: PARTICLE_COUNT }).map((_, i) => ({
      id: i,
      color: COLORS[i % COLORS.length],
      shape: SHAPES[i % SHAPES.length],
      delay: randomBetween(0, 0.3),
    })),
  []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9998] pointer-events-none overflow-hidden"
        >
          {particles.map(p => (
            <Particle key={p.id} color={p.color} shape={p.shape} delay={p.delay} />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ConfettiBurst;
