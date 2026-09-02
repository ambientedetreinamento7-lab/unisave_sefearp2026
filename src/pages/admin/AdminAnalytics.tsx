import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AdminLayout } from './AdminLayout'
import { getLevels, levelForPoints } from '../../lib/gamification'
import { TIER_LABEL } from '../../lib/pdiTier'
import { supabase } from '../../lib/supabase'
import type {
  GamificationLevel,
  PdiPlan,
  PdiTier,
  Pill,
  Profile,
  Program,
  ReactionAnswer,
  ReactionQuestion,
  ReactionResponse,
  ReactionSurvey,
  SkillCategory,
  SkillRating,
  Track,
  TrackPill,
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

export function AdminAnalytics() {
  const [funnel, setFunnel] = useState<{ stage: string; value: number }[]>([])
  const [byProgram, setByProgram] = useState<{ program: string; alunos: number }[]>([])
  const [tierDist, setTierDist] = useState<{ tier: PdiTier; alunos: number }[]>([])
  const [completionByTrack, setCompletionByTrack] = useState<
    { track: string; iniciados: number; concluidos: number; taxa: number }[]
  >([])
  const [skillGap, setSkillGap] = useState<
    { skill: string; autoavaliacao: number; moderador: number | null; gap: number | null }[]
  >([])
  const [reactionByModule, setReactionByModule] = useState<
    { pillId: string; modulo: string; respostas: number; nps: number | null; likertMedio: number | null }[]
  >([])
  const [openComments, setOpenComments] = useState<{ modulo: string; pergunta: string; comentario: string }[]>([])
  const [npsGeral, setNpsGeral] = useState<number | null>(null)
  const [likertGeral, setLikertGeral] = useState<number | null>(null)
  const [summary, setSummary] = useState({
    alunos: 0,
    comPlano: 0,
    notaMediaQuiz: 0,
    taxaConclusaoGeral: 0,
    certificadosEmitidos: 0,
    pontosMedios: 0,
  })
  const [students, setStudents] = useState<
    {
      id: string
      nome: string
      programa: string
      pontos: number
      nivel: string
      cursosConcluidos: number
      streak: number
      ultimoAcesso: string
    }[]
  >([])
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
        { data: skillCategories },
        { data: skillRatings },
        { count: certificadosEmitidos },
        levels,
        { data: pills },
        { data: reactionSurveys },
        { data: reactionQuestions },
        { data: reactionResponses },
        { data: reactionAnswers },
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'aluno'),
        supabase.from('pdi_plans').select('*'),
        supabase.from('user_progress').select('*'),
        supabase.from('programs').select('*'),
        supabase.from('tracks').select('*'),
        supabase.from('track_pills').select('*'),
        supabase.from('skill_categories').select('*'),
        supabase.from('skill_ratings').select('*'),
        supabase.from('issued_certificates').select('*', { count: 'exact', head: true }),
        getLevels(),
        supabase.from('pills').select('id, title'),
        supabase.from('reaction_surveys').select('*'),
        supabase.from('reaction_questions').select('*'),
        supabase.from('reaction_responses').select('*'),
        supabase.from('reaction_answers').select('*'),
      ])

      const profilesArr = (profiles as Profile[]) ?? []
      const plansArr = (plans as PdiPlan[]) ?? []
      const progressArr = (progress as UserProgress[]) ?? []
      const programsArr = (programs as Program[]) ?? []
      const tracksArr = (tracks as Track[]) ?? []
      const trackPillsArr = (trackPills as TrackPill[]) ?? []
      const skillCategoriesArr = (skillCategories as SkillCategory[]) ?? []
      const skillRatingsArr = (skillRatings as SkillRating[]) ?? []

      const cadastros = profilesArr.length
      const comTrilha = profilesArr.filter((p) => p.selected_track_id).length
      const comPlano = new Set(plansArr.map((p) => p.user_id)).size
      const completaram = new Set(progressArr.filter((p) => p.status === 'completed').map((p) => p.user_id)).size

      setFunnel([
        { stage: 'Quiz iniciado (cadastros)', value: cadastros },
        { stage: 'Trilha vinculada', value: comTrilha },
        { stage: 'Plano de PDI criado', value: comPlano },
        { stage: 'Ao menos 1 módulo concluído', value: completaram },
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

      // Reação/satisfação (Kirkpatrick nível 1) — o dado já é coletado pelo
      // aluno em ReactionSurvey.tsx, mas nunca era agregado no analytics.
      const pillsArr = (pills as Pick<Pill, 'id' | 'title'>[]) ?? []
      const reactionSurveysArr = (reactionSurveys as ReactionSurvey[]) ?? []
      const reactionQuestionsArr = (reactionQuestions as ReactionQuestion[]) ?? []
      const reactionResponsesArr = (reactionResponses as ReactionResponse[]) ?? []
      const reactionAnswersArr = (reactionAnswers as ReactionAnswer[]) ?? []

      const pillTitleById = new Map(pillsArr.map((p) => [p.id, p.title]))
      const surveyToPillId = new Map(reactionSurveysArr.map((s) => [s.id, s.pill_id]))
      const responseToSurveyId = new Map(reactionResponsesArr.map((r) => [r.id, r.survey_id]))
      const questionById = new Map(reactionQuestionsArr.map((q) => [q.id, q]))

      const responsesBySurvey = new Map<string, Set<string>>()
      for (const r of reactionResponsesArr) {
        if (!responsesBySurvey.has(r.survey_id)) responsesBySurvey.set(r.survey_id, new Set())
        responsesBySurvey.get(r.survey_id)!.add(r.id)
      }

      // value_number: 1-5 para likert5, 0-10 para nps.
      const likertValuesBySurvey = new Map<string, number[]>()
      const npsValuesBySurvey = new Map<string, number[]>()
      const commentsList: { modulo: string; pergunta: string; comentario: string }[] = []

      for (const answer of reactionAnswersArr) {
        const question = questionById.get(answer.question_id)
        if (!question) continue
        const surveyId = responseToSurveyId.get(answer.response_id)
        if (!surveyId) continue

        if (question.question_type === 'likert5' && answer.value_number != null) {
          if (!likertValuesBySurvey.has(surveyId)) likertValuesBySurvey.set(surveyId, [])
          likertValuesBySurvey.get(surveyId)!.push(answer.value_number)
        } else if (question.question_type === 'nps' && answer.value_number != null) {
          if (!npsValuesBySurvey.has(surveyId)) npsValuesBySurvey.set(surveyId, [])
          npsValuesBySurvey.get(surveyId)!.push(answer.value_number)
        } else if (question.question_type === 'open_text' && answer.value_text?.trim()) {
          const pillId = surveyToPillId.get(surveyId)
          commentsList.push({
            modulo: (pillId && pillTitleById.get(pillId)) ?? 'Módulo removido',
            pergunta: question.question_text,
            comentario: answer.value_text.trim(),
          })
        }
      }

      // NPS clássico: %promotores (9-10) - %detratores (0-6), em pontos percentuais.
      function npsFrom(values: number[]): number | null {
        if (!values.length) return null
        const promoters = values.filter((v) => v >= 9).length
        const detractors = values.filter((v) => v <= 6).length
        return Math.round(((promoters - detractors) / values.length) * 100)
      }
      function avgFrom(values: number[]): number | null {
        if (!values.length) return null
        return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
      }

      setReactionByModule(
        reactionSurveysArr
          .map((survey) => {
            const respostas = responsesBySurvey.get(survey.id)?.size ?? 0
            return {
              pillId: survey.pill_id,
              modulo: pillTitleById.get(survey.pill_id) ?? 'Módulo removido',
              respostas,
              nps: npsFrom(npsValuesBySurvey.get(survey.id) ?? []),
              likertMedio: avgFrom(likertValuesBySurvey.get(survey.id) ?? []),
            }
          })
          .filter((r) => r.respostas > 0)
          .sort((a, b) => b.respostas - a.respostas),
      )
      setOpenComments(commentsList)
      setNpsGeral(npsFrom(Array.from(npsValuesBySurvey.values()).flat()))
      setLikertGeral(avgFrom(Array.from(likertValuesBySurvey.values()).flat()))

      const scores = progressArr.filter((p) => p.status === 'completed' && p.quiz_score != null).map((p) => p.quiz_score!)
      const notaMediaQuiz = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
      const totalProgress = progressArr.length
      const totalCompleted = progressArr.filter((p) => p.status === 'completed').length
      const taxaConclusaoGeral = totalProgress ? Math.round((totalCompleted / totalProgress) * 100) : 0
      const pontosMedios = cadastros
        ? Math.round(profilesArr.reduce((sum, p) => sum + p.total_points, 0) / cadastros)
        : 0

      const levelsArr = levels as GamificationLevel[]
      const completedByUser = new Map<string, number>()
      for (const row of progressArr) {
        if (row.status !== 'completed') continue
        completedByUser.set(row.user_id, (completedByUser.get(row.user_id) ?? 0) + 1)
      }
      setStudents(
        profilesArr
          .map((p) => ({
            id: p.id,
            nome: p.name,
            programa: programMap.get(p.program_id ?? '') ?? '—',
            pontos: p.total_points,
            nivel: levelForPoints(p.total_points, levelsArr)?.name ?? '—',
            cursosConcluidos: completedByUser.get(p.id) ?? 0,
            streak: p.access_streak,
            ultimoAcesso: p.last_access_date ? new Date(p.last_access_date).toLocaleDateString('pt-BR') : '—',
          }))
          .sort((a, b) => b.pontos - a.pontos),
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

  if (loading) return <AdminLayout><p className="text-ink-soft">Carregando…</p></AdminLayout>

  return (
    <AdminLayout>
      <div className="mb-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Alunos cadastrados" value={summary.alunos} />
        <StatCard label="Com plano de PDI" value={summary.comPlano} />
        <StatCard label="Nota média de quiz" value={`${summary.notaMediaQuiz}%`} />
        <StatCard label="Taxa de conclusão geral" value={`${summary.taxaConclusaoGeral}%`} />
        <StatCard label="Pontos médios" value={summary.pontosMedios} />
        <StatCard label="Certificados emitidos" value={summary.certificadosEmitidos} />
        <StatCard label="NPS geral" value={npsGeral != null ? npsGeral : '—'} />
        <StatCard label="Satisfação média (1-5)" value={likertGeral != null ? likertGeral : '—'} />
      </div>

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
            <h2 className="font-bold text-ink">Reação e satisfação por módulo</h2>
            <CsvButton
              filename="reacao-por-modulo.csv"
              headers={['Módulo', 'Respostas', 'NPS', 'Satisfação média (1-5)']}
              rows={reactionByModule.map((r) => [r.modulo, r.respostas, r.nps ?? '', r.likertMedio ?? ''])}
            />
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            NPS calculado como % promotores (9-10) menos % detratores (0-6). Só aparecem módulos com pesquisa de
            reação cadastrada e ao menos 1 resposta.
          </p>
          <div className="mt-4 max-h-72 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-ink-soft">
                  <th className="pb-2">Módulo</th>
                  <th className="pb-2 text-right">Respostas</th>
                  <th className="pb-2 text-right">NPS</th>
                  <th className="pb-2 text-right">Satisfação</th>
                </tr>
              </thead>
              <tbody>
                {reactionByModule.map((r) => (
                  <tr key={r.pillId} className="border-t border-navy-light/60">
                    <td className="py-2 font-medium text-ink">{r.modulo}</td>
                    <td className="py-2 text-right text-ink-soft">{r.respostas}</td>
                    <td className="py-2 text-right font-semibold text-navy">{r.nps ?? '—'}</td>
                    <td className="py-2 text-right text-ink-soft">{r.likertMedio ?? '—'}</td>
                  </tr>
                ))}
                {reactionByModule.length === 0 && (
                  <tr><td colSpan={4} className="py-3 text-ink-soft">Sem respostas de reação ainda.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-ink">Comentários abertos</h2>
            <CsvButton
              filename="comentarios-abertos.csv"
              headers={['Módulo', 'Pergunta', 'Comentário']}
              rows={openComments.map((c) => [c.modulo, c.pergunta, c.comentario])}
            />
          </div>
          <div className="mt-4 max-h-72 space-y-3 overflow-y-auto">
            {openComments.map((c, i) => (
              <div key={i} className="rounded-lg border border-navy-light/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{c.modulo}</p>
                <p className="mt-1 text-sm text-ink">{c.comentario}</p>
              </div>
            ))}
            {openComments.length === 0 && <p className="text-sm text-ink-soft">Sem comentários ainda.</p>}
          </div>
        </div>

        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-ink">Balanço de competências — autoavaliação × moderador</h2>
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

        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-ink">Alunos — pontuação, nível e progresso</h2>
            <CsvButton
              filename="alunos.csv"
              headers={['Nome', 'Programa', 'Pontos', 'Nível', 'Cursos concluídos', 'Streak de acesso', 'Último acesso']}
              rows={students.map((s) => [s.nome, s.programa, s.pontos, s.nivel, s.cursosConcluidos, s.streak, s.ultimoAcesso])}
            />
          </div>
          <div className="mt-4 max-h-96 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-ink-soft">
                  <th className="pb-2">Aluno</th>
                  <th className="pb-2">Programa</th>
                  <th className="pb-2 text-right">Pontos</th>
                  <th className="pb-2">Nível</th>
                  <th className="pb-2 text-right">Cursos concluídos</th>
                  <th className="pb-2 text-right">Streak</th>
                  <th className="pb-2">Último acesso</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className="border-t border-navy-light/60">
                    <td className="py-2 font-medium text-ink">{s.nome}</td>
                    <td className="py-2 text-ink-soft">{s.programa}</td>
                    <td className="py-2 text-right font-semibold text-navy">{s.pontos}</td>
                    <td className="py-2 text-ink-soft">{s.nivel}</td>
                    <td className="py-2 text-right text-ink-soft">{s.cursosConcluidos}</td>
                    <td className="py-2 text-right text-ink-soft">{s.streak}</td>
                    <td className="py-2 text-ink-soft">{s.ultimoAcesso}</td>
                  </tr>
                ))}
                {students.length === 0 && (
                  <tr><td colSpan={7} className="py-3 text-ink-soft">Sem dados ainda.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
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
