import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { useAuth } from '../../context/AuthContext'
import { usePlatformSettings } from '../../context/PlatformSettingsContext'
import { supabase } from '../../lib/supabase'

export function AceitarTermos() {
  const { profile, refreshProfile, signOut } = useAuth()
  const { legal } = usePlatformSettings()
  const navigate = useNavigate()
  const [checked, setChecked] = useState(false)
  const [saving, setSaving] = useState(false)

  async function accept() {
    if (!profile) return
    setSaving(true)
    await supabase
      .from('profiles')
      .update({ terms_accepted_version: legal.termsVersion, terms_accepted_at: new Date().toISOString() })
      .eq('id', profile.id)
    await refreshProfile()
    setSaving(false)
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="min-h-screen bg-bg pb-16">
      <AppHeader />
      <main className="mx-auto max-w-lg px-4 py-10">
        <div className="card p-8 text-center">
          <span className="text-3xl">📄</span>
          <h1 className="mt-3 text-xl font-extrabold text-ink">Atualizamos nossos termos</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Pra continuar usando a plataforma, você precisa ler e aceitar os documentos abaixo.
          </p>

          <div className="mt-5 space-y-2 text-left text-sm">
            {legal.termsUrl && (
              <a href={legal.termsUrl} target="_blank" rel="noreferrer" className="block font-semibold text-navy hover:underline">
                Ler os Termos de Uso →
              </a>
            )}
            {legal.privacyUrl && (
              <a href={legal.privacyUrl} target="_blank" rel="noreferrer" className="block font-semibold text-navy hover:underline">
                Ler a Política de Privacidade →
              </a>
            )}
          </div>

          <label className="mt-5 flex items-start gap-2 text-left text-sm font-medium text-ink">
            <input type="checkbox" className="mt-0.5" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            Li e aceito os Termos de Uso{legal.privacyUrl ? ' e a Política de Privacidade' : ''}.
          </label>

          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={accept}
              disabled={!checked || saving}
              className="rounded-xl bg-brand-red py-2.5 font-bold text-white hover:bg-brand-red-dark disabled:opacity-50"
            >
              {saving ? 'Salvando…' : 'Aceitar e continuar'}
            </button>
            <button onClick={() => signOut()} className="text-xs font-semibold text-ink-soft hover:underline">
              Não aceito, sair da conta
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
