import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  getBrandingSettings,
  getLegalSettings,
  getMaintenanceSettings,
  getSessionSettings,
} from '../lib/settings'
import type { BrandingSettings, LegalSettings, MaintenanceSettings, SessionSettings } from '../types/database'

interface PlatformSettingsValue {
  branding: BrandingSettings
  legal: LegalSettings
  maintenance: MaintenanceSettings
  session: SessionSettings
  loading: boolean
}

const DEFAULTS: Omit<PlatformSettingsValue, 'loading'> = {
  branding: { platformName: null, logoUrl: null, secondaryLogoUrl: null, primaryColor: null, accentColor: null },
  legal: { termsUrl: null, privacyUrl: null, termsVersion: '1' },
  maintenance: { enabled: false, message: '' },
  session: { inactivityTimeoutMinutes: null },
}

const PlatformSettingsContext = createContext<PlatformSettingsValue | undefined>(undefined)

/**
 * Carrega uma vez, no topo do app (fora do AuthProvider — precisa valer em
 * páginas públicas como /entrar e /estande também), as configurações de
 * Configurações → Marca/Legal/Manutenção/Sessão que outras partes do app
 * precisam ler sem refazer a mesma query em cada componente.
 */
export function PlatformSettingsProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<Omit<PlatformSettingsValue, 'loading'>>(DEFAULTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getBrandingSettings(), getLegalSettings(), getMaintenanceSettings(), getSessionSettings()]).then(
      ([branding, legal, maintenance, session]) => {
        setValue({ branding, legal, maintenance, session })
        setLoading(false)
        // Sobrescreve os tokens de cor em runtime (definidos em index.css)
        // só quando o admin configurou algo — sem isso, continua com a
        // paleta navy/vermelho padrão do projeto.
        if (branding.primaryColor) document.documentElement.style.setProperty('--color-navy', branding.primaryColor)
        if (branding.accentColor) document.documentElement.style.setProperty('--color-brand-red', branding.accentColor)
        if (branding.platformName) document.title = branding.platformName
      },
    ).catch(() => {
      // Os getters já engolem erro de rede e caem pro default sozinhos —
      // isso aqui só existe pra nunca deixar loading travado em true se
      // algo totalmente inesperado acontecer (ex.: falha só em um dos
      // 4 fetches em paralelo, o Promise.all rejeitaria o conjunto).
      setLoading(false)
    })
  }, [])

  return (
    <PlatformSettingsContext.Provider value={{ ...value, loading }}>{children}</PlatformSettingsContext.Provider>
  )
}

export function usePlatformSettings() {
  const ctx = useContext(PlatformSettingsContext)
  if (!ctx) throw new Error('usePlatformSettings must be used within PlatformSettingsProvider')
  return ctx
}
