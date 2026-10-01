import { useEffect, useState, type ReactNode } from 'react'
import { AdminLayout } from './AdminLayout'
import {
  getAnnouncementSettings,
  getBrandingSettings,
  getCommunitySettings,
  getCourseDefaultsSettings,
  getCourseIntegritySettings,
  getLegalSettings,
  getMaintenanceSettings,
  getModuleCompletionSettings,
  getPdiTabsSettings,
  getPwaSettings,
  getSecuritySettings,
  getSessionSettings,
  getSignupSettings,
  getTrialSettings,
  getTvPanelSettings,
  updateAnnouncementSettings,
  updateBrandingSettings,
  updateCommunitySettings,
  updateCourseDefaultsSettings,
  updateCourseIntegritySettings,
  updateLegalSettings,
  updateMaintenanceSettings,
  updateModuleCompletionSettings,
  updatePdiTabsSettings,
  updatePwaSettings,
  updateSecuritySettings,
  updateSessionSettings,
  updateSignupSettings,
  updateTrialSettings,
  updateTvPanelSettings,
} from '../../lib/settings'
import { sanitizeFileName } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type {
  AnnouncementBannerSettings,
  BrandingSettings,
  CommunitySettings,
  CourseDefaultsSettings,
  CourseIntegritySettings,
  LegalSettings,
  MaintenanceSettings,
  ModuleCompletionSettings,
  PdiTabsSettings,
  PwaSettings,
  SecuritySettings,
  SessionSettings,
  SignupSettings,
  TrialSettings,
  TvPanelSettings,
} from '../../types/database'

async function uploadBrandingAsset(file: File, folder = 'branding'): Promise<string> {
  const path = `${folder}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`
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
        <CourseDefaultsSection />
        <CourseIntegritySection />
        <AnnouncementSection />
        <SignupSection />
        <ModuleCompletionSection />
        <CommunitySection />
        <SessionSection />
        <SecuritySection />
        <LegalSection />
        <MaintenanceSection />
        <PwaSection />
        <PdiTabsSection />
        <TvPanelSection />
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

function CourseImageField({
  label,
  url,
  file,
  removed,
  onFile,
  onRemove,
}: {
  label: string
  url: string | null
  file: File | null
  removed: boolean
  onFile: (file: File | null) => void
  onRemove: () => void
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-ink-soft">{label}</label>
      {url && !file && !removed && (
        <div className="mt-1 flex items-center gap-2">
          <img src={url} alt="" className="h-14 w-24 rounded-lg border border-navy-light object-cover" />
          <button type="button" onClick={onRemove} className="text-xs font-semibold text-brand-red hover:underline">
            Remover
          </button>
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        className="mt-1 w-full text-sm"
      />
    </div>
  )
}

function CourseDefaultsSection() {
  const [settings, setSettings] = useState<CourseDefaultsSettings | null>(null)
  const [courseCoverFile, setCourseCoverFile] = useState<File | null>(null)
  const [removeCourseCover, setRemoveCourseCover] = useState(false)
  const [courseThumbFile, setCourseThumbFile] = useState<File | null>(null)
  const [removeCourseThumb, setRemoveCourseThumb] = useState(false)
  const [lessonCoverFile, setLessonCoverFile] = useState<File | null>(null)
  const [removeLessonCover, setRemoveLessonCover] = useState(false)
  const [lessonThumbFile, setLessonThumbFile] = useState<File | null>(null)
  const [removeLessonThumb, setRemoveLessonThumb] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getCourseDefaultsSettings().then(setSettings)
  }, [])

  async function save() {
    if (!settings) return
    setSaving(true)
    setSaved(false)
    const courseCoverUrl = courseCoverFile
      ? await uploadBrandingAsset(courseCoverFile, 'course-defaults')
      : removeCourseCover
        ? null
        : settings.courseCoverUrl
    const courseThumbnailUrl = courseThumbFile
      ? await uploadBrandingAsset(courseThumbFile, 'course-defaults')
      : removeCourseThumb
        ? null
        : settings.courseThumbnailUrl
    const lessonCoverUrl = lessonCoverFile
      ? await uploadBrandingAsset(lessonCoverFile, 'course-defaults')
      : removeLessonCover
        ? null
        : settings.lessonCoverUrl
    const lessonThumbnailUrl = lessonThumbFile
      ? await uploadBrandingAsset(lessonThumbFile, 'course-defaults')
      : removeLessonThumb
        ? null
        : settings.lessonThumbnailUrl
    const next = { ...settings, courseCoverUrl, courseThumbnailUrl, lessonCoverUrl, lessonThumbnailUrl }
    await updateCourseDefaultsSettings(next)
    setSettings(next)
    setCourseCoverFile(null)
    setRemoveCourseCover(false)
    setCourseThumbFile(null)
    setRemoveCourseThumb(false)
    setLessonCoverFile(null)
    setRemoveLessonCover(false)
    setLessonThumbFile(null)
    setRemoveLessonThumb(false)
    setSaving(false)
    setSaved(true)
  }

  return (
    <SectionShell
      title="Imagens padrão de cursos e aulas"
      description='Usadas quando um curso ou uma aula específica não tem capa/miniatura própria. Sem nada definido aqui, o card continua preenchido só com uma cor sortida, como hoje.'
      loading={!settings}
      onSave={save}
      saving={saving}
      saved={saved}
    >
      {settings && (
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Cursos</p>
            <div className="mt-2 space-y-3">
              <CourseImageField
                label="Capa padrão do curso"
                url={settings.courseCoverUrl}
                file={courseCoverFile}
                removed={removeCourseCover}
                onFile={(f) => {
                  setCourseCoverFile(f)
                  setRemoveCourseCover(false)
                }}
                onRemove={() => setRemoveCourseCover(true)}
              />
              <CourseImageField
                label="Miniatura padrão do curso"
                url={settings.courseThumbnailUrl}
                file={courseThumbFile}
                removed={removeCourseThumb}
                onFile={(f) => {
                  setCourseThumbFile(f)
                  setRemoveCourseThumb(false)
                }}
                onRemove={() => setRemoveCourseThumb(true)}
              />
            </div>
          </div>

          <div className="border-t border-navy-light pt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Aulas</p>
            <div className="mt-2 space-y-3">
              <CourseImageField
                label="Capa padrão da aula"
                url={settings.lessonCoverUrl}
                file={lessonCoverFile}
                removed={removeLessonCover}
                onFile={(f) => {
                  setLessonCoverFile(f)
                  setRemoveLessonCover(false)
                }}
                onRemove={() => setRemoveLessonCover(true)}
              />
              <CourseImageField
                label="Miniatura padrão da aula"
                url={settings.lessonThumbnailUrl}
                file={lessonThumbFile}
                removed={removeLessonThumb}
                onFile={(f) => {
                  setLessonThumbFile(f)
                  setRemoveLessonThumb(false)
                }}
                onRemove={() => setRemoveLessonThumb(true)}
              />
            </div>
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

function CourseIntegritySection() {
  const [settings, setSettings] = useState<CourseIntegritySettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getCourseIntegritySettings().then(setSettings)
  }, [])

  async function save() {
    if (!settings) return
    setSaving(true)
    setSaved(false)
    await updateCourseIntegritySettings(settings)
    setSaving(false)
    setSaved(true)
  }

  return (
    <SectionShell
      title="Integridade de conclusão de curso"
      description="Trava o certificado e o bônus de conclusão até o aluno ter passado tempo suficiente desde que começou o curso — evita conclusões rápidas demais. Pontos por aula individual não são afetados."
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
              checked={settings.enabled}
              onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
            />
            Ativar trava de tempo mínimo
          </label>
          {settings.enabled && (
            <div>
              <label className="block text-xs font-semibold text-ink-soft">
                % mínimo da carga horária cadastrada do curso
              </label>
              <input
                type="number"
                min={1}
                max={100}
                className="mt-1 w-24 rounded-lg border border-navy-light px-3 py-1.5 text-sm"
                value={settings.minExecutionPercent}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    minExecutionPercent: Math.min(100, Math.max(1, Number(e.target.value) || 1)),
                  })
                }
              />
              <p className="mt-1 text-xs text-ink-soft">
                Tempo corrido desde a primeira aula iniciada do curso. Só se aplica a cursos com carga horária
                cadastrada — sem isso preenchido, a trava não entra em ação pra esse curso.
              </p>
            </div>
          )}
        </div>
      )}
    </SectionShell>
  )
}

function isoToLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function localInputToIso(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}

function AnnouncementSection() {
  const [settings, setSettings] = useState<AnnouncementBannerSettings | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getAnnouncementSettings().then(setSettings)
  }, [])

  async function save() {
    if (!settings) return
    setSaving(true)
    setSaved(false)
    const imageUrl = imageFile ? await uploadBrandingAsset(imageFile, 'announcement') : removeImage ? null : settings.imageUrl
    const next = { ...settings, imageUrl }
    await updateAnnouncementSettings(next)
    setSettings(next)
    setImageFile(null)
    setRemoveImage(false)
    setSaving(false)
    setSaved(true)
  }

  return (
    <SectionShell
      title="Banner de anúncio"
      description="Uma faixa no topo, em toda a plataforma, pra anunciar algo com link clicável (ex.: uma palestra ao vivo). Some sozinha fora do período, se você definir datas."
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
              checked={settings.enabled}
              onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
            />
            Exibir banner
          </label>

          <div>
            <label className="block text-xs font-semibold text-ink-soft">Texto do aviso</label>
            <input
              className="mt-1 w-full rounded-xl border border-navy-light px-4 py-2.5 text-sm"
              placeholder="Ex: Palestra ao vivo hoje às 19h — participe!"
              value={settings.text}
              onChange={(e) => setSettings({ ...settings, text: e.target.value })}
            />
            <p className="mt-1 text-xs text-ink-soft">
              Com imagem (abaixo), esse texto vira o texto alternativo (acessibilidade) — quem enxerga a imagem não
              vê esse texto na tela.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-soft">Imagem (opcional)</label>
            <p className="mt-0.5 text-xs text-ink-soft">
              Tamanho recomendado: 1326 x 495px. Com imagem, o banner vira a imagem inteira (clicável, se tiver
              link) em vez da faixa de texto.
            </p>
            {settings.imageUrl && !imageFile && !removeImage && (
              <div className="mt-2 flex items-center gap-2">
                <img src={settings.imageUrl} alt="" className="h-16 w-auto rounded-lg border border-navy-light object-cover" />
                <button
                  type="button"
                  onClick={() => setRemoveImage(true)}
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
                setImageFile(e.target.files?.[0] ?? null)
                setRemoveImage(false)
              }}
              className="mt-2 w-full text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-soft">Link (opcional)</label>
            <input
              className="mt-1 w-full rounded-xl border border-navy-light px-4 py-2.5 text-sm"
              placeholder="https://…"
              value={settings.linkUrl ?? ''}
              onChange={(e) => setSettings({ ...settings, linkUrl: e.target.value || null })}
            />
            <p className="mt-1 text-xs text-ink-soft">Sem link, o banner só mostra o texto/imagem (sem clique).</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-soft">Começa em (opcional)</label>
              <input
                type="datetime-local"
                className="mt-1 rounded-xl border border-navy-light px-3 py-2 text-sm"
                value={isoToLocalInput(settings.startAt)}
                onChange={(e) => setSettings({ ...settings, startAt: localInputToIso(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-soft">Termina em (opcional)</label>
              <input
                type="datetime-local"
                className="mt-1 rounded-xl border border-navy-light px-3 py-2 text-sm"
                value={isoToLocalInput(settings.endAt)}
                onChange={(e) => setSettings({ ...settings, endAt: localInputToIso(e.target.value) })}
              />
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

          <div className="rounded-xl border border-navy-light p-3">
            <label className="block text-xs font-semibold text-ink-soft">Duração de cada story (segundos)</label>
            <input
              type="number"
              min={1}
              max={60}
              className="mt-1 w-24 rounded-lg border border-navy-light px-3 py-1.5 text-sm"
              value={settings.storyDurationSeconds}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  storyDurationSeconds: Math.min(60, Math.max(1, Number(e.target.value) || 1)),
                })
              }
            />
            <p className="mt-1 text-xs text-ink-soft">Quanto tempo cada story fica em tela antes de avançar/fechar. Máximo 60s.</p>
          </div>
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

function PwaSection() {
  const [settings, setSettings] = useState<PwaSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getPwaSettings().then(setSettings)
  }, [])

  async function save() {
    if (!settings) return
    setSaving(true)
    setSaved(false)
    await updatePwaSettings(settings)
    setSaving(false)
    setSaved(true)
  }

  return (
    <SectionShell
      title="App instalável (PWA)"
      description="Permite que visitantes instalem o UniSave como aplicativo no celular/computador (Chrome, Edge, Android). Desativar só impede novas instalações — quem já instalou continua usando normalmente. No iPhone/iPad (Safari), 'Adicionar à Tela de Início' sempre fica disponível pelo menu do navegador, independente desta configuração."
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
              checked={settings.installableEnabled}
              onChange={(e) => setSettings({ ...settings, installableEnabled: e.target.checked })}
            />
            Permitir instalação do app
          </label>
        </div>
      )}
    </SectionShell>
  )
}

function PdiTabsSection() {
  const [settings, setSettings] = useState<PdiTabsSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getPdiTabsSettings().then(setSettings)
  }, [])

  async function save() {
    if (!settings) return
    setSaving(true)
    setSaved(false)
    await updatePdiTabsSettings(settings)
    setSaving(false)
    setSaved(true)
  }

  return (
    <SectionShell
      title="Abas de Meu PDI"
      description="Oculta abas inteiras da tela Meu PDI pros alunos, caso a plataforma não use esses recursos. A aba 'Meu PDI' (planos pessoais) nunca pode ser ocultada."
      loading={!settings}
      onSave={save}
      saving={saving}
      saved={saved}
    >
      {settings && (
        <div className="mt-4 space-y-2">
          <label className="flex items-center gap-2 rounded-xl border border-navy-light p-3 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={settings.hideBalanco}
              onChange={(e) => setSettings({ ...settings, hideBalanco: e.target.checked })}
            />
            Ocultar aba "Balanço de Competências"
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-navy-light p-3 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={settings.hideBiblioteca}
              onChange={(e) => setSettings({ ...settings, hideBiblioteca: e.target.checked })}
            />
            Ocultar aba "Biblioteca de Trilhas"
          </label>
        </div>
      )}
    </SectionShell>
  )
}

function TvPanelSection() {
  const [settings, setSettings] = useState<TvPanelSettings | null>(null)
  const [bgImageFile, setBgImageFile] = useState<File | null>(null)
  const [removeBgImage, setRemoveBgImage] = useState(false)
  const [newCarouselFiles, setNewCarouselFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getTvPanelSettings().then(setSettings)
  }, [])

  async function save() {
    if (!settings) return
    setSaving(true)
    setSaved(false)
    const backgroundImageUrl = bgImageFile
      ? await uploadBrandingAsset(bgImageFile, 'tv-panel')
      : removeBgImage
        ? null
        : settings.backgroundImageUrl
    const uploadedCarouselUrls = await Promise.all(
      newCarouselFiles.map((f) => uploadBrandingAsset(f, 'tv-panel-carousel')),
    )
    const carouselImages = [...settings.carouselImages, ...uploadedCarouselUrls]
    const next = { ...settings, backgroundImageUrl, carouselImages }
    await updateTvPanelSettings(next)
    setSettings(next)
    setBgImageFile(null)
    setRemoveBgImage(false)
    setNewCarouselFiles([])
    setSaving(false)
    setSaved(true)
  }

  function removeCarouselImage(url: string) {
    if (!settings) return
    setSettings({ ...settings, carouselImages: settings.carouselImages.filter((u) => u !== url) })
  }

  return (
    <SectionShell
      title="Painel de TV (ranking ao vivo)"
      description={'Personaliza o fundo e as cores da tela /painel-tv, exibida numa TV no estande.'}
      loading={!settings}
      onSave={save}
      saving={saving}
      saved={saved}
    >
      {settings && (
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ink-soft">Tipo de fundo</label>
            <div className="mt-1 flex gap-2">
              {(
                [
                  { value: 'solid', label: 'Cor sólida' },
                  { value: 'gradient', label: 'Gradiente' },
                  { value: 'image', label: 'Imagem' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSettings({ ...settings, backgroundType: opt.value })}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                    settings.backgroundType === opt.value
                      ? 'border-navy bg-navy text-white'
                      : 'border-navy-light text-ink-soft'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {settings.backgroundType === 'solid' && (
            <div>
              <label className="block text-xs font-semibold text-ink-soft">Cor de fundo</label>
              <input
                type="color"
                className="mt-1 h-10 w-16 rounded-lg border border-navy-light"
                value={settings.backgroundColor}
                onChange={(e) => setSettings({ ...settings, backgroundColor: e.target.value })}
              />
            </div>
          )}

          {settings.backgroundType === 'gradient' && (
            <div className="flex gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink-soft">Cor inicial</label>
                <input
                  type="color"
                  className="mt-1 h-10 w-16 rounded-lg border border-navy-light"
                  value={settings.gradientFrom}
                  onChange={(e) => setSettings({ ...settings, gradientFrom: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-soft">Cor final</label>
                <input
                  type="color"
                  className="mt-1 h-10 w-16 rounded-lg border border-navy-light"
                  value={settings.gradientTo}
                  onChange={(e) => setSettings({ ...settings, gradientTo: e.target.value })}
                />
              </div>
            </div>
          )}

          {settings.backgroundType === 'image' && (
            <div>
              <label className="block text-xs font-semibold text-ink-soft">Imagem de fundo</label>
              <p className="mt-0.5 text-xs text-ink-soft">
                Mesmo esquema da tela de login: a imagem fica por baixo e o gradiente (cor inicial/final abaixo) vira
                uma camada de cor por cima dela — ajuste a intensidade pra deixar o texto legível.
              </p>
              {settings.backgroundImageUrl && !bgImageFile && !removeBgImage && (
                <div className="mt-2 flex items-center gap-2">
                  <img src={settings.backgroundImageUrl} alt="" className="h-16 w-28 rounded-lg border border-navy-light object-cover" />
                  <button
                    type="button"
                    onClick={() => setRemoveBgImage(true)}
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
                  setBgImageFile(e.target.files?.[0] ?? null)
                  setRemoveBgImage(false)
                }}
                className="mt-2 w-full text-sm"
              />

              <div className="mt-3 flex gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-soft">Cor inicial do gradiente</label>
                  <input
                    type="color"
                    className="mt-1 h-10 w-16 rounded-lg border border-navy-light"
                    value={settings.gradientFrom}
                    onChange={(e) => setSettings({ ...settings, gradientFrom: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-soft">Cor final do gradiente</label>
                  <input
                    type="color"
                    className="mt-1 h-10 w-16 rounded-lg border border-navy-light"
                    value={settings.gradientTo}
                    onChange={(e) => setSettings({ ...settings, gradientTo: e.target.value })}
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="block text-xs font-semibold text-ink-soft">
                  Intensidade do gradiente sobre a imagem — {settings.overlayOpacity}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={settings.overlayOpacity}
                  onChange={(e) => setSettings({ ...settings, overlayOpacity: Number(e.target.value) })}
                  className="mt-1 w-full"
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 border-t border-navy-light pt-4">
            <div>
              <label className="block text-xs font-semibold text-ink-soft">Cor do texto</label>
              <input
                type="color"
                className="mt-1 h-10 w-16 rounded-lg border border-navy-light"
                value={settings.textColor}
                onChange={(e) => setSettings({ ...settings, textColor: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-soft">Cor de destaque (AO VIVO)</label>
              <input
                type="color"
                className="mt-1 h-10 w-16 rounded-lg border border-navy-light"
                value={settings.accentColor}
                onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-soft">Cor dos painéis</label>
              <input
                type="color"
                className="mt-1 h-10 w-16 rounded-lg border border-navy-light"
                value={settings.panelColor}
                onChange={(e) => setSettings({ ...settings, panelColor: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 border-t border-navy-light pt-4">
            <div>
              <label className="block text-xs font-semibold text-ink-soft">Barra do 1º lugar</label>
              <input
                type="color"
                className="mt-1 h-10 w-16 rounded-lg border border-navy-light"
                value={settings.firstPlaceColor}
                onChange={(e) => setSettings({ ...settings, firstPlaceColor: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-soft">Barra do 2º lugar</label>
              <input
                type="color"
                className="mt-1 h-10 w-16 rounded-lg border border-navy-light"
                value={settings.secondPlaceColor}
                onChange={(e) => setSettings({ ...settings, secondPlaceColor: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-soft">Barra do 3º lugar</label>
              <input
                type="color"
                className="mt-1 h-10 w-16 rounded-lg border border-navy-light"
                value={settings.thirdPlaceColor}
                onChange={(e) => setSettings({ ...settings, thirdPlaceColor: e.target.value })}
              />
            </div>
          </div>

          <div className="border-t border-navy-light pt-4">
            <label className="block text-xs font-semibold text-ink-soft">Carrossel de imagens (abaixo do Top 5)</label>
            <p className="mt-0.5 text-xs text-ink-soft">
              Tamanho recomendado: 1326 x 495px. Com uma ou mais imagens, um carrossel aparece embaixo do pódio,
              trocando de imagem sozinho. Sem nenhuma imagem, esse espaço fica vazio.
            </p>

            {settings.carouselImages.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {settings.carouselImages.map((url) => (
                  <div key={url} className="relative">
                    <img src={url} alt="" className="h-16 w-28 rounded-lg border border-navy-light object-cover" />
                    <button
                      type="button"
                      onClick={() => removeCarouselImage(url)}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-red text-xs font-bold text-white hover:bg-brand-red-dark"
                      aria-label="Remover imagem"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setNewCarouselFiles(Array.from(e.target.files ?? []))}
              className="mt-2 w-full text-sm"
            />
            {newCarouselFiles.length > 0 && (
              <p className="mt-1 text-xs text-ink-soft">
                {newCarouselFiles.length} imagem(ns) selecionada(s) — adicionadas ao salvar.
              </p>
            )}

            <div className="mt-3">
              <label className="block text-xs font-semibold text-ink-soft">Segundos por imagem</label>
              <input
                type="number"
                min={2}
                max={60}
                className="mt-1 w-24 rounded-lg border border-navy-light px-3 py-1.5 text-sm"
                value={settings.carouselIntervalSeconds}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    carouselIntervalSeconds: Math.min(60, Math.max(2, Number(e.target.value) || 2)),
                  })
                }
              />
            </div>
          </div>
        </div>
      )}
    </SectionShell>
  )
}
