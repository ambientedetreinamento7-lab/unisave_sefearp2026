// Recreated visually from reference screenshots (no original vector/PNG files were
// available to embed) — swap for real <img> assets in public/logos/ if provided.
export function HeroBrandBar({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center ${compact ? 'justify-center' : 'justify-between'} gap-4`}>
      <div className="flex items-center gap-2 rounded-2xl bg-white p-2.5 shadow-lg">
        <div className="flex items-center gap-1.5 px-1">
          <svg width="22" height="18" viewBox="0 0 26 20" fill="none">
            <path
              d="M2 2h3l1 3M6 5h17l-2 8H8L6 5Zm0 0-1-3"
              stroke="#8a1030"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="10" cy="17" r="1.6" fill="#8a1030" />
            <circle cx="18" cy="17" r="1.6" fill="#8a1030" />
          </svg>
          <span className="leading-none">
            <span className="block text-[13px] font-extrabold text-navy">UniSave</span>
            <span className="block text-[7px] font-semibold uppercase tracking-wide text-brand-red">
              Universidade Savegnago
            </span>
          </span>
        </div>
        <div className="h-7 w-px bg-navy-light" />
        <div className="flex items-center gap-1.5 px-1">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-slate-400 to-slate-600 text-[11px] font-black text-white">
            S
          </span>
          <span className="leading-tight">
            <span className="block text-[12px] font-bold text-ink">sefea</span>
            <span className="block text-[7px] font-semibold uppercase tracking-wide text-ink-soft">
              Ribeirão Preto
            </span>
          </span>
        </div>
      </div>

      {!compact && (
        <div className="flex items-center gap-2 text-white/90">
          <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
            <ellipse cx="16" cy="16" rx="14.5" ry="9.5" stroke="currentColor" strokeWidth="1.3" />
            <path
              d="M9 18h14l-1.5-4.5a2 2 0 0 0-1.9-1.4h-7.2a2 2 0 0 0-1.9 1.4L9 18Z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
            <circle cx="12.5" cy="18.5" r="1.3" fill="currentColor" />
            <circle cx="19.5" cy="18.5" r="1.3" fill="currentColor" />
          </svg>
          <span className="text-[10.5px] font-bold leading-tight">
            GRUPO
            <br />
            <span className="text-[13px]">Savegnago</span>
          </span>
        </div>
      )}
    </div>
  )
}
