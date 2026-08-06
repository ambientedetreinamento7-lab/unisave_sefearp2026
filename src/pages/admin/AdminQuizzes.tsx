import { useEffect, useState } from 'react'
import { AdminLayout } from './AdminLayout'
import { supabase } from '../../lib/supabase'
import type { Pill, Quiz, QuizQuestion, Track } from '../../types/database'

export function AdminQuizzes() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [pills, setPills] = useState<Pill[]>([])
  const [selectedPillId, setSelectedPillId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function reload() {
    const [{ data: t }, { data: p }] = await Promise.all([
      supabase.from('tracks').select('*'),
      supabase.from('pills').select('*'),
    ])
    setTracks((t as Track[]) ?? [])
    setPills((p as Pill[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    reload()
  }, [])

  if (loading) return <AdminLayout><p className="text-ink-soft">Carregando…</p></AdminLayout>

  return (
    <AdminLayout>
      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <div className="card max-h-[70vh] overflow-y-auto p-3">
          {tracks.map((track) => (
            <div key={track.id} className="mb-3">
              <p className="px-2 py-1 text-xs font-bold uppercase tracking-wide text-ink-soft">{track.title}</p>
              {pills
                .filter((p) => p.track_id === track.id)
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPillId(p.id)}
                    className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                      selectedPillId === p.id ? 'bg-navy text-white' : 'text-ink hover:bg-navy-light'
                    }`}
                  >
                    {p.title}
                  </button>
                ))}
            </div>
          ))}
          {pills.length === 0 && <p className="p-3 text-sm text-ink-soft">Nenhuma pílula cadastrada ainda.</p>}
        </div>

        <div>
          {selectedPillId ? (
            <QuizEditor pill={pills.find((p) => p.id === selectedPillId)!} />
          ) : (
            <div className="card p-8 text-center text-ink-soft">Selecione uma pílula à esquerda para editar o quiz de fixação dela.</div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}

function QuizEditor({ pill }: { pill: Pill }) {
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [minPassScore, setMinPassScore] = useState(70)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function reload() {
    setLoading(true)
    const { data: quizData } = await supabase.from('quizzes').select('*').eq('pill_id', pill.id).maybeSingle()
    setQuiz(quizData as Quiz | null)
    setMinPassScore((quizData as Quiz | null)?.min_pass_score ?? 70)
    if (quizData) {
      const { data: qs } = await supabase.from('questions').select('*').eq('quiz_id', quizData.id)
      setQuestions((qs as QuizQuestion[]) ?? [])
    } else {
      setQuestions([])
    }
    setLoading(false)
  }

  useEffect(() => {
    reload()
  }, [pill.id])

  async function ensureQuiz(): Promise<Quiz> {
    if (quiz) return quiz
    const { data, error } = await supabase
      .from('quizzes')
      .insert({ pill_id: pill.id, min_pass_score: minPassScore })
      .select('*')
      .single()
    if (error) throw error
    setQuiz(data as Quiz)
    return data as Quiz
  }

  async function saveMinPassScore() {
    setSaving(true)
    const q = await ensureQuiz()
    await supabase.from('quizzes').update({ min_pass_score: minPassScore }).eq('id', q.id)
    setSaving(false)
  }

  async function addQuestion(text: string, options: string[], correctIndex: number) {
    const q = await ensureQuiz()
    await supabase.from('questions').insert({
      quiz_id: q.id,
      question_text: text,
      options,
      correct_option_index: correctIndex,
    })
    await reload()
  }

  async function deleteQuestion(id: string) {
    await supabase.from('questions').delete().eq('id', id)
    setQuestions((prev) => prev.filter((q) => q.id !== id))
  }

  if (loading) return <p className="text-ink-soft">Carregando…</p>

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="font-bold text-ink">{pill.title}</h3>
        <div className="mt-3 flex items-center gap-2">
          <label className="text-sm text-ink-soft">Nota mínima para aprovação (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            value={minPassScore}
            onChange={(e) => setMinPassScore(Number(e.target.value))}
            className="w-20 rounded-lg border border-navy-light px-2 py-1"
          />
          <button
            onClick={saveMinPassScore}
            disabled={saving}
            className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-dark disabled:opacity-60"
          >
            Salvar
          </button>
        </div>
      </div>

      <div className="card p-5">
        <h4 className="font-bold text-ink">Perguntas ({questions.length})</h4>
        <div className="mt-3 space-y-3">
          {questions.map((q, qi) => (
            <div key={q.id} className="rounded-xl border border-navy-light p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-ink">{qi + 1}. {q.question_text}</p>
                <button onClick={() => deleteQuestion(q.id)} className="shrink-0 text-xs font-semibold text-brand-red hover:underline">
                  Remover
                </button>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {q.options.map((opt, oi) => (
                  <li
                    key={oi}
                    className={oi === q.correct_option_index ? 'font-semibold text-success' : 'text-ink-soft'}
                  >
                    {oi === q.correct_option_index ? '✓ ' : '· '}
                    {opt}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {questions.length === 0 && <p className="text-sm text-ink-soft">Nenhuma pergunta cadastrada ainda.</p>}
        </div>
      </div>

      <NewQuestionForm onAdd={addQuestion} />
    </div>
  )
}

function NewQuestionForm({ onAdd }: { onAdd: (text: string, options: string[], correctIndex: number) => Promise<void> }) {
  const [text, setText] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [correctIndex, setCorrectIndex] = useState(0)
  const [saving, setSaving] = useState(false)

  function updateOption(i: number, value: string) {
    setOptions((prev) => prev.map((o, oi) => (oi === i ? value : o)))
  }

  function addOption() {
    setOptions((prev) => [...prev, ''])
  }

  function removeOption(i: number) {
    setOptions((prev) => prev.filter((_, oi) => oi !== i))
    setCorrectIndex((prev) => (prev >= i && prev > 0 ? prev - 1 : prev))
  }

  async function submit() {
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean)
    if (!text.trim() || cleanOptions.length < 2) return
    setSaving(true)
    await onAdd(text.trim(), cleanOptions, correctIndex)
    setText('')
    setOptions(['', ''])
    setCorrectIndex(0)
    setSaving(false)
  }

  const valid = text.trim() && options.filter((o) => o.trim()).length >= 2

  return (
    <div className="card p-5">
      <h4 className="font-bold text-ink">Nova pergunta</h4>
      <textarea
        className="mt-3 w-full rounded-xl border border-navy-light px-4 py-3"
        placeholder="Texto da pergunta"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-3 space-y-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name="correct"
              checked={correctIndex === i}
              onChange={() => setCorrectIndex(i)}
              title="Marcar como resposta correta"
            />
            <input
              className="flex-1 rounded-xl border border-navy-light px-3 py-2 text-sm"
              placeholder={`Opção ${i + 1}`}
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
            />
            {options.length > 2 && (
              <button onClick={() => removeOption(i)} className="text-xs font-semibold text-brand-red hover:underline">
                Remover
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button onClick={addOption} className="text-xs font-semibold text-navy hover:underline">
          + Adicionar opção
        </button>
        <button
          onClick={submit}
          disabled={!valid || saving}
          className="rounded-xl bg-brand-red px-4 py-2 text-sm font-bold text-white hover:bg-brand-red-dark disabled:opacity-60"
        >
          {saving ? 'Salvando…' : 'Adicionar pergunta'}
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-soft">Selecione a bolinha ao lado da opção correta.</p>
    </div>
  )
}
