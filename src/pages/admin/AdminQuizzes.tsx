import { useEffect, useState } from 'react'
import { AdminLayout } from './AdminLayout'
import { parseCsv } from '../../lib/csv'
import { supabase } from '../../lib/supabase'
import type { Pill, Quiz, QuizQuestion, ReactionQuestion, ReactionQuestionType, ReactionSurvey, QuestionType, Track } from '../../types/database'

const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  single_choice: 'Escolha única',
  multiple_choice: 'Múltipla escolha',
  true_false: 'Verdadeiro ou falso',
  open_text: 'Resposta aberta (não pontuada)',
}

const REACTION_TYPE_LABEL: Record<ReactionQuestionType, string> = {
  likert5: 'Escala de concordância (1–5)',
  nps: 'Escala de recomendação (0–10)',
  open_text: 'Comentário livre',
}

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

  const selectedPill = pills.find((p) => p.id === selectedPillId) ?? null

  return (
    <AdminLayout>
      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <div className="card max-h-[80vh] overflow-y-auto p-3">
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

        <div className="space-y-6">
          {selectedPill ? (
            selectedPill.content_type === 'reaction' ? (
              <ReactionEditor pill={selectedPill} />
            ) : (
              <QuizEditor pill={selectedPill} />
            )
          ) : (
            <div className="card p-8 text-center text-ink-soft">
              Selecione uma pílula à esquerda para editar o quiz de fixação (ou, se ela for do tipo "Avaliação de
              Reação", as perguntas de reação dela).
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}

// ============================================================
// Avaliação de conhecimento (Kirkpatrick nível 2 — quiz de fixação)
// ============================================================

function QuizEditor({ pill }: { pill: Pill }) {
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [minPassScore, setMinPassScore] = useState(70)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function reload() {
    setLoading(true)
    const { data: quizData } = await supabase.from('quizzes').select('*').eq('pill_id', pill.id).maybeSingle()
    setQuiz(quizData as Quiz | null)
    setMinPassScore((quizData as Quiz | null)?.min_pass_score ?? 70)
    if (quizData) {
      const { data: qs } = await supabase.from('questions').select('*').eq('quiz_id', quizData.id).order('order_index')
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
    setError('')
    try {
      const q = await ensureQuiz()
      const { error: updateError } = await supabase.from('quizzes').update({ min_pass_score: minPassScore }).eq('id', q.id)
      if (updateError) throw updateError
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar a nota mínima.')
    }
    setSaving(false)
  }

  async function addQuestions(
    rows: {
      text: string
      type: QuestionType
      options: string[]
      correctIndex: number | null
      correctIndexes: number[] | null
    }[],
  ) {
    if (rows.length === 0) return
    setError('')
    try {
      const q = await ensureQuiz()
      const { error: insertError } = await supabase.from('questions').insert(
        rows.map((r, i) => ({
          quiz_id: q.id,
          question_text: r.text,
          question_type: r.type,
          options: r.options,
          correct_option_index: r.correctIndex,
          correct_option_indexes: r.correctIndexes,
          order_index: questions.length + i,
        })),
      )
      if (insertError) throw insertError
    } catch (err) {
      // PostgrestError não é instanceof Error, então `err instanceof Error`
      // sempre caía na mensagem genérica e escondia o motivo real do erro.
      const message = (err as { message?: string } | null)?.message
      setError(message || 'Falha ao salvar a(s) pergunta(s).')
      throw err
    }
    await reload()
  }

  async function deleteQuestion(id: string) {
    setError('')
    const { error: deleteError } = await supabase.from('questions').delete().eq('id', id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    setQuestions((prev) => prev.filter((q) => q.id !== id))
  }

  if (loading) return <p className="text-ink-soft">Carregando…</p>

  return (
    <div className="space-y-4">
      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-brand-red">{error}</p>}
      <div className="card p-5">
        <h3 className="font-bold text-ink">Avaliação de conhecimento — {pill.title}</h3>
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
                <div>
                  <p className="font-medium text-ink">{qi + 1}. {q.question_text}</p>
                  <p className="text-xs font-semibold text-ink-soft">{QUESTION_TYPE_LABEL[q.question_type]}</p>
                </div>
                <button onClick={() => deleteQuestion(q.id)} className="shrink-0 text-xs font-semibold text-brand-red hover:underline">
                  Remover
                </button>
              </div>
              {q.question_type !== 'open_text' && (
                <ul className="mt-2 space-y-1 text-sm">
                  {q.options.map((opt, oi) => {
                    const isCorrect =
                      q.question_type === 'multiple_choice'
                        ? (q.correct_option_indexes ?? []).includes(oi)
                        : oi === q.correct_option_index
                    return (
                      <li key={oi} className={isCorrect ? 'font-semibold text-success' : 'text-ink-soft'}>
                        {isCorrect ? '✓ ' : '· '}
                        {opt}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ))}
          {questions.length === 0 && <p className="text-sm text-ink-soft">Nenhuma pergunta cadastrada ainda.</p>}
        </div>
      </div>

      <NewQuizQuestionForm onAdd={(row) => addQuestions([row])} />
      <QuizCsvImport onImport={addQuestions} />
    </div>
  )
}

function NewQuizQuestionForm({
  onAdd,
}: {
  onAdd: (row: {
    text: string
    type: QuestionType
    options: string[]
    correctIndex: number | null
    correctIndexes: number[] | null
  }) => Promise<void>
}) {
  const [text, setText] = useState('')
  const [type, setType] = useState<QuestionType>('single_choice')
  const [options, setOptions] = useState(['', ''])
  const [correctIndex, setCorrectIndex] = useState(0)
  const [correctIndexes, setCorrectIndexes] = useState<number[]>([])
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
    setCorrectIndexes((prev) => prev.filter((ci) => ci !== i).map((ci) => (ci > i ? ci - 1 : ci)))
  }

  function toggleCorrectIndex(i: number) {
    setCorrectIndexes((prev) => (prev.includes(i) ? prev.filter((ci) => ci !== i) : [...prev, i]))
  }

  async function submit() {
    const effectiveOptions = type === 'true_false' ? ['Verdadeiro', 'Falso'] : options.map((o) => o.trim()).filter(Boolean)
    if (!text.trim()) return
    if (type !== 'open_text' && effectiveOptions.length < 2) return
    setSaving(true)
    try {
      await onAdd({
        text: text.trim(),
        type,
        options: type === 'open_text' ? [] : effectiveOptions,
        correctIndex: type === 'multiple_choice' || type === 'open_text' ? null : correctIndex,
        correctIndexes: type === 'multiple_choice' ? correctIndexes : null,
      })
      setText('')
      setOptions(['', ''])
      setCorrectIndex(0)
      setCorrectIndexes([])
    } catch {
      // erro já exibido pelo QuizEditor — mantém o formulário preenchido pro admin tentar de novo
    }
    setSaving(false)
  }

  const valid =
    text.trim() &&
    (type === 'open_text' ||
      (type === 'true_false' && true) ||
      options.filter((o) => o.trim()).length >= 2) &&
    (type !== 'multiple_choice' || correctIndexes.length > 0)

  return (
    <div className="card p-5">
      <h4 className="font-bold text-ink">Nova pergunta</h4>

      <label className="mt-3 block text-xs font-semibold text-ink-soft">Tipo de pergunta</label>
      <select
        className="mt-1 w-full rounded-xl border border-navy-light px-4 py-2.5 text-sm"
        value={type}
        onChange={(e) => {
          setType(e.target.value as QuestionType)
          setCorrectIndex(0)
          setCorrectIndexes([])
        }}
      >
        {(Object.entries(QUESTION_TYPE_LABEL) as [QuestionType, string][]).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>

      <textarea
        className="mt-3 w-full rounded-xl border border-navy-light px-4 py-3"
        placeholder="Texto da pergunta"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      {type === 'open_text' && (
        <p className="mt-2 text-xs text-ink-soft">Reflexão aberta — não entra no cálculo de nota do quiz.</p>
      )}

      {type === 'true_false' && (
        <div className="mt-3 space-y-2">
          {['Verdadeiro', 'Falso'].map((label, i) => (
            <label key={i} className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" name="correct-vf" checked={correctIndex === i} onChange={() => setCorrectIndex(i)} />
              {label}
            </label>
          ))}
        </div>
      )}

      {(type === 'single_choice' || type === 'multiple_choice') && (
        <div className="mt-3 space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type={type === 'multiple_choice' ? 'checkbox' : 'radio'}
                name="correct"
                checked={type === 'multiple_choice' ? correctIndexes.includes(i) : correctIndex === i}
                onChange={() => (type === 'multiple_choice' ? toggleCorrectIndex(i) : setCorrectIndex(i))}
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
          <button onClick={addOption} className="text-xs font-semibold text-navy hover:underline">
            + Adicionar opção
          </button>
        </div>
      )}

      <div className="mt-3 flex items-center justify-end">
        <button
          onClick={submit}
          disabled={!valid || saving}
          className="rounded-xl bg-brand-red px-4 py-2 text-sm font-bold text-white hover:bg-brand-red-dark disabled:opacity-60"
        >
          {saving ? 'Salvando…' : 'Adicionar pergunta'}
        </button>
      </div>
    </div>
  )
}

const QUIZ_TYPE_ALIASES: Record<string, QuestionType> = {
  unica: 'single_choice',
  única: 'single_choice',
  single_choice: 'single_choice',
  multipla: 'multiple_choice',
  múltipla: 'multiple_choice',
  multiple_choice: 'multiple_choice',
  vf: 'true_false',
  true_false: 'true_false',
  aberta: 'open_text',
  open_text: 'open_text',
}

interface ParsedQuizRow {
  text: string
  type: QuestionType
  options: string[]
  correctIndex: number | null
  correctIndexes: number[] | null
  error?: string
}

function parseQuizCsvRows(rows: string[][]): ParsedQuizRow[] {
  const [header, ...body] = rows
  if (!header) return []
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name)
  const pergIdx = col('pergunta')
  const tipoIdx = col('tipo')
  const corretasIdx = col('corretas')
  const optionIdxs = [1, 2, 3, 4, 5, 6].map((n) => col(`opcao${n}`)).filter((i) => i >= 0)

  return body.map((row) => {
    const text = (pergIdx >= 0 ? row[pergIdx] : '')?.trim() ?? ''
    const typeRaw = (tipoIdx >= 0 ? row[tipoIdx] : '')?.trim().toLowerCase() ?? ''
    const type = QUIZ_TYPE_ALIASES[typeRaw] ?? 'single_choice'
    const options = type === 'true_false' ? ['Verdadeiro', 'Falso'] : optionIdxs.map((i) => row[i]?.trim() ?? '').filter(Boolean)
    const correctRaw = (corretasIdx >= 0 ? row[corretasIdx] : '')?.trim() ?? ''
    const correctIndexes = correctRaw
      ? correctRaw
          .split(';')
          .map((s) => Number(s.trim()))
          .filter((n) => !Number.isNaN(n))
      : []

    let error: string | undefined
    if (!text) error = 'Sem texto de pergunta'
    else if (type !== 'open_text' && options.length < 2) error = 'Menos de 2 opções preenchidas'
    else if (type !== 'open_text' && correctIndexes.length === 0) error = 'Sem resposta correta em "corretas"'

    return {
      text,
      type,
      options,
      correctIndex: type === 'multiple_choice' || type === 'open_text' ? null : correctIndexes[0] ?? null,
      correctIndexes: type === 'multiple_choice' ? correctIndexes : null,
      error,
    }
  })
}

function QuizCsvImport({ onImport }: { onImport: (rows: ParsedQuizRow[]) => Promise<void> }) {
  const [rows, setRows] = useState<ParsedQuizRow[]>([])
  const [importing, setImporting] = useState(false)

  async function handleFile(file: File) {
    const text = await file.text()
    setRows(parseQuizCsvRows(parseCsv(text)))
  }

  const validRows = rows.filter((r) => !r.error)

  async function doImport() {
    setImporting(true)
    try {
      await onImport(validRows)
      setRows([])
    } catch {
      // erro já exibido pelo QuizEditor
    }
    setImporting(false)
  }

  return (
    <details className="card p-5">
      <summary className="cursor-pointer font-bold text-ink">Importar perguntas via CSV</summary>
      <p className="mt-2 text-xs text-ink-soft">
        Colunas: <code>pergunta, tipo, opcao1, opcao2, opcao3, opcao4, corretas</code>. <code>tipo</code> é{' '}
        <code>unica</code>, <code>multipla</code>, <code>vf</code> ou <code>aberta</code>. <code>corretas</code> é o
        índice da opção certa (0 = opcao1, 1 = opcao2…) — separe por <code>;</code> se for múltipla escolha. Deixe{' '}
        <code>corretas</code> e as opções em branco para perguntas abertas.
      </p>
      <input
        type="file"
        accept=".csv"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        className="mt-3 w-full text-sm"
      />
      {rows.length > 0 && (
        <>
          <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-navy-light">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-bg text-ink-soft">
                  <th className="px-2 py-1.5">Pergunta</th>
                  <th className="px-2 py-1.5">Tipo</th>
                  <th className="px-2 py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-navy-light/60">
                    <td className="px-2 py-1.5">{r.text || '—'}</td>
                    <td className="px-2 py-1.5">{QUESTION_TYPE_LABEL[r.type]}</td>
                    <td className={`px-2 py-1.5 font-semibold ${r.error ? 'text-brand-red' : 'text-success'}`}>
                      {r.error ?? 'OK'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={doImport}
            disabled={validRows.length === 0 || importing}
            className="mt-3 rounded-xl bg-brand-red px-4 py-2 text-sm font-bold text-white hover:bg-brand-red-dark disabled:opacity-60"
          >
            {importing ? 'Importando…' : `Importar ${validRows.length} pergunta(s) válida(s)`}
          </button>
        </>
      )}
    </details>
  )
}

// ============================================================
// Avaliação de Reação (Kirkpatrick nível 1)
// ============================================================

function ReactionEditor({ pill }: { pill: Pill }) {
  const [survey, setSurvey] = useState<ReactionSurvey | null>(null)
  const [questions, setQuestions] = useState<ReactionQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function reload() {
    setLoading(true)
    const { data: surveyData } = await supabase.from('reaction_surveys').select('*').eq('pill_id', pill.id).maybeSingle()
    setSurvey(surveyData as ReactionSurvey | null)
    if (surveyData) {
      const { data: qs } = await supabase
        .from('reaction_questions')
        .select('*')
        .eq('survey_id', surveyData.id)
        .order('order_index')
      setQuestions((qs as ReactionQuestion[]) ?? [])
    } else {
      setQuestions([])
    }
    setLoading(false)
  }

  useEffect(() => {
    reload()
  }, [pill.id])

  async function ensureSurvey(): Promise<ReactionSurvey> {
    if (survey) return survey
    const { data, error } = await supabase.from('reaction_surveys').insert({ pill_id: pill.id }).select('*').single()
    if (error) throw error
    setSurvey(data as ReactionSurvey)
    return data as ReactionSurvey
  }

  async function addQuestions(rows: { text: string; type: ReactionQuestionType }[]) {
    if (rows.length === 0) return
    setError('')
    try {
      const s = await ensureSurvey()
      const { error: insertError } = await supabase.from('reaction_questions').insert(
        rows.map((r, i) => ({
          survey_id: s.id,
          question_text: r.text,
          question_type: r.type,
          order_index: questions.length + i,
        })),
      )
      if (insertError) throw insertError
    } catch (err) {
      // PostgrestError não é instanceof Error, então `err instanceof Error`
      // sempre caía na mensagem genérica e escondia o motivo real do erro.
      const message = (err as { message?: string } | null)?.message
      setError(message || 'Falha ao salvar a(s) pergunta(s).')
      throw err
    }
    await reload()
  }

  async function deleteQuestion(id: string) {
    setError('')
    const { error: deleteError } = await supabase.from('reaction_questions').delete().eq('id', id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    setQuestions((prev) => prev.filter((q) => q.id !== id))
  }

  async function disableSurvey() {
    if (!survey) return
    setError('')
    const { error: deleteError } = await supabase.from('reaction_surveys').delete().eq('id', survey.id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    setSurvey(null)
    setQuestions([])
  }

  if (loading) return <p className="text-ink-soft">Carregando…</p>

  return (
    <div className="space-y-4">
      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-brand-red">{error}</p>}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-ink">Avaliação de reação — {pill.title}</h3>
          {survey && (
            <button onClick={disableSurvey} className="text-xs font-semibold text-brand-red hover:underline">
              Desativar avaliação de reação neste módulo
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          Pesquisa de satisfação exibida ao aluno assim que ele conclui o módulo. Conta como um item a mais no
          percentual de conclusão da trilha. Cadastre ao menos uma pergunta abaixo para habilitá-la.
        </p>
      </div>

      {survey && (
        <div className="card p-5">
          <h4 className="font-bold text-ink">Perguntas ({questions.length})</h4>
          <div className="mt-3 space-y-2">
            {questions.map((q, qi) => (
              <div key={q.id} className="flex items-start justify-between gap-2 rounded-xl border border-navy-light p-3">
                <div>
                  <p className="font-medium text-ink">{qi + 1}. {q.question_text}</p>
                  <p className="text-xs font-semibold text-ink-soft">{REACTION_TYPE_LABEL[q.question_type]}</p>
                </div>
                <button onClick={() => deleteQuestion(q.id)} className="shrink-0 text-xs font-semibold text-brand-red hover:underline">
                  Remover
                </button>
              </div>
            ))}
            {questions.length === 0 && <p className="text-sm text-ink-soft">Nenhuma pergunta cadastrada ainda.</p>}
          </div>
        </div>
      )}

      <NewReactionQuestionForm onAdd={(row) => addQuestions([row])} />
      <ReactionCsvImport onImport={addQuestions} />
    </div>
  )
}

function NewReactionQuestionForm({ onAdd }: { onAdd: (row: { text: string; type: ReactionQuestionType }) => Promise<void> }) {
  const [text, setText] = useState('')
  const [type, setType] = useState<ReactionQuestionType>('likert5')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!text.trim()) return
    setSaving(true)
    try {
      await onAdd({ text: text.trim(), type })
      setText('')
    } catch {
      // erro já exibido pelo ReactionEditor — mantém o formulário preenchido pro admin tentar de novo
    }
    setSaving(false)
  }

  return (
    <div className="card p-5">
      <h4 className="font-bold text-ink">Nova pergunta de reação</h4>
      <label className="mt-3 block text-xs font-semibold text-ink-soft">Tipo de pergunta</label>
      <select
        className="mt-1 w-full rounded-xl border border-navy-light px-4 py-2.5 text-sm"
        value={type}
        onChange={(e) => setType(e.target.value as ReactionQuestionType)}
      >
        {(Object.entries(REACTION_TYPE_LABEL) as [ReactionQuestionType, string][]).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      <textarea
        className="mt-3 w-full rounded-xl border border-navy-light px-4 py-3"
        placeholder='Ex: "O conteúdo do módulo atendeu às minhas expectativas"'
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-3 flex items-center justify-end">
        <button
          onClick={submit}
          disabled={!text.trim() || saving}
          className="rounded-xl bg-brand-red px-4 py-2 text-sm font-bold text-white hover:bg-brand-red-dark disabled:opacity-60"
        >
          {saving ? 'Salvando…' : 'Adicionar pergunta'}
        </button>
      </div>
    </div>
  )
}

const REACTION_TYPE_ALIASES: Record<string, ReactionQuestionType> = {
  likert: 'likert5',
  likert5: 'likert5',
  concordancia: 'likert5',
  concordância: 'likert5',
  nps: 'nps',
  recomendacao: 'nps',
  recomendação: 'nps',
  aberta: 'open_text',
  open_text: 'open_text',
}

interface ParsedReactionRow {
  text: string
  type: ReactionQuestionType
  error?: string
}

function parseReactionCsvRows(rows: string[][]): ParsedReactionRow[] {
  const [header, ...body] = rows
  if (!header) return []
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name)
  const pergIdx = col('pergunta')
  const tipoIdx = col('tipo')

  return body.map((row) => {
    const text = (pergIdx >= 0 ? row[pergIdx] : '')?.trim() ?? ''
    const typeRaw = (tipoIdx >= 0 ? row[tipoIdx] : '')?.trim().toLowerCase() ?? ''
    const type = REACTION_TYPE_ALIASES[typeRaw] ?? 'likert5'
    return { text, type, error: text ? undefined : 'Sem texto de pergunta' }
  })
}

function ReactionCsvImport({ onImport }: { onImport: (rows: { text: string; type: ReactionQuestionType }[]) => Promise<void> }) {
  const [rows, setRows] = useState<ParsedReactionRow[]>([])
  const [importing, setImporting] = useState(false)

  async function handleFile(file: File) {
    const text = await file.text()
    setRows(parseReactionCsvRows(parseCsv(text)))
  }

  const validRows = rows.filter((r) => !r.error)

  async function doImport() {
    setImporting(true)
    try {
      await onImport(validRows.map((r) => ({ text: r.text, type: r.type })))
      setRows([])
    } catch {
      // erro já exibido pelo ReactionEditor
    }
    setImporting(false)
  }

  return (
    <details className="card p-5">
      <summary className="cursor-pointer font-bold text-ink">Importar perguntas de reação via CSV</summary>
      <p className="mt-2 text-xs text-ink-soft">
        Colunas: <code>pergunta, tipo</code>. <code>tipo</code> é <code>likert</code> (escala 1–5), <code>nps</code>{' '}
        (escala 0–10) ou <code>aberta</code> (comentário livre).
      </p>
      <input
        type="file"
        accept=".csv"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        className="mt-3 w-full text-sm"
      />
      {rows.length > 0 && (
        <>
          <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-navy-light">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-bg text-ink-soft">
                  <th className="px-2 py-1.5">Pergunta</th>
                  <th className="px-2 py-1.5">Tipo</th>
                  <th className="px-2 py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-navy-light/60">
                    <td className="px-2 py-1.5">{r.text || '—'}</td>
                    <td className="px-2 py-1.5">{REACTION_TYPE_LABEL[r.type]}</td>
                    <td className={`px-2 py-1.5 font-semibold ${r.error ? 'text-brand-red' : 'text-success'}`}>
                      {r.error ?? 'OK'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={doImport}
            disabled={validRows.length === 0 || importing}
            className="mt-3 rounded-xl bg-brand-red px-4 py-2 text-sm font-bold text-white hover:bg-brand-red-dark disabled:opacity-60"
          >
            {importing ? 'Importando…' : `Importar ${validRows.length} pergunta(s) válida(s)`}
          </button>
        </>
      )}
    </details>
  )
}
