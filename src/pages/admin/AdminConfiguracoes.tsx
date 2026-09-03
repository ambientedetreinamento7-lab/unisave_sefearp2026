import { useEffect, useState, type ReactNode } from 'react'
import { AdminLayout } from './AdminLayout'
import {
  getBrandingSettings,
  getCommunitySettings,
  getLegalSettings,
  getMaintenanceSettings,
  getModuleCompletionSettings,
  getSecuritySettings,
  getSessionSettings,
  getSignupSettings,
  getTrialSettings,
  updateBrandingSettings,
  updateCommunitySettings,
  updateLegalSettings,
  updateMaintenanceSettings,
  updateModuleCompletionSettings,
  updateSecuritySettings,
  updateSessionSettings,
  updateSignupSettings,
  updateTrialSettings,
} from '../../lib/settings'
import { supabase } from '../../lib/supabase'
import type {
  BrandingSettings,
  CommunitySettings,
  LegalSettings,
  MaintenanceSettings,
  ModuleCompletionSettings,
  SecuritySettings,
  SessionSettings,
  SignupSettings,
  TrialSettings,
} from '../../types/database'

async function uploadBrandingAsset(file: File): Promise<string> {
  const path = `branding/${crypto.randomUUID()}-${file.name}`
  const { error } = await supabase.storage.from('covers').upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/png',
  })
  if (error) throw error
  return supabase.storage.from('covers').getPublicUrl(path).data.publicUrl
}

export function AdminConfiguracoes() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <TrialSection />
        <BrandingSection />
        <SignupSection />
        <ModuleCompletionSection />
        <CommunitySection />
        <SessionSection />
        <SecuritySection />
        <LegalSection />
        <MaintenanceSection />
      </div>
    </AdminLayout>
  )
}

function SectionShell({
  title,
  description,
  loading,
  children,
  onSave,
  saving,
  saved,
}: {
  title: string
  description: string
  loading: boolean
  children: ReactNode
  onSave: () => void
  saving: boolean
  saved: boolean
}) {
  return (
    <div className="card max-w-lg p-5">
      <h2 className="font-bold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{description}</p>
      {loading ? (
        <p className="mt-4 text-sm text-ink-soft">Carregando…</p>
      ) : (
        <>
          {children}
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={onSave}
              disabled={saving}
              className="rounded-xl bg-brand-red px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-red-dark disabled:opacity-60"
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
            {saved && <span className="text-sm font-semibold text-success">Salvo!</span>}
          </div>
        </>
      )}
    </div>
  )
}

function TrialSection() {
  const [enabled, setEnabled] = useState(true)
  const [days, setDays] = useState(14)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getTrialSettings().then((s: TrialSettings) => {
      setEnabled(s.enabled)
      setDays(s.days)
      setLoading(false)
    })
  }, [])

  async function save() {
    setSaving(true)
    setSaved(false)
    await updateTrialSettings({ enabled, days })
    setSaving(false)
    setSaved(true)
  }

  return (
    <SectionShell
      title="Período de degustação"
      description="Contador exibido no cabeçalho pro aluno, contado a partir da data de cadastro dele."
      loading={loading}
      onSave={save}
      saving={saving}
      saved={saved}
    >
      <label className="mt-4 flex items-center gap-2 rounded-xl border border-navy-light p-3 text-sm font-medium text-ink">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Exibir contador de degustação para os alunos
      </label>

      <label className="mt-3 block text-xs font-semibold text-ink-soft">Duração (dias)</label>
      <input
        type="number"
        min={1}
        disabled={!enabled}
        className="mt-1 w-32 rounded-xl border border-navy-light px-4 py-2.5 disabled:opacity-50"
        value={days}
        onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
      />
    </SectionShell>
  )
}

function BrandingSection() {
  const [settings, setSettings] = useState<BrandingSettings | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [removeLogo, setRemoveLogo] = useState(false)
  const [secondaryLogoFile, setSecondaryLogoFile] = useState<File | null>(null)
  const [removeSecondaryLogo, setRemoveSecondaryLogo] = useState(false)
  const [loginBgFile, setLoginBgFile] = useState<File | null>(null)
  const [removeLoginBg, setRemoveLoginBg] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getBrandingSettings().then(setSettings)
  }, [])

  async function save() {
    if (!settings) return
    setSaving(true)
    setSaved(false)
    const logoUrl = logoFile ? await uploadBrandingAsset(logoFile) : removeLogo ? null : settings.logoUrl
    const secondaryLogoUrl = secondaryLogoFile
      ? await uploadBrandingAsset(secondaryLogoFile)
      : removeSecondaryLogo
        ? null
        : settings.secondaryLogoUrl
    const loginBackgroundImageUrl = loginBgFile
      ? await uploadBrandingAsset(loginBgFile)
      : removeLoginBg
        ? null
        : settings.loginBackgroundImageUrl
    const next = { ...settings, logoUrl, secondaryLogoUrl, loginBackgroundImageUrl }
    await updateBrandingSettings(next)
    setSettings(next)
    setLogoFile(null)
    setRemoveLogo(false)
    setSecondaryLogoFile(null)
    setRemoveSecondaryLogo(false)
    setLoginBgFile(null)
    setRemoveLoginBg(false)
    setSaving(false)
    setSaved(true)
  }

  return (
    <SectionShell
      title="Marca / identidade visual"
      description="Nome, logos e cores exibidos no cabeçalho e nas telas públicas. Deixe em branco para manter o padrão do projeto."
      loading={!settings}
      onSave={save}
      saving={saving}
      saved={saved}
    >
      {settings && (
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ink-soft">Nome da plataforma</label>
            <input
              className="mt-1 w-full rounded-xl border border-navy-light px-4 py-2.5 text-sm"
              placeholder="UniSave"
              value={settings.platformName ?? ''}
              onChange={(e) => setSettings({ ...settings, platformName: e.target.value || null })}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-soft">Logo principal</label>
            {settings.logoUrl && !logoFile && !removeLogo && (
              <div className="mt-1 flex items-center gap-2">
                <img src={settings.logoUrl} alt="" className="h-8 rounded border border-navy-light bg-navy p-1" />
                <button
                  type="button"
                  onClick={() => setRemoveLogo(true)}
                  className="text-xs font-semibold text-brand-red hover:underline"
                >
                  Remover
                </button>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                setLogoFile(e.target.files?.[0] ?? null)
                setRemoveLogo(false)
              }}
              className="mt-1 w-full text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-soft">Logo secundária</label>
            {settings.secondaryLogoUrl && !secondaryLogoFile && !removeSecondaryLogo && (
              <div className="mt-1 flex items-center gap-2">
                <img src={settings.secondaryLogoUrl} alt="" className="h-8 rounded border border-navy-light bg-navy p-1" />
                <button
                  type="button"
                  onClick={() => setRemoveSecondaryLogo(true)}
                  className="text-xs font-semibold text-brand-red hover:underline"
                >
                  Remover
                </button>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                setSecondaryLogoFile(e.target.files?.[0] ?? null)
                setRemoveSecondaryLogo(false)
              }}
              className="mt-1 w-full text-sm"
            />
          </div>

          <div className="flex gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-soft">Cor primária</label>
              <input
                type="color"
                className="mt-1 h-10 w-16 rounded-lg border border-navy-light"
                value={settings.primaryColor ?? '#373896'}
                onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-soft">Cor de destaque</label>
              <input
                type="color"
                className="mt-1 h-10 w-16 rounded-lg border border-navy-light"
                value={settings.accentColor ?? '#ed1c24'}
                onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
              />
            </div>
            {(settings.primaryColor || settings.accentColor) && (
              <button
                onClick={() => setSettings({ ...settings, primaryColor: null, accentColor: null })}
                className="self-end text-xs font-semibold text-ink-soft hover:underline"
              >
                Restaurar cores padrão
              </button>
            )}
          </div>

          <div className="border-t border-navy-light pt-4">
            <label className="block text-xs font-semibold text-ink-soft">Fundo da tela de login</label>
            <p className="mt-0.5 text-xs text-ink-soft">
              Sem imagem, a tela de login usa só o gradiente padrão. Com uma imagem, o gradiente vira uma camada de
              cor por cima dela — ajuste a intensidade abaixo.
            </p>
            {settings.loginBackgroundImageUrl && !loginBgFile && !removeLoginBg && (
              <div className="mt-2 flex items-center gap-2">
                <img src={settings.loginBackgroundImageUrl} alt="" className="h-16 rounded-lg border border-navy-light object-cover" />
                <button
                  type="button"
                  onClick={() => setRemoveLoginBg(true)}
                  className="text-xs font-semibold text-brand-red hover:underline"
                >
                  Remover
                </button>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                setLoginBgFile(e.target.files?.[0] ?? null)
                setRemoveLoginBg(false)
              }}
              className="mt-2 w-full text-sm"
            />

            {(settings.loginBackgroundImageUrl && !removeLoginBg) || loginBgFile ? (
              <div className="mt-3">
                <label className="block text-xs font-semibold text-ink-soft">
                  Intensidade da cor sobre a imagem — {settings.loginOverlayOpacity}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={settings.loginOverlayOpacity}
                  onChange={(e) => setSettings({ ...settings, loginOverlayOpacity: Number(e.target.value) })}
                  className="mt-1 w-full"
                />
              </div>
            ) : null}
          </div>
        </div>
      )}
    </SectionShell>
  )
}

function SignupSection() {
  const [settings, setSettings] = useState<SignupSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getSignupSettings().then(setSettings)
  }, [])

  async function save() {
    if (!settings) return
    setSaving(true)
    setSaved(false)
    await updateSignupSettings(settings)
    setSaving(false)
    setSaved(true)
  }

  return (
    <SectionShell
      title="Cadastro e acesso"
      description="Controla a página pública /estande, onde novos leads se cadastram e recebem o PDI inicial."
      loading={!settings}
      onSave={save}
      saving={saving}
      saved={saved}
    >
      {settings && (
        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 rounded-xl border border-navy-light p-3 text-sm font-medium text-ink">
            <input type="checkbox" checked={settings.open} onChange={(e) => setSettings({ ...settings, open: e.target.checked })} />
            Cadastros abertos
          </label>
          {!settings.open && (
            <div>
              <label className="block text-xs font-semibold text-ink-soft">Mensagem exibida com cadastros fechados</label>
              <textarea
                className="mt-1 w-full rounded-xl border border-navy-light px-4 py-2.5 text-sm"
                rows={2}
                value={settings.closedMessage}
                onChange={(e) => setSettings({ ...settings, closedMessage: e.target.value })}
              />
            </div>
          )}
          <label className="flex items-center gap-2 rounded-xl border border-navy-light p-3 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={settings.requireTermsAcceptance}
              onChange={(e) => setSettings({ ...settings, requireTermsAcceptance: e.target.checked })}
            />
            Exigir aceite dos Termos de Uso no cadastro
          </label>
          {settings.requireTermsAcceptance && (
            <p className="text-xs text-ink-soft">Configure o link dos Termos de Uso na seção "Legal / LGPD" abaixo.</p>
          )}

          <div className="border-t border-navy-light pt-3">
            <label className="block text-xs font-semibold text-ink-soft">Como novos cadastros são ativados</label>
            <div className="mt-2 space-y-2">
              <label className="flex items-start gap-2 rounded-xl border border-navy-light p-3 text-sm font-medium text-ink">
                <input
                  type="radio"
                  name="activationMethod"
                  className="mt-0.5"
                  checked={settings.activationMethod === 'magic_link'}
                  onChange={() => setSettings({ ...settings, activationMethod: 'magic_link' })}
                />
                <span>
                  Link mágico por e-mail
                  <span className="mt-0.5 block text-xs font-normal text-ink-soft">
                    O aluno recebe um e-mail e define a senha assim que clica no link (comportamento atual).
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 rounded-xl border border-navy-light p-3 text-sm font-medium text-ink">
                <input
                  type="radio"
                  name="activationMethod"
                  className="mt-0.5"
                  checked={settings.activationMethod === 'default_password'}
                  onChange={() => setSettings({ ...settings, activationMethod: 'default_password' })}
                />
                <span>
                  Senha padrão (Mudar@123)
                  <span className="mt-0.5 block text-xs font-normal text-ink-soft">
                    A conta já é criada com a senha "Mudar@123" e o aluno vai direto para uma tela de ativação, sem
                    depender de e-mail. Requer que a opção "Confirm email" esteja desligada no painel do Supabase
                    (Authentication → Settings) — senão o login com a senha padrão não funciona.
                  </span>
                </span>
              </label>
            </div>
          </div>
        </div>
      )}
    </SectionShell>
  )
}

function ModuleCompletionSection() {
  const [settings, setSettings] = useState<ModuleCompletionSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getModuleCompletionSettings().then(setSettings)
  }, [])

  async function save() {
    if (!settings) return
    setSaving(true)
    setSaved(false)
    await updateModuleCompletionSettings(settings)
    setSaving(false)
    setSaved(true)
  }

  return (
    <SectionShell
      title="Conclusão de módulo"
      description='Padrão usado por qualquer módulo de vídeo que não tenha um override próprio (em "Editar pílula", a opção "Padrão da plataforma").'
      loading={!settings}
      onSave={save}
      saving={saving}
      saved={saved}
    >
      {settings && (
        <label className="mt-4 flex items-center gap-2 rounded-xl border border-navy-light p-3 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={settings.allowManualCompletionDefault}
            onChange={(e) => setSettings({ ...settings, allowManualCompletionDefault: e.target.checked })}
          />
          Permitir concluir manualmente por padrão (em vez de exigir assistir o vídeo até o fim)
        </label>
      )}
    </SectionShell>
  )
}

function CommunitySection() {
  const [settings, setSettings] = useState<CommunitySettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getCommunitySettings().then(setSettings)
  }, [])

  async function save() {
    if (!settings) return
    setSaving(true)
    setSaved(false)
    await updateCommunitySettings(settings)
    setSaving(false)
    setSaved(true)
  }

  return (
    <SectionShell
      title="Comunidade e Ranking"
      description="Moderação de posts novos e visibilidade no ranking público."
      loading={!settings}
      onSave={save}
      saving={saving}
      saved={saved}
    >
      {settings && (
        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 rounded-xl border border-navy-light p-3 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={settings.requireModeration}
              onChange={(e) => setSettings({ ...settings, requireModeration: e.target.checked })}
            />
            Exigir aprovação antes de publicar posts novos
          </label>
          <p className="text-xs text-ink-soft">
            Posts pendentes aparecem em Comunidade → Posts, marcados como "Despublicado", com um botão "Publicar".
          </p>
          <label className="flex items-center gap-2 rounded-xl border border-navy-light p-3 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={settings.allowRankingOptOut}
              onChange={(e) => setSettings({ ...settings, allowRankingOptOut: e.target.checked })}
            />
            Permitir que o aluno saia do ranking público (opção em Meu Perfil)
          </label>
        </div>
      )}
    </SectionShell>
  )
}

function SessionSection() {
  const [settings, setSettings] = useState<SessionSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getSessionSettings().then(setSettings)
  }, [])

  async function save() {
    if (!settings) return
    setSaving(true)
    setSaved(false)
    await updateSessionSettings(settings)
    setSaving(false)
    setSaved(true)
  }

  return (
    <SectionShell
      title="Segurança de sessão"
      description="Desloga automaticamente quem ficar inativo além do tempo definido. Revogar sessões em outros dispositivos não está disponível (exigiria acesso de servidor)."
      loading={!settings}
      onSave={save}
      saving={saving}
      saved={saved}
    >
      {settings && (
        <div className="mt-4">
          <label className="flex items-center gap-2 rounded-xl border border-navy-light p-3 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={settings.inactivityTimeoutMinutes != null}
              onChange={(e) => setSettings({ ...settings, inactivityTimeoutMinutes: e.target.checked ? 30 : null })}
            />
            Deslogar automaticamente após inatividade
          </label>
          {settings.inactivityTimeoutMinutes != null && (
            <>
              <label className="mt-3 block text-xs font-semibold text-ink-soft">Minutos de inatividade</label>
              <input
                type="number"
                min={1}
                className="mt-1 w-32 rounded-xl border border-navy-light px-4 py-2.5"
                value={settings.inactivityTimeoutMinutes}
                onChange={(e) => setSettings({ ...settings, inactivityTimeoutMinutes: Math.max(1, Number(e.target.value) || 1) })}
              />
            </>
          )}
        </div>
      )}
    </SectionShell>
  )
}

function SecuritySection() {
  const [settings, setSettings] = useState<SecuritySettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getSecuritySettings().then(setSettings)
  }, [])

  async function save() {
    if (!settings) return
    if (!settings.magicLinkResetEnabled && !settings.birthDateResetEnabled) {
      setError('Pelo menos uma opção de recuperação de senha precisa ficar habilitada.')
      setSaved(false)
      return
    }
    setError('')
    setSaving(true)
    setSaved(false)
    await updateSecuritySettings(settings)
    setSaving(false)
    setSaved(true)
  }

  return (
    <SectionShell
      title="Segurança"
      description="Escolha quais formas de recuperação de senha ficam disponíveis para os alunos em /entrar. Pelo menos uma precisa ficar ativa."
      loading={!settings}
      onSave={save}
      saving={saving}
      saved={saved}
    >
      {settings && (
        <div className="mt-4 space-y-3">
          <label className="flex items-start gap-2 rounded-xl border border-navy-light p-3 text-sm font-medium text-ink">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={settings.magicLinkResetEnabled}
              onChange={(e) => setSettings({ ...settings, magicLinkResetEnabled: e.target.checked })}
            />
            <span>
              Recuperação por link mágico
              <span className="mt-0.5 block text-xs font-normal text-ink-soft">
                É o mesmo mecanismo usado no primeiro acesso — desativar remove também a aba "Link mágico" da tela
                de login.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 rounded-xl border border-navy-light p-3 text-sm font-medium text-ink">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={settings.birthDateResetEnabled}
              onChange={(e) => setSettings({ ...settings, birthDateResetEnabled: e.target.checked })}
            />
            <span>
              Recuperação por data de nascimento
              <span className="mt-0.5 block text-xs font-normal text-ink-soft">
                Tela /recuperar-senha — só funciona para alunos que já preencheram a data de nascimento no perfil.
              </span>
            </span>
          </label>
          {error && <p className="text-sm text-brand-red">{error}</p>}
        </div>
      )}
    </SectionShell>
  )
}

function LegalSection() {
  const [settings, setSettings] = useState<LegalSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getLegalSettings().then(setSettings)
  }, [])

  async function save() {
    if (!settings) return
    setSaving(true)
    setSaved(false)
    await updateLegalSettings(settings)
    setSaving(false)
    setSaved(true)
  }

  return (
    <SectionShell
      title="Legal / LGPD"
      description="Links dos documentos legais. Preencher o link dos Termos de Uso ativa a exigência de reaceite para todo mundo — trocar a versão força reaceite de novo."
      loading={!settings}
      onSave={save}
      saving={saving}
      saved={saved}
    >
      {settings && (
        <div className="mt-4 space-y-3">
          <p className="rounded-xl bg-lavender p-3 text-xs text-lavender-ink">
            Clique em "Usar página do app" para apontar cada link para um Termo de Uso e uma Política de Privacidade
            já redigidos dentro da plataforma (<code>/termos</code> e <code>/privacidade</code>). Antes de publicar,
            edite os arquivos <code>src/pages/public/Termos.tsx</code> e{' '}
            <code>src/pages/public/Privacidade.tsx</code> para substituir os campos entre colchetes (razão social,
            CNPJ e e-mail de contato) pelos dados reais da empresa.
          </p>
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-ink-soft">Link dos Termos de Uso</label>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, termsUrl: `${window.location.origin}/termos` })}
                className="text-xs font-semibold text-navy hover:underline"
              >
                Usar página do app
              </button>
            </div>
            <input
              className="mt-1 w-full rounded-xl border border-navy-light px-4 py-2.5 text-sm"
              placeholder="https://…"
              value={settings.termsUrl ?? ''}
              onChange={(e) => setSettings({ ...settings, termsUrl: e.target.value || null })}
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-ink-soft">Link da Política de Privacidade</label>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, privacyUrl: `${window.location.origin}/privacidade` })}
                className="text-xs font-semibold text-navy hover:underline"
              >
                Usar página do app
              </button>
            </div>
            <input
              className="mt-1 w-full rounded-xl border border-navy-light px-4 py-2.5 text-sm"
              placeholder="https://…"
              value={settings.privacyUrl ?? ''}
              onChange={(e) => setSettings({ ...settings, privacyUrl: e.target.value || null })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-soft">Versão dos termos</label>
            <input
              className="mt-1 w-32 rounded-xl border border-navy-light px-4 py-2.5 text-sm"
              value={settings.termsVersion}
              onChange={(e) => setSettings({ ...settings, termsVersion: e.target.value })}
            />
          </div>
        </div>
      )}
    </SectionShell>
  )
}

function MaintenanceSection() {
  const [settings, setSettings] = useState<MaintenanceSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getMaintenanceSettings().then(setSettings)
  }, [])

  async function save() {
    if (!settings) return
    setSaving(true)
    setSaved(false)
    await updateMaintenanceSettings(settings)
    setSaving(false)
    setSaved(true)
  }

  return (
    <SectionShell
      title="Modo manutenção"
      description="Bloqueia o acesso de alunos e moderadores com um aviso — administradores sempre continuam entrando, pra poder desligar de novo."
      loading={!settings}
      onSave={save}
      saving={saving}
      saved={saved}
    >
      {settings && (
        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 rounded-xl border border-navy-light p-3 text-sm font-medium text-ink">
            <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} />
            Ativar modo manutenção
          </label>
          <div>
            <label className="block text-xs font-semibold text-ink-soft">Mensagem exibida</label>
            <textarea
              className="mt-1 w-full rounded-xl border border-navy-light px-4 py-2.5 text-sm"
              rows={2}
              value={settings.message}
              onChange={(e) => setSettings({ ...settings, message: e.target.value })}
            />
          </div>
        </div>
      )}
    </SectionShell>
  )
}
