/**
 * CrewLogo — uses the actual LOGOCREW.svg asset with white fill for dark backgrounds.
 */
export default function CrewLogo({ size = 80, showText = true, className = '' }) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <img
        src="/crew-logo.svg"
        alt="Crew"
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: 'contain' }}
        draggable={false}
      />
      {showText && (
        <span
          className="font-black tracking-tight text-white mt-1"
          style={{ fontSize: size * 0.3 }}
        >
          crew
        </span>
      )}
    </div>
  );
}
