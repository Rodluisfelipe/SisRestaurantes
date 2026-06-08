/**
 * GradientText — texto con gradient animado (shimmer en idle).
 * Úsalo solo en una o dos palabras de un título para que llame la atención,
 * no en párrafos enteros.
 *
 * Variant:
 *   - sunrise: rojo → naranja → amber (default — coherente con la marca)
 *   - cosmic: violet → fuchsia → pink (acento futurista)
 *   - aurora: cyan → emerald → amber (más extraño, usar con moderación)
 */
const VARIANTS = {
  sunrise: 'bg-[linear-gradient(120deg,#ef4444_0%,#f97316_40%,#fbbf24_60%,#ef4444_100%)]',
  cosmic: 'bg-[linear-gradient(120deg,#8b5cf6_0%,#d946ef_40%,#ec4899_60%,#8b5cf6_100%)]',
  aurora: 'bg-[linear-gradient(120deg,#06b6d4_0%,#10b981_40%,#fbbf24_60%,#06b6d4_100%)]',
};

export default function GradientText({ children, variant = 'sunrise', className = '', as: Tag = 'span', animate = true }) {
  return (
    <Tag
      className={`inline-block bg-clip-text text-transparent ${VARIANTS[variant]} ${className}`}
      style={{
        backgroundSize: '200% 200%',
        animation: animate ? 'crewGradientShift 6s ease-in-out infinite' : undefined,
      }}
    >
      {children}
      {animate && (
        <style>{`
          @keyframes crewGradientShift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
        `}</style>
      )}
    </Tag>
  );
}
