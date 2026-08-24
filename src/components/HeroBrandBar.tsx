import { usePlatformSettings } from '../context/PlatformSettingsContext'

// All three are white/knockout marks meant to sit directly on the dark hero
// gradient (confirmed against the real files in public/logos/) — no card
// container needed, unlike the colored-on-white lockup assumed earlier.
export function HeroBrandBar({ compact = false }: { compact?: boolean }) {
  const { branding } = usePlatformSettings()

  return (
    <div className={`flex items-center ${compact ? 'justify-center' : 'justify-between'} gap-4`}>
      <div className="flex items-center gap-3">
        <img src={branding.logoUrl ?? '/logos/UniSave.png'} alt={branding.platformName ?? 'UniSave'} className="h-7 w-auto sm:h-8" />
        <div className="h-6 w-px bg-white/25" />
        <img src={branding.secondaryLogoUrl ?? '/logos/sefea.png'} alt="sefea Ribeirão Preto" className="h-7 w-auto sm:h-8" />
      </div>

      {!compact && <img src="/logos/grupo-savegnago.png" alt="Grupo Savegnago" className="h-8 w-auto sm:h-9" />}
    </div>
  )
}
