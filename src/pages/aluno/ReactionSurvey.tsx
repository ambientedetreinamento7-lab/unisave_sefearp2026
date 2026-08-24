import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { ProgressBar } from '../../components/ProgressBar'
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
  const [step, setStep] = useState(0)
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
      <div className="min-h-screen w-full overflow-x-hidden bg-bg">
        <AppHeader />
        <p className="p-8 text-center text-ink-soft">Carregando…</p>
      </div>
    )
  }

  if (!survey || questions.length === 0) {
    return (
      <div className="min-h-screen w-full overflow-x-hidden bg-bg">
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

  const requiredAnswered = questions
    .filter((q) => q.question_type !== 'open_text')
    .every((q) => typeof answers[q.id] === 'number')

  // "Aberta" é opcional (a pergunta pode ficar em branco); as demais
  // exigem uma resposta antes de liberar o "Próxima" — assim, ao chegar
  // na última pergunta, requiredAnswered acima já está garantido.
  function isAnswered(q: ReactionQuestion) {
    return q.question_type === 'open_text' || typeof answers[q.id] === 'number'
  }

  if (submitted || alreadySubmitted) {
    return (
      <div className="min-h-screen w-full overflow-x-hidden bg-bg pb-16">
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

  const total = questions.length
  const q = questions[step]
  const isLastStep = step === total - 1
  const canAdvance = isAnswered(q)
  const pct = Math.round(((step + 1) / total) * 100)

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-bg pb-16">
      <AppHeader />
      <main className="mx-auto max-w-xl px-4 py-6 sm:max-w-2xl sm:py-8">
        <h1 className="break-words text-lg font-extrabold text-ink sm:text-xl">Avaliação de reação — {pill?.title}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Sua opinião sincera ajuda a melhorar este curso. Leva menos de um minuto.
        </p>

        <div className="mt-5 flex items-center justify-between text-xs font-semibold text-ink-soft sm:mt-6">
          <span>Pergunta {step + 1} de {total}</span>
          <span>{pct}%</span>
        </div>
        <div className="mt-1.5">
          <ProgressBar value={pct} />
        </div>

        <div className="card mt-4 min-w-0 p-5 sm:p-8">
          <p className="min-w-0 break-words text-base font-semibold text-ink sm:text-lg">{q.question_text}</p>

          {q.question_type === 'likert5' && (
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-5 sm:gap-1.5">
              {LIKERT_LABELS.map((label, i) => {
                const value = i + 1
                const selected = answers[q.id] === value
                return (
                  <button
                    key={value}
                    onClick={() => setLikert(q.id, value)}
                    title={label}
                    className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-sm font-semibold transition sm:flex-col sm:items-center sm:gap-1 sm:px-1 sm:py-2.5 sm:text-center sm:text-[10px] ${
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
              <div className="mt-5 grid grid-cols-6 gap-1.5 sm:grid-cols-11">
                {Array.from({ length: 11 }, (_, value) => (
                  <button
                    key={value}
                    onClick={() => setLikert(q.id, value)}
                    className={`rounded-lg border-2 py-3 text-sm font-bold transition sm:py-2 sm:text-xs ${
                      answers[q.id] === value
                        ? 'border-brand-red bg-red-50 text-brand-red'
                        : 'border-navy-light text-ink-soft hover:border-navy'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-ink-soft">
                <span>Não recomendaria</span>
                <span>Recomendaria com certeza</span>
              </div>
            </div>
          )}

          {q.question_type === 'open_text' && (
            <textarea
              className="mt-5 w-full rounded-xl border border-navy-light px-4 py-2.5 text-sm"
              placeholder="Comentário (opcional)…"
              rows={4}
              value={(answers[q.id] as string) ?? ''}
              onChange={(e) => setOpenText(q.id, e.target.value)}
            />
          )}
        </div>

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="rounded-xl border border-navy-light px-6 py-3 font-semibold text-ink-soft transition hover:border-navy disabled:opacity-40 sm:py-2.5"
          >
            ← Voltar
          </button>
          {isLastStep ? (
            <button
              onClick={submit}
              disabled={!requiredAnswered || submitting}
              className="rounded-xl bg-brand-red px-6 py-3 font-bold text-white transition hover:bg-brand-red-dark disabled:opacity-50 sm:py-2.5"
            >
              {submitting ? 'Enviando…' : 'Enviar avaliação'}
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
              disabled={!canAdvance}
              className="rounded-xl bg-navy px-6 py-3 font-bold text-white transition hover:bg-navy-dark disabled:opacity-50 sm:py-2.5"
            >
              Próxima →
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
