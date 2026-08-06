// public/logos/grupo-savegnago.svg is a real asset and renders correctly (it's
// a light/white mark, meant to sit on the dark hero gradient). unisave.svg and
// sefea.svg from that same drop only contain a near-invisible white-on-white
// trace each — open either file directly and the shape is there, but all
// color information was lost in whatever tool exported them, so both stay
// hand-recreated below until a working export is provided.
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

      {!compact && <img src="/logos/grupo-savegnago.svg" alt="Grupo Savegnago" className="h-8 w-auto" />}
    </div>
  )
}
