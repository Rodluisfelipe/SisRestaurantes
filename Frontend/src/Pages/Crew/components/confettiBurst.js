import confetti from 'canvas-confetti';

const CREW_COLORS = ['#EF4444', '#DC2626', '#F59E0B', '#10B981', '#3B82F6', '#FFFFFF'];

/**
 * Confetti rápido desde un punto específico (default: centro inferior).
 * Usado en: postular OK, complete booking, level up.
 */
export function burstConfetti({ origin = { x: 0.5, y: 0.7 }, particleCount = 80, spread = 70 } = {}) {
  confetti({
    particleCount,
    spread,
    origin,
    colors: CREW_COLORS,
    ticks: 200,
    gravity: 0.9,
    decay: 0.92,
    scalar: 1.05,
  });
}

/**
 * Lluvia de confetti más prolongada para celebrations grandes (level up).
 */
export function celebrate() {
  const end = Date.now() + 1500;
  const frame = () => {
    confetti({ particleCount: 5, angle: 60, spread: 65, origin: { x: 0, y: 0.6 }, colors: CREW_COLORS, ticks: 250 });
    confetti({ particleCount: 5, angle: 120, spread: 65, origin: { x: 1, y: 0.6 }, colors: CREW_COLORS, ticks: 250 });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}

/**
 * Cañón vertical desde la base — para acciones específicas como apply.
 */
export function cannon() {
  confetti({
    particleCount: 60,
    spread: 100,
    startVelocity: 55,
    origin: { x: 0.5, y: 0.95 },
    colors: CREW_COLORS,
    gravity: 1.2,
    ticks: 180,
  });
}
