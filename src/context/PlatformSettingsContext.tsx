import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useTheme } from './ThemeContext'
import {
  getBrandingSettings,
  getCourseDefaultsSettings,
  getLegalSettings,
  getMaintenanceSettings,
  getPdiTabsSettings,
  getPwaSettings,
  getSecuritySettings,
  getSessionSettings,
} from '../lib/settings'
import type {
  BrandingSettings,
  CourseDefaultsSettings,
  LegalSettings,
  MaintenanceSettings,
  PdiTabsSettings,
  PwaSettings,
  SecuritySettings,
  SessionSettings,
} from '../types/database'

interface PlatformSettingsValue {
  branding: BrandingSettings
  legal: LegalSettings
  maintenance: MaintenanceSettings
  session: SessionSettings
  security: SecuritySettings
  pwa: PwaSettings
  courseDefaults: CourseDefaultsSettings
  pdiTabs: PdiTabsSettings
  loading: boolean
}

const DEFAULTS: Omit<PlatformSettingsValue, 'loading'> = {
  branding: {
    platformName: null,
    logoUrl: null,
    secondaryLogoUrl: null,
    primaryColor: null,
    accentColor: null,
    loginBackgroundImageUrl: null,
    loginOverlayOpacity: 70,
  },
  legal: { termsUrl: null, privacyUrl: null, termsVersion: '1' },
  maintenance: { enabled: false, message: '' },
  session: { inactivityTimeoutMinutes: null },
  security: { magicLinkResetEnabled: true, birthDateResetEnabled: true },
  pwa: { installableEnabled: false },
  courseDefaults: { courseCoverUrl: null, courseThumbnailUrl: null, lessonCoverUrl: null, lessonThumbnailUrl: null },
  pdiTabs: { hideBalanco: false, hideBiblioteca: false },
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
  const { theme } = useTheme()

  useEffect(() => {
    Promise.all([
      getBrandingSettings(),
      getLegalSettings(),
      getMaintenanceSettings(),
      getSessionSettings(),
      getSecuritySettings(),
      getPwaSettings(),
      getCourseDefaultsSettings(),
      getPdiTabsSettings(),
    ]).then(
      ([branding, legal, maintenance, session, security, pwa, courseDefaults, pdiTabs]) => {
        setValue({ branding, legal, maintenance, session, security, pwa, courseDefaults, pdiTabs })
        setLoading(false)
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

  useEffect(() => {
    // Sobrescreve os tokens de cor em runtime (definidos em index.css) só
    // quando o admin configurou algo E só no tema claro — a cor de marca é
    // escolhida pensando em fundo claro (ex.: o navy oficial #373896), e
    // travá-la também no escuro via style inline (que sempre vence a regra
    // `:root[data-theme='dark']` do CSS) deixava texto escuro-sobre-escuro
    // ilegível em toda a plataforma. No escuro, usa a paleta já ajustada
    // pra contraste em index.css em vez da cor de marca crua.
    const root = document.documentElement
    if (theme === 'light' && value.branding.primaryColor) {
      root.style.setProperty('--color-navy', value.branding.primaryColor)
    } else {
      root.style.removeProperty('--color-navy')
    }
    if (theme === 'light' && value.branding.accentColor) {
      root.style.setProperty('--color-brand-red', value.branding.accentColor)
    } else {
      root.style.removeProperty('--color-brand-red')
    }
  }, [theme, value.branding.primaryColor, value.branding.accentColor])

  return (
    <PlatformSettingsContext.Provider value={{ ...value, loading }}>{children}</PlatformSettingsContext.Provider>
  )
}

export function usePlatformSettings() {
  const ctx = useContext(PlatformSettingsContext)
  if (!ctx) throw new Error('usePlatformSettings must be used within PlatformSettingsProvider')
  return ctx
}
