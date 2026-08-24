import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { useAuth } from '../../context/AuthContext'
import { completePill, getReactionSurveyForPill, hasSubmittedReaction, submitReactionResponse } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import type { Pill, ReactionQuestion, ReactionSurvey as ReactionSurveyRow } from '../../types/database'

const LIKERT_LABELS = ['Discordo totalmente', 'Discordo', 'Neutro', 'Concordo', 'Concordo totalmente']

export function ReactionSurvey() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [pill, setPill] = useState<Pill | null>(null)
  const [survey, setSurvey] = useState<ReactionSurveyRow | null>(null)
  const [questions, setQuestions] = useState<ReactionQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, number | string>>({})
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id || !profile) return
    let cancelled = false
    async function load() {
      const { data: pillData } = await supabase.from('pills').select('*').eq('id', id).single()
      const found = await getReactionSurveyForPill(id!)
      if (cancelled) return
      setPill(pillData as Pill)
      if (found) {
        setSurvey(found.survey)
        setQuestions(found.questions)
        setAlreadySubmitted(await hasSubmittedReaction(id!, profile!.id))
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id, profile])

  function setLikert(questionId: string, value: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  function setOpenText(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  async function submit() {
    if (!profile || !survey || !id) return
    setSubmitting(true)
    await submitReactionResponse(
      survey.id,
      id,
      profile.id,
      questions.map((q) => {
        const value = answers[q.id]
        return q.question_type === 'open_text'
          ? { questionId: q.id, valueText: typeof value === 'string' ? value : null }
          : { questionId: q.id, valueNumber: typeof value === 'number' ? value : null }
      }),
    )
    // A pílula é a própria avaliação (content_type='reaction') — responder
    // é o que a conclui, do mesmo jeito que passar no quiz conclui uma
    // pílula de vídeo.
    await completePill(profile.id, id, null, pill?.title ?? 'Avaliação de reação', pill?.points_override)
    setSubmitting(false)
    setSubmitted(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg">
        <AppHeader />
        <p className="p-8 text-center text-ink-soft">Carregando…</p>
      </div>
    )
  }

  if (!survey || questions.length === 0) {
    return (
      <div className="min-h-screen bg-bg">
        <AppHeader />
        <div className="mx-auto max-w-xl px-4 py-10 text-center">
          <p className="text-ink-soft">Este módulo não possui avaliação de reação cadastrada.</p>
          <Link to={`/curso/${id}`} className="mt-4 inline-block font-semibold text-navy">
            ← Voltar ao módulo
          </Link>
        </div>
      </div>
    )
  }

  const answeredCount = questions.filter((q) => answers[q.id] !== undefined && answers[q.id] !== '').length
  const requiredAnswered = questions
    .filter((q) => q.question_type !== 'open_text')
    .every((q) => typeof answers[q.id] === 'number')

  if (submitted || alreadySubmitted) {
    return (
      <div className="min-h-screen bg-bg pb-16">
        <AppHeader />
        <main className="mx-auto max-w-xl px-4 py-8">
          <div className="card p-8 text-center">
            <p className="text-3xl">🙏</p>
            <h1 className="mt-3 text-xl font-extrabold text-ink">Obrigado pelo feedback!</h1>
            <p className="mt-2 text-ink-soft">Sua avaliação de reação ao módulo "{pill?.title}" foi registrada.</p>
            <button
              onClick={() => navigate(`/curso/${id}`)}
              className="mt-6 rounded-xl bg-brand-red px-6 py-2.5 font-bold text-white hover:bg-brand-red-dark"
            >
              Voltar ao módulo
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg pb-16">
      <AppHeader />
      <main className="mx-auto max-w-xl px-4 py-8">
        <h1 className="text-xl font-extrabold text-ink">Avaliação de reação — {pill?.title}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Sua opinião sincera ajuda a melhorar este curso. Leva menos de um minuto.
        </p>

        <div className="mt-6 space-y-6">
          {questions.map((q, qi) => (
            <div key={q.id} className="card p-5">
              <p className="font-semibold text-ink">
                {qi + 1}. {q.question_text}
              </p>

              {q.question_type === 'likert5' && (
                <div className="mt-3 grid grid-cols-5 gap-1.5">
                  {LIKERT_LABELS.map((label, i) => {
                    const value = i + 1
                    const selected = answers[q.id] === value
                    return (
                      <button
                        key={value}
                        onClick={() => setLikert(q.id, value)}
                        title={label}
                        className={`flex flex-col items-center gap-1 rounded-xl border-2 px-1 py-2.5 text-center text-[10px] font-semibold transition ${
                          selected ? 'border-brand-red bg-red-50 text-brand-red' : 'border-navy-light text-ink-soft hover:border-navy'
                        }`}
                      >
                        <span className="text-base font-extrabold">{value}</span>
                        <span className="leading-tight">{label}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {q.question_type === 'nps' && (
                <div>
                  <div className="mt-3 grid grid-cols-11 gap-1">
                    {Array.from({ length: 11 }, (_, value) => (
                      <button
                        key={value}
                        onClick={() => setLikert(q.id, value)}
                        className={`rounded-lg border-2 py-2 text-xs font-bold transition ${
                          answers[q.id] === value
                            ? 'border-brand-red bg-red-50 text-brand-red'
                            : 'border-navy-light text-ink-soft hover:border-navy'
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] text-ink-soft">
                    <span>Não recomendaria</span>
                    <span>Recomendaria com certeza</span>
                  </div>
                </div>
              )}

              {q.question_type === 'open_text' && (
                <textarea
                  className="mt-3 w-full rounded-xl border border-navy-light px-4 py-2.5 text-sm"
                  placeholder="Comentário (opcional)…"
                  rows={3}
                  value={(answers[q.id] as string) ?? ''}
                  onChange={(e) => setOpenText(q.id, e.target.value)}
                />
              )}
            </div>
          ))}

          <button
            onClick={submit}
            disabled={!requiredAnswered || submitting}
            className="w-full rounded-xl bg-brand-red py-3 font-bold text-white transition hover:bg-brand-red-dark disabled:opacity-50"
          >
            {submitting ? 'Enviando…' : 'Enviar avaliação'}
          </button>
          <p className="text-center text-xs text-ink-soft">{answeredCount} de {questions.length} perguntas respondidas</p>
        </div>
      </main>
    </div>
  )
}
