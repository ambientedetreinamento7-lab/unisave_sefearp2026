import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AdminLayout } from './AdminLayout'
import { getIssuedCertificates } from '../../lib/api'
import { getLevels, getRules, levelForPoints } from '../../lib/gamification'
import { TIER_LABEL } from '../../lib/pdiTier'
import { supabase } from '../../lib/supabase'
import type {
  GamificationLevel,
  GamificationRule,
  IssuedCertificate,
  PdiPlan,
  PdiTier,
  Pill,
  Profile,
  Program,
  SkillCategory,
  SkillRating,
  SocialComment,
  SocialLike,
  SocialPost,
  Track,
  TrackPill,
  UserPointsEvent,
  UserProgress,
} from '../../types/database'

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function CsvButton({ filename, headers, rows }: { filename: string; headers: string[]; rows: (string | number)[][] }) {
  return (
    <button
      onClick={() => downloadCsv(filename, headers, rows)}
      className="rounded-lg border border-navy-light px-3 py-1.5 text-xs font-semibold text-navy hover:border-navy"
    >
      Baixar CSV
    </button>
  )
}

const TIER_ORDER: PdiTier[] = ['abaixo', 'proximo', 'dentro', 'acima']

type SubTab = 'geral' | 'cursos' | 'alunos' | 'pdi' | 'gamificacao' | 'comunidade' | 'certificados'

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'geral', label: 'Visão Geral' },
  { key: 'cursos', label: 'Cursos' },
  { key: 'alunos', label: 'Alunos' },
  { key: 'pdi', label: 'PDI & Competências' },
  { key: 'gamificacao', label: 'Gamificação' },
  { key: 'comunidade', label: 'Comunidade' },
  { key: 'certificados', label: 'Certificados' },
]

type StudentRow = {
  id: string
  nome: string
  programaId: string
  programa: string
  pontos: number
  nivel: string
  cursosConcluidos: number
  streak: number
  ultimoAcesso: string
}

type StudentSortField = 'nome' | 'pontos' | 'cursosConcluidos' | 'streak'

export function AdminAnalytics() {
  const [subTab, setSubTab] = useState<SubTab>('geral')
  const [funnel, setFunnel] = useState<{ stage: string; value: number }[]>([])
  const [byProgram, setByProgram] = useState<{ program: string; alunos: number }[]>([])
  const [tierDist, setTierDist] = useState<{ tier: PdiTier; alunos: number }[]>([])
  const [completionByTrack, setCompletionByTrack] = useState<
    { track: string; iniciados: number; concluidos: number; taxa: number }[]
  >([])
  const [quizByTrack, setQuizByTrack] = useState<{ track: string; notaMedia: number; respostas: number }[]>([])
  const [pillAccessTop, setPillAccessTop] = useState<{ pill: string; track: string; acessos: number }[]>([])
  const [pillAccessBottom, setPillAccessBottom] = useState<{ pill: string; track: string; acessos: number }[]>([])
  const [skillGap, setSkillGap] = useState<
    { skill: string; autoavaliacao: number; moderador: number | null; gap: number | null }[]
  >([])
  const [pointsByRule, setPointsByRule] = useState<{ regra: string; eventos: number; pontosTotais: number }[]>([])
  const [levelDist, setLevelDist] = useState<{ nivel: string; alunos: number }[]>([])
  const [postsByType, setPostsByType] = useState<{ tipo: string; total: number; publicados: number; pendentes: number }[]>([])
  const [communityTotals, setCommunityTotals] = useState({ posts: 0, curtidas: 0, comentarios: 0 })
  const [topActive, setTopActive] = useState<{ nome: string; posts: number; comentarios: number; curtidas: number; total: number }[]>([])
  const [summary, setSummary] = useState({
    alunos: 0,
    comPlano: 0,
    notaMediaQuiz: 0,
    taxaConclusaoGeral: 0,
    certificadosEmitidos: 0,
    pontosMedios: 0,
  })
  const [students, setStudents] = useState<StudentRow[]>([])
  const [studentSearch, setStudentSearch] = useState('')
  const [studentProgramFilter, setStudentProgramFilter] = useState('')
  const [studentSortField, setStudentSortField] = useState<StudentSortField>('pontos')
  const [studentSortDir, setStudentSortDir] = useState<'asc' | 'desc'>('desc')
  const [programOptions, setProgramOptions] = useState<{ id: string; name: string }[]>([])
  const [issuedCertificates, setIssuedCertificates] = useState<IssuedCertificate[]>([])
  const [certFilterName, setCertFilterName] = useState('')
  const [certFilterTrackId, setCertFilterTrackId] = useState('')
  const [certFilterFrom, setCertFilterFrom] = useState('')
  const [certFilterTo, setCertFilterTo] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [
        { data: profiles },
        { data: plans },
        { data: progress },
        { data: programs },
        { data: tracks },
        { data: trackPills },
        { data: pills },
        { data: skillCategories },
        { data: skillRatings },
        { count: certificadosEmitidos },
        { data: pointsEvents },
        { data: posts },
        { data: likes },
        { data: comments },
        levels,
        rules,
        issued,
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'aluno'),
        supabase.from('pdi_plans').select('*'),
        supabase.from('user_progress').select('*'),
        supabase.from('programs').select('*'),
        supabase.from('tracks').select('*'),
        supabase.from('track_pills').select('*'),
        supabase.from('pills').select('*'),
        supabase.from('skill_categories').select('*'),
        supabase.from('skill_ratings').select('*'),
        supabase.from('issued_certificates').select('*', { count: 'exact', head: true }),
        supabase.from('user_points_events').select('*'),
        supabase.from('social_posts').select('*'),
        supabase.from('social_likes').select('*'),
        supabase.from('social_comments').select('*'),
        getLevels(),
        getRules(),
        getIssuedCertificates(),
      ])
      setIssuedCertificates(issued)

      const profilesArr = (profiles as Profile[]) ?? []
      const plansArr = (plans as PdiPlan[]) ?? []
      const progressArr = (progress as UserProgress[]) ?? []
      const programsArr = (programs as Program[]) ?? []
      const tracksArr = (tracks as Track[]) ?? []
      const trackPillsArr = (trackPills as TrackPill[]) ?? []
      const pillsArr = (pills as Pill[]) ?? []
      const skillCategoriesArr = (skillCategories as SkillCategory[]) ?? []
      const skillRatingsArr = (skillRatings as SkillRating[]) ?? []
      const pointsEventsArr = (pointsEvents as UserPointsEvent[]) ?? []
      const postsArr = (posts as SocialPost[]) ?? []
      const likesArr = (likes as SocialLike[]) ?? []
      const commentsArr = (comments as SocialComment[]) ?? []
      const levelsArr = levels as GamificationLevel[]
      const rulesArr = rules as GamificationRule[]

      const cadastros = profilesArr.length
      const comTrilha = profilesArr.filter((p) => p.selected_track_id).length
      const comPlano = new Set(plansArr.map((p) => p.user_id)).size
      const completaram = new Set(progressArr.filter((p) => p.status === 'completed').map((p) => p.user_id)).size

      setFunnel([
        { stage: 'Quiz iniciado (cadastros)', value: cadastros },
        { stage: 'Curso vinculado', value: comTrilha },
        { stage: 'Plano de PDI criado', value: comPlano },
        { stage: 'Ao menos 1 aula concluída', value: completaram },
      ])

      const grouped = new Map<string, number>()
      for (const p of profilesArr) {
        if (!p.program_id) continue
        grouped.set(p.program_id, (grouped.get(p.program_id) ?? 0) + 1)
      }
      const programMap = new Map(programsArr.map((p) => [p.id, p.name]))
      setByProgram(
        Array.from(grouped.entries()).map(([id, count]) => ({
          program: programMap.get(id) ?? id,
          alunos: count,
        })),
      )
      setProgramOptions(programsArr.map((p) => ({ id: p.id, name: p.name })))

      const tierCounts = new Map<PdiTier, Set<string>>(TIER_ORDER.map((t) => [t, new Set<string>()]))
      for (const plan of plansArr) {
        if (plan.tier) tierCounts.get(plan.tier)?.add(plan.user_id)
      }
      setTierDist(TIER_ORDER.map((tier) => ({ tier, alunos: tierCounts.get(tier)?.size ?? 0 })))

      const pillToTrack = new Map<string, string>()
      for (const tp of trackPillsArr) pillToTrack.set(tp.pill_id, tp.track_id)
      const trackNames = new Map(tracksArr.map((t) => [t.id, t.title]))
      const started = new Map<string, number>()
      const completed = new Map<string, number>()
      for (const row of progressArr) {
        const trackId = pillToTrack.get(row.pill_id)
        if (!trackId) continue
        started.set(trackId, (started.get(trackId) ?? 0) + 1)
        if (row.status === 'completed') completed.set(trackId, (completed.get(trackId) ?? 0) + 1)
      }
      setCompletionByTrack(
        Array.from(started.entries())
          .map(([trackId, iniciados]) => {
            const concluidos = completed.get(trackId) ?? 0
            return {
              track: trackNames.get(trackId) ?? trackId,
              iniciados,
              concluidos,
              taxa: iniciados ? Math.round((concluidos / iniciados) * 100) : 0,
            }
          })
          .sort((a, b) => b.iniciados - a.iniciados),
      )

      const quizScoresByTrack = new Map<string, number[]>()
      for (const row of progressArr) {
        if (row.quiz_score == null) continue
        const trackId = pillToTrack.get(row.pill_id)
        if (!trackId) continue
        const arr = quizScoresByTrack.get(trackId) ?? []
        arr.push(row.quiz_score)
        quizScoresByTrack.set(trackId, arr)
      }
      setQuizByTrack(
        Array.from(quizScoresByTrack.entries())
          .map(([trackId, scores]) => ({
            track: trackNames.get(trackId) ?? trackId,
            notaMedia: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
            respostas: scores.length,
          }))
          .sort((a, b) => b.respostas - a.respostas),
      )

      const pillsRanked = pillsArr
        .map((p) => ({ pill: p.title, track: trackNames.get(pillToTrack.get(p.id) ?? '') ?? '—', acessos: p.access_count }))
        .sort((a, b) => b.acessos - a.acessos)
      setPillAccessTop(pillsRanked.slice(0, 10))
      setPillAccessBottom([...pillsRanked].reverse().slice(0, 10))

      setSkillGap(
        skillCategoriesArr.map((cat) => {
          const ratings = skillRatingsArr.filter((r) => r.skill_category_id === cat.id)
          const selfVals = ratings.map((r) => r.self_rating).filter((v): v is number => v != null)
          const modVals = ratings.map((r) => r.moderator_rating).filter((v): v is number => v != null)
          const avgSelf = selfVals.length ? selfVals.reduce((a, b) => a + b, 0) / selfVals.length : 0
          const avgMod = modVals.length ? modVals.reduce((a, b) => a + b, 0) / modVals.length : null
          return {
            skill: cat.name,
            autoavaliacao: Math.round(avgSelf * 10) / 10,
            moderador: avgMod != null ? Math.round(avgMod * 10) / 10 : null,
            gap: avgMod != null ? Math.round((avgSelf - avgMod) * 10) / 10 : null,
          }
        }),
      )

      const ruleLabel = new Map(rulesArr.map((r) => [r.key, r.label]))
      const ruleAgg = new Map<string, { eventos: number; pontosTotais: number }>()
      for (const ev of pointsEventsArr) {
        const cur = ruleAgg.get(ev.rule_key) ?? { eventos: 0, pontosTotais: 0 }
        cur.eventos += 1
        cur.pontosTotais += ev.points
        ruleAgg.set(ev.rule_key, cur)
      }
      setPointsByRule(
        Array.from(ruleAgg.entries())
          .map(([key, agg]) => ({ regra: ruleLabel.get(key) ?? key, ...agg }))
          .sort((a, b) => b.pontosTotais - a.pontosTotais),
      )

      const levelCounts = new Map<string, number>(levelsArr.map((l) => [l.name, 0]))
      for (const p of profilesArr) {
        const lvl = levelForPoints(p.total_points, levelsArr)
        if (lvl) levelCounts.set(lvl.name, (levelCounts.get(lvl.name) ?? 0) + 1)
      }
      setLevelDist(levelsArr.map((l) => ({ nivel: l.name, alunos: levelCounts.get(l.name) ?? 0 })))

      const typeAgg = new Map<string, { total: number; publicados: number; pendentes: number }>()
      for (const post of postsArr) {
        const cur = typeAgg.get(post.post_type) ?? { total: 0, publicados: 0, pendentes: 0 }
        cur.total += 1
        if (post.published) cur.publicados += 1
        else cur.pendentes += 1
        typeAgg.set(post.post_type, cur)
      }
      setPostsByType(Array.from(typeAgg.entries()).map(([tipo, agg]) => ({ tipo, ...agg })))
      setCommunityTotals({ posts: postsArr.length, curtidas: likesArr.length, comentarios: commentsArr.length })

      const activity = new Map<string, { nome: string; posts: number; comentarios: number; curtidas: number }>()
      function bump(id: string, nome: string, field: 'posts' | 'comentarios' | 'curtidas') {
        const cur = activity.get(id) ?? { nome, posts: 0, comentarios: 0, curtidas: 0 }
        cur[field] += 1
        activity.set(id, cur)
      }
      for (const post of postsArr) bump(post.author_id, post.author_name, 'posts')
      for (const c of commentsArr) bump(c.author_id, c.author_name, 'comentarios')
      for (const l of likesArr) bump(l.user_id, l.user_name, 'curtidas')
      setTopActive(
        Array.from(activity.values())
          .map((a) => ({ ...a, total: a.posts + a.comentarios + a.curtidas }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 10),
      )

      const scores = progressArr.filter((p) => p.status === 'completed' && p.quiz_score != null).map((p) => p.quiz_score!)
      const notaMediaQuiz = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
      const totalProgress = progressArr.length
      const totalCompleted = progressArr.filter((p) => p.status === 'completed').length
      const taxaConclusaoGeral = totalProgress ? Math.round((totalCompleted / totalProgress) * 100) : 0
      const pontosMedios = cadastros
        ? Math.round(profilesArr.reduce((sum, p) => sum + p.total_points, 0) / cadastros)
        : 0

      const completedByUser = new Map<string, number>()
      for (const row of progressArr) {
        if (row.status !== 'completed') continue
        completedByUser.set(row.user_id, (completedByUser.get(row.user_id) ?? 0) + 1)
      }
      setStudents(
        profilesArr.map((p) => ({
          id: p.id,
          nome: p.name,
          programaId: p.program_id ?? '',
          programa: programMap.get(p.program_id ?? '') ?? '—',
          pontos: p.total_points,
          nivel: levelForPoints(p.total_points, levelsArr)?.name ?? '—',
          cursosConcluidos: completedByUser.get(p.id) ?? 0,
          streak: p.access_streak,
          ultimoAcesso: p.last_access_date ? new Date(p.last_access_date).toLocaleDateString('pt-BR') : '—',
        })),
      )

      setSummary({
        alunos: cadastros,
        comPlano,
        notaMediaQuiz,
        taxaConclusaoGeral,
        certificadosEmitidos: certificadosEmitidos ?? 0,
        pontosMedios,
      })
      setLoading(false)
    }
    load()
  }, [])

  function toggleStudentSort(field: StudentSortField) {
    if (field === studentSortField) {
      setStudentSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setStudentSortField(field)
      setStudentSortDir(field === 'nome' ? 'asc' : 'desc')
    }
  }

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase()
    return students
      .filter((s) => (!q || s.nome.toLowerCase().includes(q)) && (!studentProgramFilter || s.programaId === studentProgramFilter))
      .sort((a, b) => {
        const dir = studentSortDir === 'asc' ? 1 : -1
        if (studentSortField === 'nome') return a.nome.localeCompare(b.nome) * dir
        return (a[studentSortField] - b[studentSortField]) * dir
      })
  }, [students, studentSearch, studentProgramFilter, studentSortField, studentSortDir])

  if (loading) return <AdminLayout><p className="text-ink-soft">Carregando…</p></AdminLayout>

  const certTrackOptions = Array.from(
    new Map(issuedCertificates.map((c) => [c.track_id, c.track_title])).entries(),
  ).sort((a, b) => a[1].localeCompare(b[1]))

  const filteredCertificates = issuedCertificates.filter((c) => {
    if (certFilterName && !c.student_name.toLowerCase().includes(certFilterName.toLowerCase())) return false
    if (certFilterTrackId && c.track_id !== certFilterTrackId) return false
    if (c.completed_at) {
      const completedDate = c.completed_at.slice(0, 10)
      if (certFilterFrom && completedDate < certFilterFrom) return false
      if (certFilterTo && completedDate > certFilterTo) return false
    } else if (certFilterFrom || certFilterTo) {
      return false
    }
    return true
  })

  return (
    <AdminLayout>
      <div className="mb-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Alunos cadastrados" value={summary.alunos} />
        <StatCard label="Com plano de PDI" value={summary.comPlano} />
        <StatCard label="Nota média de quiz" value={`${summary.notaMediaQuiz}%`} />
        <StatCard label="Taxa de conclusão geral" value={`${summary.taxaConclusaoGeral}%`} />
        <StatCard label="Pontos médios" value={summary.pontosMedios} />
        <StatCard label="Certificados emitidos" value={summary.certificadosEmitidos} />
      </div>

      <nav className="mb-6 flex flex-wrap gap-2">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              subTab === t.key ? 'bg-navy text-white' : 'bg-surface text-ink-soft hover:text-navy'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {subTab === 'geral' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card p-5">
            <h2 className="font-bold text-ink">Funil do evento</h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnel} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="stage" width={160} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#1A3B6E" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-bold text-ink">Alunos por curso (programa)</h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byProgram}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="program" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="alunos" fill="#E30613" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {subTab === 'cursos' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-ink">Conclusão por curso</h2>
              <CsvButton
                filename="conclusao-por-curso.csv"
                headers={['Curso', 'Iniciados', 'Concluídos', 'Taxa (%)']}
                rows={completionByTrack.map((r) => [r.track, r.iniciados, r.concluidos, r.taxa])}
              />
            </div>
            <div className="mt-4 max-h-72 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-ink-soft">
                    <th className="pb-2">Curso</th>
                    <th className="pb-2 text-right">Iniciados</th>
                    <th className="pb-2 text-right">Concluídos</th>
                    <th className="pb-2 text-right">Taxa</th>
                  </tr>
                </thead>
                <tbody>
                  {completionByTrack.map((r) => (
                    <tr key={r.track} className="border-t border-navy-light/60">
                      <td className="py-2 font-medium text-ink">{r.track}</td>
                      <td className="py-2 text-right text-ink-soft">{r.iniciados}</td>
                      <td className="py-2 text-right text-ink-soft">{r.concluidos}</td>
                      <td className="py-2 text-right font-semibold text-navy">{r.taxa}%</td>
                    </tr>
                  ))}
                  {completionByTrack.length === 0 && (
                    <tr><td colSpan={4} className="py-3 text-ink-soft">Sem dados ainda.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-ink">Nota média de quiz por curso</h2>
              <CsvButton
                filename="nota-media-quiz-por-curso.csv"
                headers={['Curso', 'Nota média (%)', 'Respostas']}
                rows={quizByTrack.map((r) => [r.track, r.notaMedia, r.respostas])}
              />
            </div>
            <div className="mt-4 max-h-72 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-ink-soft">
                    <th className="pb-2">Curso</th>
                    <th className="pb-2 text-right">Nota média</th>
                    <th className="pb-2 text-right">Respostas</th>
                  </tr>
                </thead>
                <tbody>
                  {quizByTrack.map((r) => (
                    <tr key={r.track} className="border-t border-navy-light/60">
                      <td className="py-2 font-medium text-ink">{r.track}</td>
                      <td className="py-2 text-right font-semibold text-navy">{r.notaMedia}%</td>
                      <td className="py-2 text-right text-ink-soft">{r.respostas}</td>
                    </tr>
                  ))}
                  {quizByTrack.length === 0 && (
                    <tr><td colSpan={3} className="py-3 text-ink-soft">Sem dados ainda.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-bold text-ink">Aulas mais acessadas</h2>
            <div className="mt-4 max-h-72 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-ink-soft">
                    <th className="pb-2">Aula</th>
                    <th className="pb-2">Curso</th>
                    <th className="pb-2 text-right">Acessos</th>
                  </tr>
                </thead>
                <tbody>
                  {pillAccessTop.map((r, i) => (
                    <tr key={i} className="border-t border-navy-light/60">
                      <td className="py-2 font-medium text-ink">{r.pill}</td>
                      <td className="py-2 text-ink-soft">{r.track}</td>
                      <td className="py-2 text-right font-semibold text-navy">{r.acessos}</td>
                    </tr>
                  ))}
                  {pillAccessTop.length === 0 && (
                    <tr><td colSpan={3} className="py-3 text-ink-soft">Sem dados ainda.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-bold text-ink">Aulas menos acessadas</h2>
            <div className="mt-4 max-h-72 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-ink-soft">
                    <th className="pb-2">Aula</th>
                    <th className="pb-2">Curso</th>
                    <th className="pb-2 text-right">Acessos</th>
                  </tr>
                </thead>
                <tbody>
                  {pillAccessBottom.map((r, i) => (
                    <tr key={i} className="border-t border-navy-light/60">
                      <td className="py-2 font-medium text-ink">{r.pill}</td>
                      <td className="py-2 text-ink-soft">{r.track}</td>
                      <td className="py-2 text-right font-semibold text-navy">{r.acessos}</td>
                    </tr>
                  ))}
                  {pillAccessBottom.length === 0 && (
                    <tr><td colSpan={3} className="py-3 text-ink-soft">Sem dados ainda.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {subTab === 'alunos' && (
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold text-ink">Alunos — pontuação, nível e progresso</h2>
            <CsvButton
              filename="alunos.csv"
              headers={['Nome', 'Programa', 'Pontos', 'Nível', 'Cursos concluídos', 'Streak de acesso', 'Último acesso']}
              rows={filteredStudents.map((s) => [s.nome, s.programa, s.pontos, s.nivel, s.cursosConcluidos, s.streak, s.ultimoAcesso])}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <input
              className="min-w-[200px] flex-1 rounded-lg border border-navy-light px-3 py-2 text-sm"
              placeholder="Buscar aluno…"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
            />
            <select
              className="rounded-lg border border-navy-light px-3 py-2 text-sm"
              value={studentProgramFilter}
              onChange={(e) => setStudentProgramFilter(e.target.value)}
            >
              <option value="">Todos os programas</option>
              {programOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="mt-4 max-h-[32rem] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-ink-soft">
                  <SortableHeader label="Aluno" field="nome" sortField={studentSortField} sortDir={studentSortDir} onClick={toggleStudentSort} />
                  <th className="px-3 pb-2">Programa</th>
                  <SortableHeader label="Pontos" field="pontos" sortField={studentSortField} sortDir={studentSortDir} onClick={toggleStudentSort} align="right" />
                  <th className="px-3 pb-2">Nível</th>
                  <SortableHeader label="Cursos concluídos" field="cursosConcluidos" sortField={studentSortField} sortDir={studentSortDir} onClick={toggleStudentSort} align="right" />
                  <SortableHeader label="Streak" field="streak" sortField={studentSortField} sortDir={studentSortDir} onClick={toggleStudentSort} align="right" />
                  <th className="px-3 pb-2">Último acesso</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s) => (
                  <tr key={s.id} className="border-t border-navy-light/60">
                    <td className="py-2 font-medium text-ink">{s.nome}</td>
                    <td className="px-3 py-2 text-ink-soft">{s.programa}</td>
                    <td className="px-3 py-2 text-right font-semibold text-navy">{s.pontos}</td>
                    <td className="px-3 py-2 text-ink-soft">{s.nivel}</td>
                    <td className="px-3 py-2 text-right text-ink-soft">{s.cursosConcluidos}</td>
                    <td className="px-3 py-2 text-right text-ink-soft">{s.streak}</td>
                    <td className="px-3 py-2 text-ink-soft">{s.ultimoAcesso}</td>
                  </tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr><td colSpan={7} className="py-3 text-ink-soft">Nenhum aluno encontrado com esses filtros.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'pdi' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-ink">Distribuição de faixas de PDI</h2>
              <CsvButton
                filename="faixas-pdi.csv"
                headers={['Faixa', 'Alunos']}
                rows={tierDist.map((r) => [TIER_LABEL[r.tier], r.alunos])}
              />
            </div>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tierDist.map((r) => ({ ...r, label: TIER_LABEL[r.tier] }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="alunos" fill="#1A3B6E" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-ink">Balanço de competências</h2>
              <CsvButton
                filename="balanco-competencias.csv"
                headers={['Competência', 'Autoavaliação média', 'Nota do moderador', 'Gap']}
                rows={skillGap.map((r) => [r.skill, r.autoavaliacao, r.moderador ?? '', r.gap ?? ''])}
              />
            </div>
            <div className="mt-4 max-h-80 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-ink-soft">
                    <th className="pb-2">Competência</th>
                    <th className="pb-2 text-right">Autoavaliação</th>
                    <th className="pb-2 text-right">Moderador</th>
                    <th className="pb-2 text-right">Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {skillGap.map((r) => (
                    <tr key={r.skill} className="border-t border-navy-light/60">
                      <td className="py-2 font-medium text-ink">{r.skill}</td>
                      <td className="py-2 text-right text-ink-soft">{r.autoavaliacao || '—'}</td>
                      <td className="py-2 text-right text-ink-soft">{r.moderador ?? '—'}</td>
                      <td className="py-2 text-right font-semibold text-navy">{r.gap ?? '—'}</td>
                    </tr>
                  ))}
                  {skillGap.length === 0 && (
                    <tr><td colSpan={4} className="py-3 text-ink-soft">Sem dados ainda.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {subTab === 'gamificacao' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-ink">Pontos concedidos por regra</h2>
              <CsvButton
                filename="pontos-por-regra.csv"
                headers={['Regra', 'Eventos', 'Pontos totais']}
                rows={pointsByRule.map((r) => [r.regra, r.eventos, r.pontosTotais])}
              />
            </div>
            <div className="mt-4 max-h-80 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-ink-soft">
                    <th className="pb-2">Regra</th>
                    <th className="pb-2 text-right">Eventos</th>
                    <th className="pb-2 text-right">Pontos totais</th>
                  </tr>
                </thead>
                <tbody>
                  {pointsByRule.map((r) => (
                    <tr key={r.regra} className="border-t border-navy-light/60">
                      <td className="py-2 font-medium text-ink">{r.regra}</td>
                      <td className="py-2 text-right text-ink-soft">{r.eventos}</td>
                      <td className="py-2 text-right font-semibold text-navy">{r.pontosTotais}</td>
                    </tr>
                  ))}
                  {pointsByRule.length === 0 && (
                    <tr><td colSpan={3} className="py-3 text-ink-soft">Sem dados ainda.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-bold text-ink">Distribuição de alunos por nível</h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={levelDist}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="nivel" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="alunos" fill="#E30613" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {subTab === 'comunidade' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="grid grid-cols-3 gap-4 lg:col-span-2">
            <StatCard label="Posts" value={communityTotals.posts} />
            <StatCard label="Curtidas" value={communityTotals.curtidas} />
            <StatCard label="Comentários" value={communityTotals.comentarios} />
          </div>

          <div className="card p-5">
            <h2 className="font-bold text-ink">Posts por tipo</h2>
            <div className="mt-4 max-h-72 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-ink-soft">
                    <th className="pb-2">Tipo</th>
                    <th className="pb-2 text-right">Total</th>
                    <th className="pb-2 text-right">Publicados</th>
                    <th className="pb-2 text-right">Pendentes</th>
                  </tr>
                </thead>
                <tbody>
                  {postsByType.map((r) => (
                    <tr key={r.tipo} className="border-t border-navy-light/60">
                      <td className="py-2 font-medium text-ink">{r.tipo}</td>
                      <td className="py-2 text-right text-ink-soft">{r.total}</td>
                      <td className="py-2 text-right text-ink-soft">{r.publicados}</td>
                      <td className="py-2 text-right text-ink-soft">{r.pendentes}</td>
                    </tr>
                  ))}
                  {postsByType.length === 0 && (
                    <tr><td colSpan={4} className="py-3 text-ink-soft">Sem dados ainda.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-ink">Alunos mais ativos na comunidade</h2>
              <CsvButton
                filename="alunos-mais-ativos.csv"
                headers={['Aluno', 'Posts', 'Comentários', 'Curtidas', 'Total']}
                rows={topActive.map((r) => [r.nome, r.posts, r.comentarios, r.curtidas, r.total])}
              />
            </div>
            <div className="mt-4 max-h-72 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-ink-soft">
                    <th className="pb-2">Aluno</th>
                    <th className="pb-2 text-right">Posts</th>
                    <th className="pb-2 text-right">Comentários</th>
                    <th className="pb-2 text-right">Curtidas</th>
                    <th className="pb-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {topActive.map((r, i) => (
                    <tr key={i} className="border-t border-navy-light/60">
                      <td className="py-2 font-medium text-ink">{r.nome}</td>
                      <td className="py-2 text-right text-ink-soft">{r.posts}</td>
                      <td className="py-2 text-right text-ink-soft">{r.comentarios}</td>
                      <td className="py-2 text-right text-ink-soft">{r.curtidas}</td>
                      <td className="py-2 text-right font-semibold text-navy">{r.total}</td>
                    </tr>
                  ))}
                  {topActive.length === 0 && (
                    <tr><td colSpan={5} className="py-3 text-ink-soft">Sem dados ainda.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {subTab === 'certificados' && (
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-ink">Certificados emitidos</h2>
            <CsvButton
              filename="certificados-emitidos.csv"
              headers={['Aluno', 'Curso', 'Código', 'Concluído em', 'Emitido em']}
              rows={filteredCertificates.map((c) => [
                c.student_name,
                c.track_title,
                c.code,
                c.completed_at ? new Date(c.completed_at).toLocaleDateString('pt-BR') : '—',
                new Date(c.issued_at).toLocaleDateString('pt-BR'),
              ])}
            />
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <input
              className="rounded-lg border border-navy-light px-3 py-2 text-sm"
              placeholder="Buscar aluno…"
              value={certFilterName}
              onChange={(e) => setCertFilterName(e.target.value)}
            />
            <select
              className="rounded-lg border border-navy-light px-3 py-2 text-sm"
              value={certFilterTrackId}
              onChange={(e) => setCertFilterTrackId(e.target.value)}
            >
              <option value="">Todos os cursos</option>
              {certTrackOptions.map(([trackId, title]) => (
                <option key={trackId} value={trackId}>{title}</option>
              ))}
            </select>
            <input
              type="date"
              className="rounded-lg border border-navy-light px-3 py-2 text-sm"
              value={certFilterFrom}
              onChange={(e) => setCertFilterFrom(e.target.value)}
              title="Concluído a partir de"
            />
            <input
              type="date"
              className="rounded-lg border border-navy-light px-3 py-2 text-sm"
              value={certFilterTo}
              onChange={(e) => setCertFilterTo(e.target.value)}
              title="Concluído até"
            />
          </div>

          <div className="mt-4 max-h-96 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-ink-soft">
                  <th className="pb-2">Aluno</th>
                  <th className="pb-2">Curso</th>
                  <th className="pb-2">Código</th>
                  <th className="pb-2">Concluído em</th>
                  <th className="pb-2">Emitido em</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredCertificates.map((c) => (
                  <tr key={c.id} className="border-t border-navy-light/60">
                    <td className="py-2 font-medium text-ink">{c.student_name}</td>
                    <td className="py-2 text-ink-soft">{c.track_title}</td>
                    <td className="py-2 font-mono text-xs text-ink-soft">{c.code}</td>
                    <td className="py-2 text-ink-soft">
                      {c.completed_at ? new Date(c.completed_at).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="py-2 text-ink-soft">{new Date(c.issued_at).toLocaleDateString('pt-BR')}</td>
                    <td className="py-2 text-right">
                      <a
                        href={`/validar-certificado?codigo=${c.code}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-navy hover:underline"
                      >
                        Ver certificado
                      </a>
                    </td>
                  </tr>
                ))}
                {filteredCertificates.length === 0 && (
                  <tr><td colSpan={6} className="py-3 text-ink-soft">Nenhum certificado encontrado com esses filtros.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-ink">{value}</p>
    </div>
  )
}

function SortableHeader({
  label,
  field,
  sortField,
  sortDir,
  onClick,
  align,
}: {
  label: string
  field: StudentSortField
  sortField: StudentSortField
  sortDir: 'asc' | 'desc'
  onClick: (field: StudentSortField) => void
  align?: 'right'
}) {
  const active = field === sortField
  return (
    <th className={`px-3 pb-2 ${align === 'right' ? 'text-right' : ''}`}>
      <button
        onClick={() => onClick(field)}
        className={`flex items-center gap-1 font-semibold uppercase tracking-wide hover:text-navy ${
          align === 'right' ? 'ml-auto' : ''
        } ${active ? 'text-navy' : ''}`}
      >
        {label}
        <span className="text-[10px]">{active ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
      </button>
    </th>
  )
}
