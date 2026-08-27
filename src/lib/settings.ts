import { supabase } from './supabase'
import type {
  BrandingSettings,
  CommunitySettings,
  LegalSettings,
  MaintenanceSettings,
  ModuleCompletionSettings,
  SessionSettings,
  SignupSettings,
  TrialSettings,
} from '../types/database'

// Nunca deixa uma falha de rede/Supabase travar quem está esperando essas
// configurações (ex.: PlatformSettingsContext no topo do app, que se
// pendurasse aqui bloquearia toda rota autenticada) — qualquer erro cai
// pro mesmo default de "linha ainda não existe".
async function getAppSetting<T>(key: string, defaults: T): Promise<T> {
  try {
    const { data } = await supabase.from('app_settings').select('value').eq('key', key).maybeSingle()
    if (!data) return defaults
    return { ...defaults, ...(data.value as Partial<T>) }
  } catch {
    return defaults
  }
}

const DEFAULT_TRIAL: TrialSettings = { enabled: true, days: 14 }

export async function getTrialSettings(): Promise<TrialSettings> {
  return getAppSetting('trial', DEFAULT_TRIAL)
}

export async function updateTrialSettings(settings: TrialSettings) {
  await supabase.from('app_settings').upsert({ key: 'trial', value: settings })
}

const DEFAULT_BRANDING: BrandingSettings = {
  platformName: null,
  logoUrl: null,
  secondaryLogoUrl: null,
  primaryColor: null,
  accentColor: null,
  loginBackgroundImageUrl: null,
  loginOverlayOpacity: 70,
}

export async function getBrandingSettings(): Promise<BrandingSettings> {
  return getAppSetting('branding', DEFAULT_BRANDING)
}

export async function updateBrandingSettings(settings: BrandingSettings) {
  await supabase.from('app_settings').upsert({ key: 'branding', value: settings })
}

const DEFAULT_SIGNUP: SignupSettings = {
  open: true,
  closedMessage: 'Os cadastros estão temporariamente encerrados. Volte em breve.',
  requireTermsAcceptance: false,
}

export async function getSignupSettings(): Promise<SignupSettings> {
  return getAppSetting('signup', DEFAULT_SIGNUP)
}

export async function updateSignupSettings(settings: SignupSettings) {
  await supabase.from('app_settings').upsert({ key: 'signup', value: settings })
}

const DEFAULT_MODULE_COMPLETION: ModuleCompletionSettings = { allowManualCompletionDefault: false }

export async function getModuleCompletionSettings(): Promise<ModuleCompletionSettings> {
  return getAppSetting('module_completion', DEFAULT_MODULE_COMPLETION)
}

export async function updateModuleCompletionSettings(settings: ModuleCompletionSettings) {
  await supabase.from('app_settings').upsert({ key: 'module_completion', value: settings })
}

const DEFAULT_COMMUNITY: CommunitySettings = { requireModeration: false, allowRankingOptOut: false }

export async function getCommunitySettings(): Promise<CommunitySettings> {
  return getAppSetting('community', DEFAULT_COMMUNITY)
}

export async function updateCommunitySettings(settings: CommunitySettings) {
  await supabase.from('app_settings').upsert({ key: 'community', value: settings })
}

const DEFAULT_SESSION: SessionSettings = { inactivityTimeoutMinutes: null }

export async function getSessionSettings(): Promise<SessionSettings> {
  return getAppSetting('session', DEFAULT_SESSION)
}

export async function updateSessionSettings(settings: SessionSettings) {
  await supabase.from('app_settings').upsert({ key: 'session', value: settings })
}

const DEFAULT_LEGAL: LegalSettings = { termsUrl: null, privacyUrl: null, termsVersion: '1' }

export async function getLegalSettings(): Promise<LegalSettings> {
  return getAppSetting('legal', DEFAULT_LEGAL)
}

export async function updateLegalSettings(settings: LegalSettings) {
  await supabase.from('app_settings').upsert({ key: 'legal', value: settings })
}

const DEFAULT_MAINTENANCE: MaintenanceSettings = {
  enabled: false,
  message: 'A plataforma está em manutenção. Volte em breve.',
}

export async function getMaintenanceSettings(): Promise<MaintenanceSettings> {
  return getAppSetting('maintenance', DEFAULT_MAINTENANCE)
}

export async function updateMaintenanceSettings(settings: MaintenanceSettings) {
  await supabase.from('app_settings').upsert({ key: 'maintenance', value: settings })
}
