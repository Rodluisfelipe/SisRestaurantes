/**
 * CrewLogo — SVG logo component for Crew branding.
 * Reproduces the iconic "C" with cap + "crew" wordmark.
 */
export default function CrewLogo({ size = 80, showText = true, className = '' }) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* C with cap icon */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Main C letter */}
        <path
          d="M85 38C79.5 28 69 22 57 22C39 22 24 37 24 55C24 73 39 88 57 88C69 88 79.5 82 85 72"
          stroke="white"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* Smile arc under C */}
        <path
          d="M38 96C38 96 48 104 60 104C72 104 82 96 82 96"
          stroke="white"
          strokeWidth="7"
          strokeLinecap="round"
        />
        {/* Cap brim */}
        <ellipse
          cx="57"
          cy="18"
          rx="22"
          ry="6"
          fill="white"
        />
        {/* Cap dome */}
        <path
          d="M42 18C42 18 44 6 57 6C70 6 72 18 72 18"
          fill="white"
        />
        {/* Cap button */}
        <circle cx="57" cy="5" r="3" fill="white" />
      </svg>

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
