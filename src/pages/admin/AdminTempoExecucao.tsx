import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from './AdminLayout'
import { formatCargaHoraria } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Pill, Profile, Track } from '../../types/database'

interface CompletionRow {
  userId: string
  userName: string
  trackId: string
  trackTitle: string
  certificateEnabled: boolean
  cargaHorariaTotal: number | null
  startedAt: string | null
  completedAt: string
  durationMinutes: number | null
}

type SortField = 'duracao' | 'conclusao' | 'aluno' | 'curso'

// Sinaliza como "rápido demais" quando o aluno levou menos de 30% da
// carga horária cadastrada do curso — só dá pra calcular quando o curso
// tem carga_horaria_total preenchida.
const SUSPICIOUS_RATIO = 0.3

function formatDurationMinutes(minutes: number): string {
  const rounded = Math.round(minutes)
  if (rounded < 1) return '<1min'
  return formatCargaHoraria(rounded)
}

export function AdminTempoExecucao() {
  const [rows, setRows] = useState<CompletionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [trackFilter, setTrackFilter] = useState('')
  const [search, setSearch] = useState('')
  const [onlySuspicious, setOnlySuspicious] = useState(false)
  const [sortField, setSortField] = useState<SortField>('duracao')

  useEffect(() => {
    async function load() {
      const [{ data: tracks }, { data: pills }, { data: progress }, { data: starts }, { data: profiles }] = await Promise.all([
        supabase.from('tracks').select('id, title, carga_horaria_total, certificate_enabled'),
        supabase.from('pills').select('id, track_id'),
        supabase.from('user_progress').select('user_id, pill_id, completed_at').not('completed_at', 'is', null),
        supabase.from('user_points_events').select('user_id, ref_id, created_at').eq('rule_key', 'pill_started'),
        supabase.from('profiles').select('id, name').eq('role', 'aluno'),
      ])

      const tracksArr = (tracks as Pick<Track, 'id' | 'title' | 'carga_horaria_total' | 'certificate_enabled'>[]) ?? []
      const pillsArr = (pills as Pick<Pill, 'id' | 'track_id'>[]) ?? []
      const progressArr = (progress as { user_id: string; pill_id: string; completed_at: string }[]) ?? []
      const startsArr = (starts as { user_id: string; ref_id: string; created_at: string }[]) ?? []
      const profilesArr = (profiles as Pick<Profile, 'id' | 'name'>[]) ?? []
      const studentIds = new Set(profilesArr.map((p) => p.id))
      const nameById = new Map(profilesArr.map((p) => [p.id, p.name]))

      const pillsByTrack = new Map<string, string[]>()
      for (const p of pillsArr) {
        const arr = pillsByTrack.get(p.track_id) ?? []
        arr.push(p.id)
        pillsByTrack.set(p.track_id, arr)
      }

      // completedAt[userId][pillId] / startedAt[userId][pillId]
      const completedAt = new Map<string, Map<string, string>>()
      for (const row of progressArr) {
        if (!studentIds.has(row.user_id)) continue
        const byPill = completedAt.get(row.user_id) ?? new Map<string, string>()
        byPill.set(row.pill_id, row.completed_at)
        completedAt.set(row.user_id, byPill)
      }
      const startedAt = new Map<string, Map<string, string>>()
      for (const row of startsArr) {
        if (!studentIds.has(row.user_id)) continue
        const byPill = startedAt.get(row.user_id) ?? new Map<string, string>()
        byPill.set(row.ref_id, row.created_at)
        startedAt.set(row.user_id, byPill)
      }

      const result: CompletionRow[] = []
      for (const track of tracksArr) {
        const pillIds = pillsByTrack.get(track.id) ?? []
        if (pillIds.length === 0) continue
        for (const userId of completedAt.keys()) {
          const userCompleted = completedAt.get(userId)!
          if (!pillIds.every((pid) => userCompleted.has(pid))) continue

          const completedTimes = pillIds.map((pid) => userCompleted.get(pid)!)
          const lastCompletedAt = completedTimes.reduce((a, b) => (a > b ? a : b))

          const userStarted = startedAt.get(userId)
          const startTimes = userStarted ? pillIds.map((pid) => userStarted.get(pid)).filter((v): v is string => !!v) : []
          const firstStartedAt = startTimes.length > 0 ? startTimes.reduce((a, b) => (a < b ? a : b)) : null

          const durationMinutes = firstStartedAt
            ? (new Date(lastCompletedAt).getTime() - new Date(firstStartedAt).getTime()) / 60_000
            : null

          result.push({
            userId,
            userName: nameById.get(userId) ?? '—',
            trackId: track.id,
            trackTitle: track.title,
            certificateEnabled: track.certificate_enabled,
            cargaHorariaTotal: track.carga_horaria_total,
            startedAt: firstStartedAt,
            completedAt: lastCompletedAt,
            durationMinutes,
          })
        }
      }

      setRows(result)
      setLoading(false)
    }
    load()
  }, [])

  const trackOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.trackTitle))).sort((a, b) => a.localeCompare(b)),
    [rows],
  )

  function isSuspicious(r: CompletionRow) {
    return r.durationMinutes != null && r.cargaHorariaTotal != null && r.cargaHorariaTotal > 0
      ? r.durationMinutes < r.cargaHorariaTotal * SUSPICIOUS_RATIO
      : false
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = rows.filter((r) => {
      if (trackFilter && r.trackTitle !== trackFilter) return false
      if (q && !r.userName.toLowerCase().includes(q)) return false
      if (onlySuspicious && !isSuspicious(r)) return false
      return true
    })
    const sorted = [...list].sort((a, b) => {
      switch (sortField) {
        case 'aluno':
          return a.userName.localeCompare(b.userName)
        case 'curso':
          return a.trackTitle.localeCompare(b.trackTitle)
        case 'conclusao':
          return b.completedAt.localeCompare(a.completedAt)
        case 'duracao':
        default: {
          // Sem tempo de início (duração desconhecida) vai pro final da
          // lista, em vez de disputar o topo do "mais rápido" por acaso.
          if (a.durationMinutes == null && b.durationMinutes == null) return 0
          if (a.durationMinutes == null) return 1
          if (b.durationMinutes == null) return -1
          return a.durationMinutes - b.durationMinutes
        }
      }
    })
    return sorted
  }, [rows, trackFilter, search, onlySuspicious, sortField])

  const byCourse = useMemo(() => {
    const grouped = new Map<string, { title: string; durations: number[]; total: number }>()
    for (const r of rows) {
      const entry = grouped.get(r.trackId) ?? { title: r.trackTitle, durations: [], total: 0 }
      entry.total += 1
      if (r.durationMinutes != null) entry.durations.push(r.durationMinutes)
      grouped.set(r.trackId, entry)
    }
    return Array.from(grouped.values())
      .map((e) => ({
        title: e.title,
        total: e.total,
        avg: e.durations.length ? e.durations.reduce((a, b) => a + b, 0) / e.durations.length : null,
        min: e.durations.length ? Math.min(...e.durations) : null,
      }))
      .sort((a, b) => b.total - a.total)
  }, [rows])

  function toggleSort(field: SortField) {
    setSortField(field)
  }

  return (
    <AdminLayout>
      <h1 className="text-lg font-bold text-ink">Tempo de execução dos cursos</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Tempo entre o início e a conclusão de cada curso (da primeira aula iniciada até a última concluída) e quantas
        vezes cada curso foi concluído — útil pra identificar conclusões rápidas demais pra serem reais.
      </p>

      {loading ? (
        <p className="mt-6 text-ink-soft">Carregando…</p>
      ) : (
        <>
          <div className="card mt-5 p-5">
            <h2 className="font-bold text-ink">Conclusões por curso</h2>
            <div className="mt-4 max-h-72 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-ink-soft">
                    <th className="pb-2">Curso</th>
                    <th className="pb-2 text-right">Conclusões</th>
                    <th className="pb-2 text-right">Duração média</th>
                    <th className="pb-2 text-right">Duração mínima</th>
                  </tr>
                </thead>
                <tbody>
                  {byCourse.map((c) => (
                    <tr key={c.title} className="border-t border-navy-light/60">
                      <td className="py-2 font-medium text-ink">{c.title}</td>
                      <td className="py-2 text-right text-navy font-semibold">{c.total}</td>
                      <td className="py-2 text-right text-ink-soft">{c.avg != null ? formatDurationMinutes(c.avg) : '—'}</td>
                      <td className="py-2 text-right text-ink-soft">{c.min != null ? formatDurationMinutes(c.min) : '—'}</td>
                    </tr>
                  ))}
                  {byCourse.length === 0 && (
                    <tr><td colSpan={4} className="py-3 text-ink-soft">Nenhuma conclusão registrada ainda.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card mt-5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold text-ink">Conclusões por aluno</h2>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="rounded-lg border border-navy-light px-3 py-1.5 text-sm"
                  placeholder="Buscar aluno…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  className="rounded-lg border border-navy-light px-3 py-1.5 text-sm"
                  value={trackFilter}
                  onChange={(e) => setTrackFilter(e.target.value)}
                >
                  <option value="">Todos os cursos</option>
                  {trackOptions.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
                  <input type="checkbox" checked={onlySuspicious} onChange={(e) => setOnlySuspicious(e.target.checked)} />
                  Só rápidas demais
                </label>
              </div>
            </div>
            <p className="mt-1 text-xs text-ink-soft">
              ⚠️ marca quando a duração ficou abaixo de {Math.round(SUSPICIOUS_RATIO * 100)}% da carga horária
              cadastrada do curso (só calculável em cursos com carga horária definida).
            </p>

            <div className="mt-4 max-h-[32rem] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-ink-soft">
                    <th className="cursor-pointer pb-2 pr-4" onClick={() => toggleSort('aluno')}>Aluno</th>
                    <th className="cursor-pointer pb-2 pr-4" onClick={() => toggleSort('curso')}>Curso</th>
                    <th className="pb-2 pr-4 text-right">Carga horária</th>
                    <th className="pb-2 pr-4 text-right">Início</th>
                    <th className="cursor-pointer pb-2 pr-4 text-right" onClick={() => toggleSort('conclusao')}>Conclusão</th>
                    <th className="cursor-pointer pb-2 text-right" onClick={() => toggleSort('duracao')}>Duração</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const suspicious = isSuspicious(r)
                    return (
                      <tr key={`${r.userId}-${r.trackId}`} className="border-t border-navy-light/60">
                        <td className="py-2 pr-4 font-medium text-ink">{r.userName}</td>
                        <td className="py-2 pr-4 text-ink-soft">
                          {r.trackTitle}
                          {r.certificateEnabled && (
                            <span className="ml-1.5 rounded-full bg-chip px-1.5 py-0.5 text-[10px] font-bold text-navy">🏆</span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-right text-ink-soft">{formatCargaHoraria(r.cargaHorariaTotal)}</td>
                        <td className="py-2 pr-4 text-right text-ink-soft">
                          {r.startedAt ? new Date(r.startedAt).toLocaleString('pt-BR') : '—'}
                        </td>
                        <td className="py-2 pr-4 text-right text-ink-soft">{new Date(r.completedAt).toLocaleString('pt-BR')}</td>
                        <td className={`py-2 text-right font-semibold ${suspicious ? 'text-brand-red' : 'text-navy'}`}>
                          {r.durationMinutes != null ? formatDurationMinutes(r.durationMinutes) : '—'}
                          {suspicious && ' ⚠️'}
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="py-3 text-ink-soft">Nenhuma conclusão encontrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  )
}
