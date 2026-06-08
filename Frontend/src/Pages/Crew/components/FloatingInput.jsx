/**
 * FloatingInput — input con label que flota al enfocar/llenar.
 * Estética cosmic: vidrio sutil, glow rojo al focus, label que se desliza arriba.
 *
 * Props:
 *   label, value, onChange (recibe el valor directo, no el evento)
 *   type, autoComplete, required, name, error, prefix (ej: "+57")
 */
import { useId, useState } from 'react';

export default function FloatingInput({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  required,
  name,
  error,
  prefix,
  maxLength,
}) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const floats = focused || (value && String(value).length > 0);
  const isPwd = type === 'password';
  const [showPwd, setShowPwd] = useState(false);
  const actualType = isPwd && showPwd ? 'text' : type;

  return (
    <div className="relative">
      <div
        className={`
          relative flex items-center w-full rounded-2xl border transition-all duration-200
          ${error
            ? 'border-red-400/60 bg-red-500/[0.06]'
            : focused
              ? 'border-red-500/70 bg-white/[0.08] shadow-[0_0_0_4px_rgba(239,68,68,0.12)]'
              : 'border-white/[0.10] bg-white/[0.04] hover:border-white/[0.18]'}
        `}
      >
        {prefix && (
          <span className="pl-4 text-[14px] font-bold text-white/60 tabular-nums">{prefix}</span>
        )}
        <input
          id={id}
          name={name}
          type={actualType}
          autoComplete={autoComplete}
          required={required}
          maxLength={maxLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder=""
          className="peer w-full bg-transparent text-[15px] font-medium text-white placeholder-transparent focus:outline-none px-4 pt-6 pb-2.5"
        />
        <label
          htmlFor={id}
          className={`
            absolute pointer-events-none transition-all duration-200 origin-left
            ${prefix ? 'left-[3.4rem]' : 'left-4'}
            ${floats
              ? 'top-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/50'
              : 'top-1/2 -translate-y-1/2 text-[15px] font-medium text-white/40'}
          `}
        >
          {label}
        </label>

        {isPwd && (
          <button
            type="button"
            onClick={() => setShowPwd((s) => !s)}
            className="mr-2 p-2 text-white/40 hover:text-white/70 transition rounded-lg"
            aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            tabIndex={-1}
          >
            {showPwd ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
        )}
      </div>
      {error && <p className="mt-1.5 text-[11px] font-medium text-red-300 pl-1">{error}</p>}
    </div>
  );
}
