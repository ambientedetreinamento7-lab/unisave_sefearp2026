export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-red">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 4h2l1.5 11h11.5l1.5-8H7"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9.5" cy="19.5" r="1.5" fill="white" />
          <circle cx="17" cy="19.5" r="1.5" fill="white" />
        </svg>
      </span>
      {!compact && (
        <div className="leading-tight text-left">
          <div className="text-lg font-extrabold text-navy">UniSave</div>
          <div className="text-[11px] font-medium text-brand-red">Universidade Savegnago</div>
        </div>
      )}
      {compact && <span className="font-bold tracking-tight">UniSave</span>}
    </div>
  )
}
