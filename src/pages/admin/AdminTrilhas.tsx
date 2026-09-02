import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminLayout } from './AdminLayout'
import { useConfirm } from '../../components/ConfirmDialog'
import { formatCargaHoraria } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Category, DashboardSection, Pill, Program, Track, TrackPill } from '../../types/database'

export function AdminTrilhas() {
  const confirm = useConfirm()
  const [tracks, setTracks] = useState<Track[]>([])
  const [pills, setPills] = useState<Pill[]>([])
  const [trackPills, setTrackPills] = useState<TrackPill[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [sections, setSections] = useState<DashboardSection[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryForm, setCategoryForm] = useState<Category | 'new' | null>(null)
  const [search, setSearch] = useState('')
  const [trackFilter, setTrackFilter] = useState<string>('all')

  async function togglePublished(track: Track) {
    await supabase.from('tracks').update({ published: !track.published }).eq('id', track.id)
    reload()
  }

  async function deleteTrack(id: string) {
    if (
      !(await confirm(
        'Excluir este curso? O vínculo com as aulas dele é removido (as aulas em si só somem se não pertencerem a outro curso).',
        { danger: true, confirmLabel: 'Excluir' },
      ))
    )
      return
    const { error } = await supabase.from('tracks').delete().eq('id', id)
    if (error) {
      alert(error.message)
      return
    }
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
        <summary className="cursor-pointer font-bold text-ink">Seções de Cursos</summary>
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
          <option value="all">Todos os cursos</option>
          {tracks.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
        <Link to="/admin/scorms" className="rounded-xl border border-navy-light px-4 py-2.5 text-sm font-semibold text-navy hover:border-navy">
          Biblioteca de SCORMs
        </Link>
        <Link
          to="/admin/trilhas/novo"
          className="rounded-xl bg-brand-red px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-red-dark"
        >
          + Novo curso
        </Link>
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
                    {track.program_id
                      ? `${programs.find((p) => p.id === track.program_id)?.name} · ${track.diagnostic_profile ?? 'sem perfil'}`
                      : 'Programa/perfil não definidos'}
                    {track.carga_horaria_total != null && <> · {formatCargaHoraria(track.carga_horaria_total)}</>}
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
                  <Link
                    to={`/admin/trilhas/${track.id}`}
                    className="rounded-lg border border-navy-light px-3 py-1.5 text-xs font-semibold text-navy hover:border-navy"
                  >
                    Editar
                  </Link>
                  <button
                    onClick={() => deleteTrack(track.id)}
                    className="rounded-lg border border-brand-red/30 px-3 py-1.5 text-xs font-semibold text-brand-red hover:border-brand-red"
                  >
                    Excluir curso
                  </button>
                </div>
              </div>
              <p className="mt-3 text-xs text-ink-soft">
                {pillsFor(track.id).length} {pillsFor(track.id).length === 1 ? 'aula' : 'aulas'} — gerencie em "Editar"
              </p>
            </div>
          </div>
        ))}
        {visibleTracks.length === 0 && <p className="text-ink-soft">Nenhum curso encontrado.</p>}
      </div>

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

