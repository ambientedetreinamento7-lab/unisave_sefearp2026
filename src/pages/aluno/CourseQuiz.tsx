import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { useAuth } from '../../context/AuthContext'
import { completePill } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import type { Pill, Quiz, QuizQuestion } from '../../types/database'

export function CourseQuiz() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [pill, setPill] = useState<Pill | null>(null)
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [result, setResult] = useState<{ score: number; passed: boolean } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      const { data: pillData } = await supabase.from('pills').select('*').eq('id', id).single()
      const { data: quizData } = await supabase.from('quizzes').select('*').eq('pill_id', id!).maybeSingle()
      let questionData: QuizQuestion[] = []
      if (quizData) {
        const { data } = await supabase.from('questions').select('*').eq('quiz_id', quizData.id)
        questionData = (data as QuizQuestion[]) ?? []
      }
      if (cancelled) return
      setPill(pillData as Pill)
      setQuiz(quizData as Quiz | null)
      setQuestions(questionData)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  function selectAnswer(questionId: string, optionIndex: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }))
  }

  async function submitQuiz() {
    if (!profile || !id || !quiz) return
    const correct = questions.filter((q) => answers[q.id] === q.correct_option_index).length
    const score = questions.length ? Math.round((correct / questions.length) * 100) : 0
    const passed = score >= quiz.min_pass_score
    setResult({ score, passed })
    if (passed) {
      await completePill(profile.id, id, score, pill?.title ?? 'Curso', pill?.points_override)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg">
        <AppHeader />
        <p className="p-8 text-center text-ink-soft">Carregando…</p>
      </div>
    )
  }

  if (!quiz || questions.length === 0) {
    return (
      <div className="min-h-screen bg-bg">
        <AppHeader />
        <div className="mx-auto max-w-xl px-4 py-10 text-center">
          <p className="text-ink-soft">Este módulo ainda não possui quiz de fixação cadastrado.</p>
          <Link to={`/curso/${id}`} className="mt-4 inline-block font-semibold text-navy">
            ← Voltar ao módulo
          </Link>
        </div>
      </div>
    )
  }

  const allAnswered = questions.every((q) => answers[q.id] !== undefined)

  return (
    <div className="min-h-screen bg-bg pb-16">
      <AppHeader />
      <main className="mx-auto max-w-xl px-4 py-8">
        <h1 className="text-xl font-extrabold text-ink">Quiz de fixação — {pill?.title}</h1>
        <p className="mt-1 text-sm text-ink-soft">Acerte pelo menos {quiz.min_pass_score}% para concluir o módulo.</p>

        {!result && (
          <div className="mt-6 space-y-6">
            {questions.map((q, qi) => (
              <div key={q.id} className="card p-5">
                <p className="font-semibold text-ink">
                  {qi + 1}. {q.question_text}
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {q.options.map((opt, oi) => (
                    <button
                      key={oi}
                      onClick={() => selectAnswer(q.id, oi)}
                      className={`rounded-xl border-2 px-4 py-2 text-left text-sm font-medium transition ${
                        answers[q.id] === oi
                          ? 'border-brand-red bg-red-50 text-brand-red'
                          : 'border-navy-light text-ink hover:border-navy'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <button
              onClick={submitQuiz}
              disabled={!allAnswered}
              className="w-full rounded-xl bg-brand-red py-3 font-bold text-white transition hover:bg-brand-red-dark disabled:opacity-50"
            >
              Enviar respostas
            </button>
          </div>
        )}

        {result && (
          <div className="card mt-6 p-8 text-center">
            {result.passed ? (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-gold to-yellow-300 text-2xl">
                  🏅
                </div>
                <h2 className="mt-4 text-xl font-extrabold text-success">Parabéns! Módulo concluído</h2>
              </>
            ) : (
              <h2 className="text-xl font-extrabold text-brand-red">Quase lá!</h2>
            )}
            <p className="mt-2 text-ink-soft">Sua pontuação: {result.score}%</p>
            <div className="mt-6 flex flex-col gap-2">
              {result.passed ? (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="rounded-xl bg-brand-red py-3 font-bold text-white hover:bg-brand-red-dark"
                >
                  Voltar ao painel
                </button>
              ) : (
                <button
                  onClick={() => {
                    setAnswers({})
                    setResult(null)
                  }}
                  className="rounded-xl bg-navy py-3 font-bold text-white hover:bg-navy-dark"
                >
                  Tentar novamente
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
