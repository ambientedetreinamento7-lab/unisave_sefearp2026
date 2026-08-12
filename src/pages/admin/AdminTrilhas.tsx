import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminLayout } from './AdminLayout'
import { useConfirm } from '../../components/ConfirmDialog'
import { linkPillToTrack, unlinkPillFromTrack } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import type {
  Category,
  ContentType,
  DashboardSection,
  DiagnosticProfile,
  Pill,
  Program,
  ScormLibraryItem,
  Track,
  TrackPill,
} from '../../types/database'

async function uploadCover(file: File, folder: string): Promise<string> {
  const path = `${folder}/${crypto.randomUUID()}-${file.name}`
  const { error } = await supabase.storage.from('covers').upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/png',
  })
  if (error) throw error
  return supabase.storage.from('covers').getPublicUrl(path).data.publicUrl
}

export function AdminTrilhas() {
  const confirm = useConfirm()
  const [tracks, setTracks] = useState<Track[]>([])
  const [pills, setPills] = useState<Pill[]>([])
  const [trackPills, setTrackPills] = useState<TrackPill[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [sections, setSections] = useState<DashboardSection[]>([])
  const [loading, setLoading] = useState(true)
  const [trackForm, setTrackForm] = useState<Track | 'new' | null>(null)
  const [pillForm, setPillForm] = useState<{ trackId: string; pill: Pill | null } | null>(null)
  const [linkTrackId, setLinkTrackId] = useState<string | null>(null)
  const [categoryForm, setCategoryForm] = useState<Category | 'new' | null>(null)
  const [search, setSearch] = useState('')
  const [trackFilter, setTrackFilter] = useState<string>('all')

  async function deletePill(id: string) {
    if (
      !(await confirm('Excluir esta pílula em definitivo? Ela some de todas as trilhas que a usam, junto com o progresso dos alunos.', {
        danger: true,
        confirmLabel: 'Excluir',
      }))
    )
      return
    await supabase.from('pills').delete().eq('id', id)
    reload()
  }

  async function removeFromTrack(trackId: string, pillId: string) {
    await unlinkPillFromTrack(trackId, pillId)
    reload()
  }

  async function togglePublished(track: Track) {
    await supabase.from('tracks').update({ published: !track.published }).eq('id', track.id)
    reload()
  }

  async function deleteTrack(id: string) {
    if (
      !(await confirm(
        'Excluir esta trilha? O vínculo com os cursos dela é removido (os cursos em si só somem se não pertencerem a outra trilha).',
        { danger: true, confirmLabel: 'Excluir' },
      ))
    )
      return
    await supabase.from('tracks').delete().eq('id', id)
    reload()
  }

  async function reload() {
    const [{ data: t }, { data: p }, { data: tp }, { data: prog }, { data: cat }, { data: sec }] = await Promise.all([
      supabase.from('tracks').select('*'),
      supabase.from('pills').select('*'),
      supabase.from('track_pills').select('*'),
      supabase.from('programs').select('*'),
      supabase.from('categories').select('*').order('order_index'),
      supabase.from('dashboard_sections').select('*').order('order_index'),
    ])
    setTracks((t as Track[]) ?? [])
    setPills((p as Pill[]) ?? [])
    setTrackPills((tp as TrackPill[]) ?? [])
    setPrograms((prog as Program[]) ?? [])
    setCategories((cat as Category[]) ?? [])
    setSections((sec as DashboardSection[]) ?? [])
    setLoading(false)
  }

  async function deleteCategory(id: string) {
    if (!(await confirm('Excluir esta categoria? Cursos com ela ficam sem categoria.', { danger: true, confirmLabel: 'Excluir' })))
      return
    await supabase.from('categories').delete().eq('id', id)
    reload()
  }

  async function moveSection(section: DashboardSection, direction: -1 | 1) {
    const ordered = [...sections].sort((a, b) => a.order_index - b.order_index)
    const idx = ordered.findIndex((s) => s.key === section.key)
    const swapWith = ordered[idx + direction]
    if (!swapWith) return
    await Promise.all([
      supabase.from('dashboard_sections').update({ order_index: swapWith.order_index }).eq('key', section.key),
      supabase.from('dashboard_sections').update({ order_index: section.order_index }).eq('key', swapWith.key),
    ])
    reload()
  }

  async function toggleSectionEnabled(section: DashboardSection) {
    await supabase.from('dashboard_sections').update({ enabled: !section.enabled }).eq('key', section.key)
    reload()
  }

  useEffect(() => {
    reload()
  }, [])

  const pillsById = useMemo(() => new Map(pills.map((p) => [p.id, p])), [pills])

  const visibleTracks = useMemo(() => {
    return tracks.filter((track) => {
      if (trackFilter !== 'all' && track.id !== trackFilter) return false
      if (!search.trim()) return true
      const q = search.trim().toLowerCase()
      const trackMatches = track.title.toLowerCase().includes(q)
      const pillMatches = trackPills.some(
        (tp) => tp.track_id === track.id && pillsById.get(tp.pill_id)?.title.toLowerCase().includes(q),
      )
      return trackMatches || pillMatches
    })
  }, [tracks, trackPills, pillsById, search, trackFilter])

  function pillsFor(trackId: string): Pill[] {
    const q = search.trim().toLowerCase()
    return trackPills
      .filter((tp) => tp.track_id === trackId)
      .sort((a, b) => a.order_index - b.order_index)
      .map((tp) => pillsById.get(tp.pill_id))
      .filter((p): p is Pill => !!p && (!q || p.title.toLowerCase().includes(q)))
  }

  if (loading) return <AdminLayout><p className="text-ink-soft">Carregando…</p></AdminLayout>

  return (
    <AdminLayout>
      <details className="card mb-4 p-4">
        <summary className="cursor-pointer font-bold text-ink">Categorias do catálogo</summary>
        <p className="mt-1 text-sm text-ink-soft">
          Chips de filtro exibidos acima do catálogo pro aluno. Cada curso escolhe uma no formulário de edição.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5 rounded-full border border-navy-light px-3 py-1.5 text-xs font-semibold text-navy">
              {c.name}
              <button onClick={() => setCategoryForm(c)} className="hover:underline">Editar</button>
              <button onClick={() => deleteCategory(c.id)} className="text-brand-red hover:underline">×</button>
            </span>
          ))}
          <button
            onClick={() => setCategoryForm('new')}
            className="rounded-full border border-dashed border-navy-light px-3 py-1.5 text-xs font-semibold text-navy hover:border-navy"
          >
            + Categoria
          </button>
        </div>
      </details>

      <details className="card mb-4 p-4">
        <summary className="cursor-pointer font-bold text-ink">Seções da Minha Trilha</summary>
        <p className="mt-1 text-sm text-ink-soft">Ordem em que as seções aparecem pro aluno; desative as que não quer mostrar.</p>
        <div className="mt-3 space-y-1.5">
          {sections.map((s, i) => (
            <div key={s.key} className="flex items-center justify-between gap-3 rounded-lg border border-navy-light px-3 py-2">
              <span className={`text-sm font-medium ${s.enabled ? 'text-ink' : 'text-ink-soft line-through'}`}>{s.label}</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => moveSection(s, -1)}
                  disabled={i === 0}
                  className="rounded-lg border border-navy-light px-2 py-1 text-xs font-semibold text-navy disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveSection(s, 1)}
                  disabled={i === sections.length - 1}
                  className="rounded-lg border border-navy-light px-2 py-1 text-xs font-semibold text-navy disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  onClick={() => toggleSectionEnabled(s)}
                  className="rounded-lg border border-navy-light px-2.5 py-1 text-xs font-semibold text-navy"
                >
                  {s.enabled ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </details>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className="min-w-[200px] flex-1 rounded-xl border border-navy-light px-4 py-2.5 text-sm"
          placeholder="Buscar por nome do curso ou pílula…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-xl border border-navy-light px-3 py-2.5 text-sm"
          value={trackFilter}
          onChange={(e) => setTrackFilter(e.target.value)}
        >
          <option value="all">Todas as trilhas</option>
          {tracks.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
        <Link to="/admin/scorms" className="rounded-xl border border-navy-light px-4 py-2.5 text-sm font-semibold text-navy hover:border-navy">
          Biblioteca de SCORMs
        </Link>
        <button
          onClick={() => setTrackForm('new')}
          className="rounded-xl bg-brand-red px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-red-dark"
        >
          + Novo curso
        </button>
      </div>

      <div className="space-y-4">
        {visibleTracks.map((track) => (
          <div key={track.id} className="card overflow-hidden">
            {track.cover_url && <img src={track.cover_url} alt="" className="h-32 w-full object-cover" />}
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-ink">{track.title}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        track.published ? 'bg-green-50 text-success' : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {track.published ? 'Publicado' : 'Despublicado'}
                    </span>
                    {track.is_catalog && (
                      <span className="rounded-full bg-navy-light px-2 py-0.5 text-[11px] font-semibold text-navy">Biblioteca</span>
                    )}
                  </div>
                  <p className="text-xs text-ink-soft">
                    {programs.find((p) => p.id === track.program_id)?.name} · {track.diagnostic_profile}
                    {track.carga_horaria_total != null && <> · {track.carga_horaria_total}h</>}
                    {track.certificate_enabled && <> · 🎓 emite certificado</>}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  <button
                    onClick={() => togglePublished(track)}
                    className="rounded-lg border border-navy-light px-3 py-1.5 text-xs font-semibold text-navy hover:border-navy"
                  >
                    {track.published ? 'Despublicar' : 'Publicar'}
                  </button>
                  <button
                    onClick={() => setTrackForm(track)}
                    className="rounded-lg border border-navy-light px-3 py-1.5 text-xs font-semibold text-navy hover:border-navy"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setLinkTrackId(track.id)}
                    className="rounded-lg border border-navy-light px-3 py-1.5 text-xs font-semibold text-navy hover:border-navy"
                  >
                    + Curso existente
                  </button>
                  <button
                    onClick={() => setPillForm({ trackId: track.id, pill: null })}
                    className="rounded-lg border border-navy-light px-3 py-1.5 text-xs font-semibold text-navy hover:border-navy"
                  >
                    + Pílula nova
                  </button>
                  <button
                    onClick={() => deleteTrack(track.id)}
                    className="rounded-lg border border-brand-red/30 px-3 py-1.5 text-xs font-semibold text-brand-red hover:border-brand-red"
                  >
                    Excluir trilha
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {pillsFor(track.id).map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-bg px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 font-medium text-ink">
                      {p.thumbnail_url && <img src={p.thumbnail_url} alt="" className="h-6 w-10 rounded object-cover" />}
                      {p.title}
                      {p.axis && <span className="text-xs font-normal text-ink-soft">({p.axis})</span>}
                    </span>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-xs uppercase text-ink-soft">{p.content_type}</span>
                      <button
                        onClick={() => setPillForm({ trackId: track.id, pill: p })}
                        className="text-xs font-semibold text-navy hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => removeFromTrack(track.id, p.id)}
                        className="text-xs font-semibold text-navy hover:underline"
                      >
                        Remover da trilha
                      </button>
                      <button onClick={() => deletePill(p.id)} className="text-xs font-semibold text-brand-red hover:underline">
                        Excluir curso
                      </button>
                    </div>
                  </div>
                ))}
                {pillsFor(track.id).length === 0 && (
                  <p className="text-sm text-ink-soft">Nenhuma pílula encontrada neste curso.</p>
                )}
              </div>
            </div>
          </div>
        ))}
        {visibleTracks.length === 0 && <p className="text-ink-soft">Nenhum curso encontrado.</p>}
      </div>

      {trackForm && (
        <TrackFormModal
          track={trackForm === 'new' ? null : trackForm}
          programs={programs}
          onClose={() => setTrackForm(null)}
          onSaved={() => { setTrackForm(null); reload() }}
        />
      )}
      {linkTrackId && (
        <LinkPillModal
          trackId={linkTrackId}
          pills={pills}
          linkedPillIds={new Set(pillsFor(linkTrackId).map((p) => p.id))}
          onClose={() => setLinkTrackId(null)}
          onLinked={() => { setLinkTrackId(null); reload() }}
        />
      )}
      {pillForm && (
        <PillFormModal
          trackId={pillForm.trackId}
          pill={pillForm.pill}
          categories={categories}
          onClose={() => setPillForm(null)}
          onSaved={() => { setPillForm(null); reload() }}
        />
      )}
      {categoryForm && (
        <CategoryFormModal
          category={categoryForm === 'new' ? null : categoryForm}
          nextOrderIndex={categories.length}
          onClose={() => setCategoryForm(null)}
          onSaved={() => { setCategoryForm(null); reload() }}
        />
      )}
    </AdminLayout>
  )
}

function CategoryFormModal({
  category,
  nextOrderIndex,
  onClose,
  onSaved,
}: {
  category: Category | null
  nextOrderIndex: number
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(category?.name ?? '')
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    if (category) {
      await supabase.from('categories').update({ name: name.trim() }).eq('id', category.id)
    } else {
      await supabase.from('categories').insert({ name: name.trim(), order_index: nextOrderIndex })
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-sm p-5">
        <h3 className="text-lg font-bold text-ink">{category ? 'Editar categoria' : 'Nova categoria'}</h3>
        <label className="mt-4 block text-xs font-semibold text-ink-soft">Nome</label>
        <input
          className="mt-1 w-full rounded-xl border border-navy-light px-4 py-2.5"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-navy-light py-2.5 font-semibold text-ink-soft">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving || !name.trim()}
            className="flex-1 rounded-xl bg-brand-red py-2.5 font-bold text-white disabled:opacity-50"
          >
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

function TrackFormModal({
  track,
  programs,
  onClose,
  onSaved,
}: {
  track: Track | null
  programs: Program[]
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(track?.title ?? '')
  const [description, setDescription] = useState(track?.description ?? '')
  const [objetivoGeral, setObjetivoGeral] = useState(track?.objetivo_geral ?? '')
  const [publicoAlvo, setPublicoAlvo] = useState(track?.publico_alvo ?? '')
  const [preRequisitos, setPreRequisitos] = useState(track?.pre_requisitos ?? '')
  const [cargaHoraria, setCargaHoraria] = useState(track?.carga_horaria_total?.toString() ?? '')
  const [certificateEnabled, setCertificateEnabled] = useState(track?.certificate_enabled ?? false)
  const [sequential, setSequential] = useState(track?.sequential ?? false)
  const [published, setPublished] = useState(track?.published ?? true)
  const [programId, setProgramId] = useState(track?.program_id ?? programs[0]?.id ?? '')
  const [profile, setProfile] = useState<DiagnosticProfile>(track?.diagnostic_profile ?? 'autogestao')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
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
        program_id: programId,
        diagnostic_profile: profile,
        cover_url: coverUrl,
        thumbnail_url: thumbnailUrl,
      }
      const { error: saveError } = track
        ? await supabase.from('tracks').update(payload).eq('id', track.id)
        : await supabase.from('tracks').insert(payload)
      if (saveError) throw saveError
    } catch (err) {
      // Erros do Supabase (PostgrestError) não são `instanceof Error`, então
      // `err instanceof Error` sempre falhava aqui e escondia o motivo real
      // (ex: coluna inexistente no banco) atrás de uma mensagem genérica.
      const message = (err as { message?: string } | null)?.message
      setError(message || 'Falha ao salvar o curso.')
      setSaving(false)
      return
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card max-h-[85vh] w-full max-w-lg space-y-3 overflow-y-auto p-6">
        <h3 className="text-lg font-bold text-ink">{track ? 'Editar curso' : 'Novo curso'}</h3>

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

        <label className="block text-xs font-semibold text-ink-soft">Carga horária total (horas)</label>
        <input
          type="number"
          min={0}
          className="w-full rounded-xl border border-navy-light px-4 py-3"
          placeholder="Ex: 40"
          value={cargaHoraria}
          onChange={(e) => setCargaHoraria(e.target.value)}
        />

        <select className="w-full rounded-xl border border-navy-light px-4 py-3" value={programId} onChange={(e) => setProgramId(e.target.value)}>
          {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="w-full rounded-xl border border-navy-light px-4 py-3" value={profile} onChange={(e) => setProfile(e.target.value as DiagnosticProfile)}>
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
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [pointsOverride, setPointsOverride] = useState(pill?.points_override != null ? String(pill.points_override) : '')
  const [categoryId, setCategoryId] = useState(pill?.category_id ?? '')
  const [required, setRequired] = useState(pill?.required ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (contentType !== 'scorm') return
    supabase.from('scorm_library').select('*').order('name').then(({ data }) => {
      setScormLibrary((data as ScormLibraryItem[]) ?? [])
    })
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
        // Picking a library entry replaces any older direct-upload SCORM
        // fields; leaving no library selected keeps them untouched so
        // pills uploaded before the library existed keep working.
        ...(contentType === 'scorm' && scormLibraryId
          ? { scorm_package_url: null, scorm_manifest_path: null }
          : {}),
        cover_url: coverUrl,
        thumbnail_url: thumbnailUrl,
        points_override: pointsOverride === '' ? null : Number(pointsOverride),
        category_id: categoryId || null,
        required,
      }
      if (pill) {
        const { error: saveError } = await supabase.from('pills').update(payload).eq('id', pill.id)
        if (saveError) throw saveError
      } else {
        const { data: newPill, error: saveError } = await supabase.from('pills').insert(payload).select('id').single()
        if (saveError) throw saveError
        // Nova pílula nasce vinculada à trilha em que foi criada (spec:
        // criar trilhas com cursos — track_pills é quem manda na exibição).
        await linkPillToTrack(trackId, newPill.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar a pílula.')
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
          <p className="rounded-xl border border-navy-light bg-bg px-4 py-3 text-xs text-ink-soft">
            Esta pílula não tem vídeo/arquivo — ela é a própria avaliação de reação. Depois de salvar, cadastre as
            perguntas dela em <strong>Quizzes → {title || 'esta pílula'}</strong>.
          </p>
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
