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
  sunrise: 'bg-[linear-gradient(120deg,#dc2626_0%,#ef4444_40%,#ffffff_60%,#dc2626_100%)]',
  cosmic: 'bg-[linear-gradient(120deg,#ffffff_0%,#ef4444_40%,#dc2626_60%,#ffffff_100%)]',
  aurora: 'bg-[linear-gradient(120deg,#ef4444_0%,#f87171_40%,#fca5a5_60%,#ef4444_100%)]',
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
