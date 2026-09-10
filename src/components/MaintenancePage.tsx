export function MaintenancePage({ message }: { message: string }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4 py-8">
      <div
        className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full opacity-10"
        style={{ background: 'var(--color-navy)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-28 -right-28 h-64 w-64 rounded-full opacity-10"
        style={{ background: 'var(--color-brand-red)' }}
      />

      <div className="card relative w-full max-w-md overflow-hidden text-center">
        <div className="flex items-center justify-center gap-2.5 pt-7">
          <span className="text-[15px] font-extrabold tracking-tight text-navy">UniSave</span>
          <span className="h-4 w-px bg-navy-light" />
          <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">SEFEARP</span>
        </div>

        <div className="relative mt-2 flex h-[220px] items-center justify-center">
          <div className="mp-blob absolute h-[220px] w-[260px]" />
          <svg className="relative w-[190px]" viewBox="0 0 190 200" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="mpDesk" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#e3e4f2" />
              </linearGradient>
              <linearGradient id="mpMonitor" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#d7d8ec" />
              </linearGradient>
              <radialGradient id="mpSkin" cx="35%" cy="30%" r="75%">
                <stop offset="0%" stopColor="#ffd9b3" />
                <stop offset="100%" stopColor="#eeab77" />
              </radialGradient>
              <linearGradient id="mpHoodie" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ff5b52" />
                <stop offset="100%" stopColor="#c9151b" />
              </linearGradient>
              <radialGradient id="mpShadow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#0b0c22" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#0b0c22" stopOpacity="0" />
              </radialGradient>
            </defs>
            <ellipse cx="95" cy="172" rx="50" ry="10" fill="url(#mpShadow)" />
            <g className="mp-bob" style={{ filter: 'drop-shadow(0 8px 8px rgba(11,12,34,0.25))' }}>
              <rect x="55" y="150" width="80" height="16" rx="4" fill="url(#mpDesk)" />
              <rect x="60" y="108" width="70" height="46" rx="6" fill="url(#mpMonitor)" />
              <rect x="60" y="108" width="70" height="4" rx="2" fill="#ffffff" />
              <rect x="68" y="116" width="54" height="30" rx="2" fill="#0e0f26" />
              <rect x="75" y="123" width="20" height="4" rx="2" fill="#ed1c24" />
              <rect x="75" y="131" width="32" height="4" rx="2" fill="#ffffff" opacity="0.85" />
              <rect className="mp-cursor" x="75" y="139" width="10" height="4" fill="#ffffff" />
              <circle cx="95" cy="72" r="24" fill="url(#mpSkin)" />
              <ellipse cx="87" cy="63" rx="7" ry="4.5" fill="#ffffff" opacity="0.4" />
              <path d="M71 66 a24 24 0 0 1 48 0 q0 -20 -24 -22 q-24 2 -24 22 Z" fill="#ffffff" opacity="0.95" />
              <rect x="72" y="88" width="46" height="26" rx="13" fill="url(#mpHoodie)" />
              <path d="M76 90 q19 -6 38 0 q-19 12 -38 0 Z" fill="#ffffff" opacity="0.2" />
            </g>
          </svg>
        </div>

        <h1 className="mx-6 mt-6 text-xl font-extrabold text-ink">Plataforma em manutenção</h1>
        <p className="mx-6 mt-2 text-sm leading-relaxed text-ink-soft">{message}</p>

        <div className="mt-5 flex items-center justify-center gap-1.5 pb-8">
          <span className="mp-dot h-1.5 w-1.5 rounded-full bg-navy" />
          <span className="mp-dot h-1.5 w-1.5 rounded-full bg-brand-red" style={{ animationDelay: '0.15s' }} />
          <span className="mp-dot h-1.5 w-1.5 rounded-full bg-navy" style={{ animationDelay: '0.3s' }} />
        </div>
      </div>
    </div>
  )
}
