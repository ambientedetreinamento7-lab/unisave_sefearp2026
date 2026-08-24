import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AdminLayout } from './AdminLayout'
import { useConfirm } from '../../components/ConfirmDialog'
import { getReactionSurveys, linkPillToTrack, unlinkPillFromTrack } from '../../lib/api'
import { formatCargaHoraria } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Category, ContentType, DiagnosticProfile, Pill, Program, ReactionSurvey, ScormLibraryItem, Track, TrackPill } from '../../types/database'

async function uploadCover(file: File, folder: string): Promise<string> {
  const path = `${folder}/${crypto.randomUUID()}-${file.name}`
  const { error } = await supabase.storage.from('covers').upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/png',
  })
  if (error) throw error
  return supabase.storage.from('covers').getPublicUrl(path).data.publicUrl
}

// <input type="datetime-local"> só aceita/devolve "YYYY-MM-DDTHH:mm" em
// horário local do navegador — sem timezone. Convertendo assim (em vez de
// usar toISOString, que é UTC), a data digitada bate com o relógio local
// de quem está preenchendo o formulário.
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocal(value: string): string | null {
  if (!value) return null
  return new Date(value).toISOString()
}

type Tab = 'detalhes' | 'aulas'

export function AdminCursoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const isNew = !id || id === 'novo'

  const [tab, setTab] = useState<Tab>('detalhes')
  const [loading, setLoading] = useState(!isNew)
  const [track, setTrack] = useState<Track | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [allPills, setAllPills] = useState<Pill[]>([])
  const [trackPills, setTrackPills] = useState<TrackPill[]>([])
  const [pillForm, setPillForm] = useState<{ pill: Pill | null } | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)

  // Campos do curso (aba Detalhes) — vivem no componente pai, não na aba,
  // pra não perder o que foi digitado ao trocar de aba antes de salvar.
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [objetivoGeral, setObjetivoGeral] = useState('')
  const [publicoAlvo, setPublicoAlvo] = useState('')
  const [preRequisitos, setPreRequisitos] = useState('')
  const [cargaHoraria, setCargaHoraria] = useState('')
  const [certificateEnabled, setCertificateEnabled] = useState(false)
  const [sequential, setSequential] = useState(false)
  const [published, setPublished] = useState(true)
  const [isCatalog, setIsCatalog] = useState(false)
  const [bannerEnabled, setBannerEnabled] = useState(false)
  const [bannerStart, setBannerStart] = useState('')
  const [bannerEnd, setBannerEnd] = useState('')
  const [programId, setProgramId] = useState('')
  const [profile, setProfile] = useState<DiagnosticProfile | ''>('')
  const [categoryId, setCategoryId] = useState('')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedNotice, setSavedNotice] = useState(false)

  async function reloadAulas(trackId: string) {
    const [{ data: p }, { data: tp }] = await Promise.all([
      supabase.from('pills').select('*'),
      supabase.from('track_pills').select('*').eq('track_id', trackId),
    ])
    setAllPills((p as Pill[]) ?? [])
    setTrackPills((tp as TrackPill[]) ?? [])
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [{ data: prog }, { data: cat }] = await Promise.all([
        supabase.from('programs').select('*'),
        supabase.from('categories').select('*').order('order_index'),
      ])
      if (cancelled) return
      setPrograms((prog as Program[]) ?? [])
      setCategories((cat as Category[]) ?? [])
      if (!isNew && id) {
        const { data: t } = await supabase.from('tracks').select('*').eq('id', id).single()
        if (cancelled) return
        const row = t as Track | null
        setTrack(row)
        if (row) {
          setTitle(row.title)
          setDescription(row.description ?? '')
          setObjetivoGeral(row.objetivo_geral ?? '')
          setPublicoAlvo(row.publico_alvo ?? '')
          setPreRequisitos(row.pre_requisitos ?? '')
          setCargaHoraria(row.carga_horaria_total?.toString() ?? '')
          setCertificateEnabled(row.certificate_enabled)
          setSequential(row.sequential)
          setPublished(row.published)
          setIsCatalog(row.is_catalog)
          setBannerEnabled(row.banner_enabled)
          setBannerStart(toDatetimeLocal(row.banner_start_at))
          setBannerEnd(toDatetimeLocal(row.banner_end_at))
          setProgramId(row.program_id ?? '')
          setProfile(row.diagnostic_profile ?? '')
          setCategoryId(row.category_id ?? '')
        }
        await reloadAulas(id)
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function saveDetalhes() {
    setSaving(true)
    setError('')
    setSavedNotice(false)
    try {
      const coverUrl = coverFile ? await uploadCover(coverFile, 'tracks-cover') : track?.cover_url ?? null
      const thumbnailUrl = thumbnailFile ? await uploadCover(thumbnailFile, 'tracks-thumbnail') : track?.thumbnail_url ?? null

      const payload = {
        title,
        description,
        objetivo_geral: objetivoGeral || null,
        publico_alvo: publicoAlvo || null,
        pre_requisitos: preRequisitos || null,
        carga_horaria_total: cargaHoraria ? Number(cargaHoraria) : null,
        certificate_enabled: certificateEnabled,
        sequential,
        published,
        is_catalog: isCatalog,
        banner_enabled: bannerEnabled,
        banner_start_at: fromDatetimeLocal(bannerStart),
        banner_end_at: fromDatetimeLocal(bannerEnd),
        program_id: programId || null,
        diagnostic_profile: profile || null,
        category_id: categoryId || null,
        cover_url: coverUrl,
        thumbnail_url: thumbnailUrl,
      }
      if (track) {
        const { error: saveError } = await supabase.from('tracks').update(payload).eq('id', track.id)
        if (saveError) throw saveError
        setTrack({ ...track, ...payload })
      } else {
        const { data: newTrack, error: saveError } = await supabase.from('tracks').insert(payload).select('*').single()
        if (saveError) throw saveError
        setTrack(newTrack as Track)
        navigate(`/admin/trilhas/${newTrack.id}`, { replace: true })
        await reloadAulas(newTrack.id)
      }
    } catch (err) {
      const message = (err as { message?: string } | null)?.message
      setError(message || 'Falha ao salvar o curso.')
      setSaving(false)
      return
    }
    setSaving(false)
    setSavedNotice(true)
  }

  async function deletePill(pillId: string) {
    if (
      !(await confirm('Excluir esta pílula em definitivo? Ela some de todas as trilhas que a usam, junto com o progresso dos alunos.', {
        danger: true,
        confirmLabel: 'Excluir',
      }))
    )
      return
    const { error } = await supabase.from('pills').delete().eq('id', pillId)
    if (error) {
      alert(error.message)
      return
    }
    if (track) await reloadAulas(track.id)
  }

  async function removeFromTrack(pillId: string) {
    if (!track) return
    await unlinkPillFromTrack(track.id, pillId)
    await reloadAulas(track.id)
  }

  const pillsById = new Map(allPills.map((p) => [p.id, p]))
  const aulas = trackPills
    .sort((a, b) => a.order_index - b.order_index)
    .map((tp) => pillsById.get(tp.pill_id))
    .filter((p): p is Pill => !!p)

  if (loading) return <AdminLayout><p className="text-ink-soft">Carregando…</p></AdminLayout>

  return (
    <AdminLayout>
      <p className="text-sm text-ink-soft">
        <Link to="/admin/trilhas" className="hover:underline">Administrador / Cursos</Link> /
      </p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold text-ink">{isNew ? 'Novo curso' : title || 'Curso'}</h2>
        <div className="flex gap-2">
          <Link to="/admin/trilhas" className="rounded-xl border border-navy-light px-4 py-2 text-sm font-semibold text-ink-soft hover:border-navy">
            ← Voltar
          </Link>
          <button
            onClick={saveDetalhes}
            disabled={saving || !title}
            className="rounded-xl bg-brand-red px-5 py-2 text-sm font-bold text-white hover:bg-brand-red-dark disabled:opacity-60"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>

      <div className="mt-5 flex gap-2 border-b border-navy-light">
        <button
          onClick={() => setTab('detalhes')}
          className={`border-b-2 px-4 py-2 text-sm font-semibold transition ${
            tab === 'detalhes' ? 'border-brand-red text-navy' : 'border-transparent text-ink-soft hover:text-navy'
          }`}
        >
          Detalhes
        </button>
        <button
          onClick={() => !isNew && setTab('aulas')}
          disabled={isNew}
          title={isNew ? 'Salve os detalhes primeiro pra poder adicionar aulas' : undefined}
          className={`border-b-2 px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
            tab === 'aulas' ? 'border-brand-red text-navy' : 'border-transparent text-ink-soft hover:text-navy'
          }`}
        >
          Aulas {track && aulas.length > 0 ? `(${aulas.length})` : ''}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-brand-red">{error}</p>}
      {savedNotice && !error && <p className="mt-3 text-sm text-success">Curso salvo ✓</p>}

      {tab === 'detalhes' && (
        <div className="card mt-4 space-y-3 p-6">
          <label className="block text-xs font-semibold text-ink-soft">Nome do curso</label>
          <input className="w-full rounded-xl border border-navy-light px-4 py-3" placeholder="Nome do curso" value={title} onChange={(e) => setTitle(e.target.value)} />

          <label className="block text-xs font-semibold text-ink-soft">Descrição curta</label>
          <textarea className="w-full rounded-xl border border-navy-light px-4 py-3" placeholder="Descrição curta (aparece no catálogo)" value={description} onChange={(e) => setDescription(e.target.value)} />

          <label className="block text-xs font-semibold text-ink-soft">Objetivo geral</label>
          <textarea className="w-full rounded-xl border border-navy-light px-4 py-3" placeholder="O que o aluno vai alcançar ao concluir o curso" value={objetivoGeral} onChange={(e) => setObjetivoGeral(e.target.value)} />

          <label className="block text-xs font-semibold text-ink-soft">Público-alvo</label>
          <textarea className="w-full rounded-xl border border-navy-light px-4 py-3" placeholder="Para quem é este curso" value={publicoAlvo} onChange={(e) => setPublicoAlvo(e.target.value)} />

          <label className="block text-xs font-semibold text-ink-soft">Pré-requisitos</label>
          <textarea className="w-full rounded-xl border border-navy-light px-4 py-3" placeholder="Conhecimentos ou cursos necessários antes deste (opcional)" value={preRequisitos} onChange={(e) => setPreRequisitos(e.target.value)} />

          <label className="block text-xs font-semibold text-ink-soft">
            Carga horária total (minutos){' '}
            <span className="font-normal normal-case text-ink-soft/70">
              {cargaHoraria ? `— exibido como ${formatCargaHoraria(Number(cargaHoraria))}` : '(ex: 90 = 1h30min)'}
            </span>
          </label>
          <input
            type="number"
            min={0}
            className="w-full rounded-xl border border-navy-light px-4 py-3"
            placeholder="Ex: 90"
            value={cargaHoraria}
            onChange={(e) => setCargaHoraria(e.target.value)}
          />

          <label className="block text-xs font-semibold text-ink-soft">Categoria (filtro do catálogo)</label>
          <select className="w-full rounded-xl border border-navy-light px-4 py-3" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sem categoria</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <label className="block text-xs font-semibold text-ink-soft">
            Programa <span className="font-normal normal-case text-ink-soft/70">(opcional — pode vincular depois)</span>
          </label>
          <select className="w-full rounded-xl border border-navy-light px-4 py-3" value={programId} onChange={(e) => setProgramId(e.target.value)}>
            <option value="">Não definido</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <label className="block text-xs font-semibold text-ink-soft">
            Perfil <span className="font-normal normal-case text-ink-soft/70">(opcional — pode vincular depois)</span>
          </label>
          <select
            className="w-full rounded-xl border border-navy-light px-4 py-3"
            value={profile}
            onChange={(e) => setProfile(e.target.value as DiagnosticProfile | '')}
          >
            <option value="">Não definido</option>
            <option value="autogestao">Autogestão</option>
            <option value="tech_ia">Tech & IA</option>
            <option value="lideranca">Liderança</option>
          </select>

          <div>
            <label className="block text-xs font-semibold text-ink-soft">Capa (recomendado: 1326×495px)</label>
            {track?.cover_url && !coverFile && <img src={track.cover_url} alt="" className="mt-1 h-16 rounded-lg border border-navy-light" />}
            <input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} className="mt-1 w-full text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-soft">Miniatura (recomendado: 895×495px)</label>
            {track?.thumbnail_url && !thumbnailFile && <img src={track.thumbnail_url} alt="" className="mt-1 h-16 rounded-lg border border-navy-light" />}
            <input type="file" accept="image/*" onChange={(e) => setThumbnailFile(e.target.files?.[0] ?? null)} className="mt-1 w-full text-sm" />
          </div>

          <label className="flex items-center gap-2 rounded-xl border border-navy-light p-3 text-sm font-medium text-ink">
            <input type="checkbox" checked={certificateEnabled} onChange={(e) => setCertificateEnabled(e.target.checked)} />
            Emite certificado ao concluir 100% das pílulas do curso
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-navy-light p-3 text-sm font-medium text-ink">
            <input type="checkbox" checked={sequential} onChange={(e) => setSequential(e.target.checked)} />
            Módulos sequenciais (só libera o próximo após concluir o anterior)
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-navy-light p-3 text-sm font-medium text-ink">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            Publicado (visível para os alunos)
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-navy-light p-3 text-sm font-medium text-ink">
            <input type="checkbox" checked={isCatalog} onChange={(e) => setIsCatalog(e.target.checked)} />
            Biblioteca de Cursos (prateleira avulsa — só aparece pro aluno que bater com o Programa/Perfil
            acima, e só entra no PDI dele se ele mesmo adicionar)
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-navy-light p-3 text-sm font-medium text-ink">
            <input type="checkbox" checked={bannerEnabled} onChange={(e) => setBannerEnabled(e.target.checked)} />
            Banner (exibe este curso no carrossel rotativo do Dashboard, usando a Capa acima — recomendado:
            1326×495px)
          </label>

          {bannerEnabled && (
            <div className="grid gap-3 rounded-xl border border-navy-light p-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-ink-soft">
                  Data de início do banner <span className="font-normal normal-case text-ink-soft/70">(opcional)</span>
                </label>
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-xl border border-navy-light px-3 py-2.5 text-sm"
                  value={bannerStart}
                  onChange={(e) => setBannerStart(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-soft">
                  Data de fim do banner <span className="font-normal normal-case text-ink-soft/70">(opcional)</span>
                </label>
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-xl border border-navy-light px-3 py-2.5 text-sm"
                  value={bannerEnd}
                  onChange={(e) => setBannerEnd(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'aulas' && track && (
        <div className="card mt-4 space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink-soft">Vídeos, SCORMs, iframes ou avaliações de reação que compõem este curso.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setLinkOpen(true)}
                className="rounded-lg border border-navy-light px-3 py-1.5 text-xs font-semibold text-navy hover:border-navy"
              >
                + Curso existente
              </button>
              <button
                onClick={() => setPillForm({ pill: null })}
                className="rounded-lg border border-navy-light px-3 py-1.5 text-xs font-semibold text-navy hover:border-navy"
              >
                + Pílula nova
              </button>
            </div>
          </div>

          <div className="space-y-1">
            {aulas.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-bg px-3 py-2 text-sm">
                <span className="flex items-center gap-2 font-medium text-ink">
                  {p.thumbnail_url && <img src={p.thumbnail_url} alt="" className="h-6 w-10 rounded object-cover" />}
                  {p.title}
                  {p.axis && <span className="text-xs font-normal text-ink-soft">({p.axis})</span>}
                </span>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs uppercase text-ink-soft">{p.content_type}</span>
                  <button onClick={() => setPillForm({ pill: p })} className="text-xs font-semibold text-navy hover:underline">
                    Editar
                  </button>
                  <button onClick={() => removeFromTrack(p.id)} className="text-xs font-semibold text-navy hover:underline">
                    Remover da trilha
                  </button>
                  <button onClick={() => deletePill(p.id)} className="text-xs font-semibold text-brand-red hover:underline">
                    Excluir curso
                  </button>
                </div>
              </div>
            ))}
            {aulas.length === 0 && <p className="text-sm text-ink-soft">Nenhuma pílula neste curso ainda.</p>}
          </div>
        </div>
      )}

      {pillForm && track && (
        <PillFormModal
          trackId={track.id}
          pill={pillForm.pill}
          categories={categories}
          onClose={() => setPillForm(null)}
          onSaved={async () => { setPillForm(null); await reloadAulas(track.id) }}
        />
      )}
      {linkOpen && track && (
        <LinkPillModal
          trackId={track.id}
          pills={allPills}
          linkedPillIds={new Set(aulas.map((p) => p.id))}
          onClose={() => setLinkOpen(false)}
          onLinked={async () => { setLinkOpen(false); await reloadAulas(track.id) }}
        />
      )}
    </AdminLayout>
  )
}

function PillFormModal({
  trackId,
  pill,
  categories,
  onClose,
  onSaved,
}: {
  trackId: string
  pill: Pill | null
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(pill?.title ?? '')
  const [axis, setAxis] = useState(pill?.axis ?? '')
  const [duration, setDuration] = useState(pill?.duration ?? '')
  const [contentType, setContentType] = useState<ContentType>(pill?.content_type ?? 'video')
  const [contentUrl, setContentUrl] = useState(pill?.content_url ?? '')
  const [scormLibraryId, setScormLibraryId] = useState(pill?.scorm_library_id ?? '')
  const [scormLibrary, setScormLibrary] = useState<ScormLibraryItem[]>([])
  const [reactionSurveyId, setReactionSurveyId] = useState(pill?.reaction_survey_id ?? '')
  const [reactionSurveys, setReactionSurveys] = useState<ReactionSurvey[]>([])
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [pointsOverride, setPointsOverride] = useState(pill?.points_override != null ? String(pill.points_override) : '')
  const [categoryId, setCategoryId] = useState(pill?.category_id ?? '')
  const [required, setRequired] = useState(pill?.required ?? false)
  const [allowManualCompletion, setAllowManualCompletion] = useState(pill?.allow_manual_completion ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (contentType !== 'scorm') return
    supabase.from('scorm_library').select('*').order('name').then(({ data }) => {
      setScormLibrary((data as ScormLibraryItem[]) ?? [])
    })
  }, [contentType])

  useEffect(() => {
    if (contentType !== 'reaction') return
    getReactionSurveys().then(setReactionSurveys)
  }, [contentType])

  async function save() {
    setSaving(true)
    setError('')
    try {
      const coverUrl = coverFile ? await uploadCover(coverFile, 'pills-cover') : pill?.cover_url ?? null
      const thumbnailUrl = thumbnailFile ? await uploadCover(thumbnailFile, 'pills-thumbnail') : pill?.thumbnail_url ?? null

      const payload = {
        track_id: trackId,
        title,
        axis,
        duration,
        content_type: contentType,
        content_url: contentType !== 'scorm' && contentType !== 'reaction' ? contentUrl : null,
        scorm_library_id: contentType === 'scorm' ? scormLibraryId || null : null,
        ...(contentType === 'scorm' && scormLibraryId
          ? { scorm_package_url: null, scorm_manifest_path: null }
          : {}),
        reaction_survey_id: contentType === 'reaction' ? reactionSurveyId || null : null,
        cover_url: coverUrl,
        thumbnail_url: thumbnailUrl,
        points_override: pointsOverride === '' ? null : Number(pointsOverride),
        category_id: categoryId || null,
        required,
        allow_manual_completion: allowManualCompletion,
      }
      if (pill) {
        const { error: saveError } = await supabase.from('pills').update(payload).eq('id', pill.id)
        if (saveError) throw saveError
      } else {
        const { data: newPill, error: saveError } = await supabase.from('pills').insert(payload).select('id').single()
        if (saveError) throw saveError
        await linkPillToTrack(trackId, newPill.id)
      }
    } catch (err) {
      const message = (err as { message?: string } | null)?.message
      setError(message || 'Falha ao salvar a pílula.')
      setSaving(false)
      return
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card max-h-[85vh] w-full max-w-md space-y-3 overflow-y-auto p-6">
        <h3 className="text-lg font-bold text-ink">{pill ? 'Editar pílula' : 'Nova pílula'}</h3>
        <input className="w-full rounded-xl border border-navy-light px-4 py-3" placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="w-full rounded-xl border border-navy-light px-4 py-3" placeholder="Módulo (nome do bloco/etapa do curso)" value={axis} onChange={(e) => setAxis(e.target.value)} />
        <input className="w-full rounded-xl border border-navy-light px-4 py-3" placeholder="Duração (ex: 12 min)" value={duration} onChange={(e) => setDuration(e.target.value)} />

        <select className="w-full rounded-xl border border-navy-light px-4 py-3" value={contentType} onChange={(e) => setContentType(e.target.value as ContentType)}>
          <option value="video">Vídeo</option>
          <option value="iframe">Iframe / embed</option>
          <option value="scorm">SCORM</option>
          <option value="reaction">Avaliação de Reação</option>
        </select>

        {contentType === 'reaction' && (
          <div>
            <label className="block text-xs font-semibold text-ink-soft">Pesquisa de satisfação</label>
            <select
              className="mt-1 w-full rounded-xl border border-navy-light px-4 py-3"
              value={reactionSurveyId}
              onChange={(e) => setReactionSurveyId(e.target.value)}
            >
              <option value="">Selecione uma pesquisa…</option>
              {reactionSurveys.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <Link to="/admin/quizzes" className="mt-1 inline-block text-xs font-semibold text-navy hover:underline">
              + Criar/editar pesquisas de reação
            </Link>
            <p className="mt-2 rounded-xl border border-navy-light bg-bg px-4 py-3 text-xs text-ink-soft">
              Esta pílula não tem vídeo/arquivo — ela é a própria avaliação de reação. A mesma pesquisa pode ser
              usada em outros cursos; o relatório de respostas identifica de qual curso cada resposta veio.
            </p>
          </div>
        )}

        {contentType !== 'scorm' && contentType !== 'reaction' && (
          <input className="w-full rounded-xl border border-navy-light px-4 py-3" placeholder="URL do conteúdo" value={contentUrl} onChange={(e) => setContentUrl(e.target.value)} />
        )}

        {contentType === 'scorm' && (
          <div>
            <select
              className="w-full rounded-xl border border-navy-light px-4 py-3"
              value={scormLibraryId}
              onChange={(e) => setScormLibraryId(e.target.value)}
            >
              <option value="">Selecione um pacote da biblioteca…</option>
              {scormLibrary.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <Link to="/admin/scorms" className="mt-1 inline-block text-xs font-semibold text-navy hover:underline">
              + Cadastrar novo pacote na Biblioteca de SCORMs
            </Link>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-ink-soft">Capa (recomendado: 1326×495px)</label>
          {pill?.cover_url && !coverFile && <img src={pill.cover_url} alt="" className="mt-1 h-16 rounded-lg border border-navy-light" />}
          <input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} className="mt-1 w-full text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-soft">Miniatura (recomendado: 895×495px)</label>
          {pill?.thumbnail_url && !thumbnailFile && <img src={pill.thumbnail_url} alt="" className="mt-1 h-16 rounded-lg border border-navy-light" />}
          <input type="file" accept="image/*" onChange={(e) => setThumbnailFile(e.target.files?.[0] ?? null)} className="mt-1 w-full text-sm" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink-soft">
            Pontos de gamificação (substitui o padrão de "Conclusão de curso/pílula")
          </label>
          <input
            type="number"
            placeholder="Deixe em branco pra usar o padrão"
            className="mt-1 w-full rounded-xl border border-navy-light px-4 py-3"
            value={pointsOverride}
            onChange={(e) => setPointsOverride(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink-soft">Categoria (filtro do catálogo)</label>
          <select
            className="mt-1 w-full rounded-xl border border-navy-light px-4 py-3"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Sem categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          Curso obrigatório
        </label>

        {contentType === 'video' && (
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={allowManualCompletion}
                onChange={(e) => setAllowManualCompletion(e.target.checked)}
              />
              Permitir concluir manualmente
            </label>
            <p className="mt-1 text-xs text-ink-soft">
              Por padrão o módulo só conclui automaticamente quando o aluno assiste o vídeo até o fim, sem pular
              trechos. Marque esta opção para liberar também um botão "Concluir Módulo" manual.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-brand-red">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-navy-light py-2.5 font-semibold text-ink-soft">Cancelar</button>
          <button onClick={save} disabled={saving || !title} className="flex-1 rounded-xl bg-brand-red py-2.5 font-bold text-white disabled:opacity-60">
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function LinkPillModal({
  trackId,
  pills,
  linkedPillIds,
  onClose,
  onLinked,
}: {
  trackId: string
  pills: Pill[]
  linkedPillIds: Set<string>
  onClose: () => void
  onLinked: () => void
}) {
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  const available = pills.filter(
    (p) => !linkedPillIds.has(p.id) && (!search.trim() || p.title.toLowerCase().includes(search.trim().toLowerCase())),
  )

  async function add(pillId: string) {
    setSaving(pillId)
    await linkPillToTrack(trackId, pillId)
    setSaving(null)
    onLinked()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card max-h-[80vh] w-full max-w-lg space-y-3 overflow-y-auto p-6">
        <h3 className="text-lg font-bold text-ink">Adicionar curso existente a esta trilha</h3>
        <input
          className="w-full rounded-xl border border-navy-light px-4 py-3 text-sm"
          placeholder="Buscar curso pelo nome…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="space-y-1">
          {available.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-bg px-3 py-2 text-sm">
              <span className="font-medium text-ink">
                {p.title}
                {p.axis && <span className="text-xs font-normal text-ink-soft"> ({p.axis})</span>}
              </span>
              <button
                onClick={() => add(p.id)}
                disabled={saving === p.id}
                className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              >
                {saving === p.id ? 'Adicionando…' : '+ Adicionar'}
              </button>
            </div>
          ))}
          {available.length === 0 && <p className="text-sm text-ink-soft">Nenhum curso disponível para adicionar.</p>}
        </div>
        <button onClick={onClose} className="mt-2 text-sm font-medium text-ink-soft hover:text-navy">
          Fechar
        </button>
      </div>
    </div>
  )
}
