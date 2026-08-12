import { supabase } from './supabase'
import type { TrialSettings } from '../types/database'

const DEFAULT_TRIAL: TrialSettings = { enabled: true, days: 14 }

export async function getTrialSettings(): Promise<TrialSettings> {
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'trial').maybeSingle()
  if (!data) return DEFAULT_TRIAL
  const value = data.value as Partial<TrialSettings>
  return { enabled: value.enabled ?? DEFAULT_TRIAL.enabled, days: value.days ?? DEFAULT_TRIAL.days }
}

export async function updateTrialSettings(settings: TrialSettings) {
  await supabase.from('app_settings').upsert({ key: 'trial', value: settings })
}
