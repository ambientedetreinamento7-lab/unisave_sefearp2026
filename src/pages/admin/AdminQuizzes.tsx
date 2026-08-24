import { useEffect, useState } from 'react'
import { AdminLayout } from './AdminLayout'
import {
  countPillsUsingSurvey,
  createReactionSurvey,
  deleteReactionSurvey,
  getReactionSurveyResponses,
  getReactionSurveys,
  renameReactionSurvey,
} from '../../lib/api'
import { useConfirm } from '../../components/ConfirmDialog'
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

type Mode = 'conhecimento' | 'reacao'

export function AdminQuizzes() {
  const [mode, setMode] = useState<Mode>('conhecimento')

  return (
    <AdminLayout>
      <div className="mb-4 flex w-fit gap-2 rounded-full bg-surface p-1 shadow-sm">
        <button
          onClick={() => setMode('conhecimento')}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            mode === 'conhecimento' ? 'bg-navy text-white' : 'text-ink-soft'
          }`}
        >
          Quiz de Conhecimento
        </button>
        <button
          onClick={() => setMode('reacao')}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            mode === 'reacao' ? 'bg-navy text-white' : 'text-ink-soft'
          }`}
        >
          Pesquisas de Reação
        </button>
      </div>
      {mode === 'conhecimento' ? <KnowledgeQuizzesPanel /> : <ReactionSurveysPanel />}
    </AdminLayout>
  )
}

// ============================================================
// Quiz de Conhecimento (por pílula — inalterado)
// ============================================================

function KnowledgeQuizzesPanel() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [pills, setPills] = useState<Pill[]>([])
  const [selectedPillId, setSelectedPillId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function reload() {
    const [{ data: t }, { data: p }] = await Promise.all([
      supabase.from('tracks').select('*'),
      // Avaliação de reação não é mais por pílula — só pílulas de
      // conteúdo (vídeo/iframe/SCORM) fazem sentido aqui.
      supabase.from('pills').select('*').neq('content_type', 'reaction'),
    ])
    setTracks((t as Track[]) ?? [])
    setPills((p as Pill[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    reload()
  }, [])

  if (loading) return <p className="text-ink-soft">Carregando…</p>

  const selectedPill = pills.find((p) => p.id === selectedPillId) ?? null

  return (
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
          <QuizEditor pill={selectedPill} />
        ) : (
          <div className="card p-8 text-center text-ink-soft">
            Selecione uma pílula à esquerda para editar o quiz de fixação dela.
          </div>
        )}
      </div>
    </div>
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

// ============================================================
// Pesquisas de Reação (spec: reestruturação — reutilizáveis entre
// cursos, não presas a uma pílula só)
// ============================================================

function ReactionSurveysPanel() {
  const confirm = useConfirm()
  const [surveys, setSurveys] = useState<ReactionSurvey[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  async function reload() {
    const list = await getReactionSurveys()
    setSurveys(list)
    setLoading(false)
    return list
  }

  useEffect(() => {
    reload()
  }, [])

  async function handleCreate() {
    const name = prompt('Nome da nova pesquisa de reação (ex: "Avaliação de Reação — Curso Online")')
    if (!name?.trim()) return
    setCreating(true)
    const created = await createReactionSurvey(name.trim())
    await reload()
    setSelectedId(created.id)
    setCreating(false)
  }

  async function handleDelete(survey: ReactionSurvey) {
    const usedBy = await countPillsUsingSurvey(survey.id)
    const warning =
      usedBy > 0
        ? `Excluir "${survey.name}"? Ela está em uso em ${usedBy} pílula(s) — elas ficarão sem avaliação de reação. Todas as respostas já registradas também somem.`
        : `Excluir "${survey.name}"? Todas as respostas já registradas também somem.`
    if (!(await confirm(warning, { danger: true, confirmLabel: 'Excluir' }))) return
    await deleteReactionSurvey(survey.id)
    if (selectedId === survey.id) setSelectedId(null)
    await reload()
  }

  if (loading) return <p className="text-ink-soft">Carregando…</p>

  const selected = surveys.find((s) => s.id === selectedId) ?? null

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      <div className="card max-h-[80vh] overflow-y-auto p-3">
        <button
          onClick={handleCreate}
          disabled={creating}
          className="mb-2 block w-full rounded-lg border-2 border-dashed border-navy-light px-3 py-2 text-left text-sm font-semibold text-navy hover:border-navy disabled:opacity-60"
        >
          + Nova pesquisa
        </button>
        {surveys.map((s) => (
          <div key={s.id} className="group flex items-center gap-1">
            <button
              onClick={() => setSelectedId(s.id)}
              className={`block flex-1 truncate rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                selectedId === s.id ? 'bg-navy text-white' : 'text-ink hover:bg-navy-light'
              }`}
            >
              {s.name}
            </button>
            <button
              onClick={() => handleDelete(s)}
              title="Excluir pesquisa"
              className={`shrink-0 px-1.5 text-sm ${selectedId === s.id ? 'text-white/70 hover:text-white' : 'text-ink-soft hover:text-brand-red'}`}
            >
              ×
            </button>
          </div>
        ))}
        {surveys.length === 0 && <p className="p-3 text-sm text-ink-soft">Nenhuma pesquisa cadastrada ainda.</p>}
      </div>

      <div className="space-y-6">
        {selected ? (
          <ReactionSurveyEditor key={selected.id} survey={selected} onRenamed={reload} />
        ) : (
          <div className="card p-8 text-center text-ink-soft">
            Selecione uma pesquisa à esquerda (ou crie uma nova) pra editar as perguntas e ver as respostas. Pra
            usar uma pesquisa num curso, escolha-a no formulário da pílula do tipo "Avaliação de Reação" em Admin
            → Cursos.
          </div>
        )}
      </div>
    </div>
  )
}

function ReactionSurveyEditor({ survey, onRenamed }: { survey: ReactionSurvey; onRenamed: () => Promise<unknown> }) {
  const [name, setName] = useState(survey.name)
  const [questions, setQuestions] = useState<ReactionQuestion[]>([])
  const [usedByCount, setUsedByCount] = useState(0)
  const [responses, setResponses] = useState<Awaited<ReturnType<typeof getReactionSurveyResponses>>>([])
  const [loading, setLoading] = useState(true)
  const [savingName, setSavingName] = useState(false)
  const [error, setError] = useState('')

  async function reload() {
    setLoading(true)
    const [{ data: qs }, usedBy, resps] = await Promise.all([
      supabase.from('reaction_questions').select('*').eq('survey_id', survey.id).order('order_index'),
      countPillsUsingSurvey(survey.id),
      getReactionSurveyResponses(survey.id),
    ])
    setQuestions((qs as ReactionQuestion[]) ?? [])
    setUsedByCount(usedBy)
    setResponses(resps)
    setLoading(false)
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [survey.id])

  async function saveName() {
    if (!name.trim() || name === survey.name) return
    setSavingName(true)
    await renameReactionSurvey(survey.id, name.trim())
    await onRenamed()
    setSavingName(false)
  }

  async function addQuestions(rows: { text: string; type: ReactionQuestionType; group?: string }[]) {
    if (rows.length === 0) return
    setError('')
    try {
      const { error: insertError } = await supabase.from('reaction_questions').insert(
        rows.map((r, i) => ({
          survey_id: survey.id,
          question_text: r.text,
          question_type: r.type,
          group_name: r.group?.trim() || null,
          order_index: questions.length + i,
        })),
      )
      if (insertError) throw insertError
    } catch (err) {
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

  async function updateQuestion(id: string, patch: { question_text: string; question_type: ReactionQuestionType; group_name: string | null }) {
    setError('')
    const { error: updateError } = await supabase.from('reaction_questions').update(patch).eq('id', id)
    if (updateError) {
      setError(updateError.message)
      return
    }
    await reload()
  }

  // Ordem/agrupamento são a mesma coisa: perguntas consecutivas (por
  // order_index) com o mesmo group_name viram um bloco visual — mover
  // uma pergunta pra cima/baixo também é o que tira/coloca ela num
  // grupo. Sem tabela de grupos separada — o nome fica na própria linha.
  async function moveQuestion(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= questions.length) return
    const a = questions[index]
    const b = questions[target]
    setError('')
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('reaction_questions').update({ order_index: b.order_index }).eq('id', a.id),
      supabase.from('reaction_questions').update({ order_index: a.order_index }).eq('id', b.id),
    ])
    if (e1 || e2) {
      setError((e1 ?? e2)!.message)
      return
    }
    await reload()
  }

  async function renameGroup(oldName: string, newName: string) {
    if (!newName.trim() || newName === oldName) return
    setError('')
    const { error: updateError } = await supabase
      .from('reaction_questions')
      .update({ group_name: newName.trim() })
      .eq('survey_id', survey.id)
      .eq('group_name', oldName)
    if (updateError) {
      setError(updateError.message)
      return
    }
    await reload()
  }

  if (loading) return <p className="text-ink-soft">Carregando…</p>

  // Agrupa a lista já ordenada em blocos visuais (mesma lógica descrita
  // acima em moveQuestion).
  const blocks: { groupName: string | null; items: { q: ReactionQuestion; index: number }[] }[] = []
  questions.forEach((q, index) => {
    const last = blocks[blocks.length - 1]
    if (last && last.groupName === q.group_name) last.items.push({ q, index })
    else blocks.push({ groupName: q.group_name, items: [{ q, index }] })
  })
  const existingGroupNames = [...new Set(questions.map((q) => q.group_name).filter((g): g is string => !!g))]

  return (
    <div className="space-y-4">
      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-brand-red">{error}</p>}

      <div className="card p-5">
        <label className="block text-xs font-semibold text-ink-soft">Nome da pesquisa</label>
        <div className="mt-1 flex gap-2">
          <input
            className="flex-1 rounded-xl border border-navy-light px-4 py-2.5 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            onClick={saveName}
            disabled={savingName || !name.trim() || name === survey.name}
            className="rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            Salvar
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          Usada em <strong>{usedByCount}</strong> pílula(s) hoje — editar as perguntas aqui afeta todos os cursos
          que usam esta pesquisa.
        </p>
      </div>

      <div className="card p-5">
        <h4 className="font-bold text-ink">Perguntas ({questions.length})</h4>
        <p className="mt-1 text-xs text-ink-soft">
          Use as setas para reordenar. Perguntas com o mesmo grupo (nome ao lado do campo "Tipo") ficam
          juntas automaticamente — o agrupamento é opcional.
        </p>
        <div className="mt-3 space-y-4">
          {blocks.map((block, bi) => (
            <div key={bi}>
              {block.groupName && (
                <GroupHeader
                  name={block.groupName}
                  onRename={(newName) => renameGroup(block.groupName!, newName)}
                />
              )}
              <div className={`space-y-2 ${block.groupName ? 'mt-2 border-l-2 border-navy-light pl-3' : ''}`}>
                {block.items.map(({ q, index }) => (
                  <ReactionQuestionRow
                    key={q.id}
                    question={q}
                    isFirst={index === 0}
                    isLast={index === questions.length - 1}
                    existingGroupNames={existingGroupNames}
                    onMove={(dir) => moveQuestion(index, dir)}
                    onSave={(patch) => updateQuestion(q.id, patch)}
                    onDelete={() => deleteQuestion(q.id)}
                  />
                ))}
              </div>
            </div>
          ))}
          {questions.length === 0 && <p className="text-sm text-ink-soft">Nenhuma pergunta cadastrada ainda.</p>}
        </div>
      </div>

      <NewReactionQuestionForm onAdd={(row) => addQuestions([row])} existingGroupNames={existingGroupNames} />
      <ReactionCsvImport onImport={addQuestions} />

      <ReactionResponsesTable surveyName={survey.name} responses={responses} />
    </div>
  )
}

function GroupHeader({ name, onRename }: { name: string; onRename: (newName: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <h5 className="text-sm font-bold uppercase tracking-wide text-navy">{name}</h5>
        <button
          onClick={() => {
            setValue(name)
            setEditing(true)
          }}
          className="text-xs font-semibold text-ink-soft hover:underline"
        >
          Renomear grupo
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        className="rounded-lg border border-navy-light px-2 py-1 text-sm"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button
        onClick={() => {
          onRename(value)
          setEditing(false)
        }}
        disabled={!value.trim()}
        className="text-xs font-semibold text-navy hover:underline disabled:opacity-60"
      >
        Salvar
      </button>
      <button onClick={() => setEditing(false)} className="text-xs font-semibold text-ink-soft hover:underline">
        Cancelar
      </button>
    </div>
  )
}

function ReactionQuestionRow({
  question,
  isFirst,
  isLast,
  existingGroupNames,
  onMove,
  onSave,
  onDelete,
}: {
  question: ReactionQuestion
  isFirst: boolean
  isLast: boolean
  existingGroupNames: string[]
  onMove: (direction: -1 | 1) => void
  onSave: (patch: { question_text: string; question_type: ReactionQuestionType; group_name: string | null }) => Promise<void>
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(question.question_text)
  const [type, setType] = useState<ReactionQuestionType>(question.question_type)
  const [group, setGroup] = useState(question.group_name ?? '')
  const [saving, setSaving] = useState(false)
  const groupListId = `group-options-${question.id}`

  async function save() {
    if (!text.trim()) return
    setSaving(true)
    await onSave({ question_text: text.trim(), question_type: type, group_name: group.trim() || null })
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-navy-light p-3">
        <textarea
          className="w-full rounded-xl border border-navy-light px-3 py-2 text-sm"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <select
            className="rounded-lg border border-navy-light px-2 py-1.5 text-xs"
            value={type}
            onChange={(e) => setType(e.target.value as ReactionQuestionType)}
          >
            {(Object.entries(REACTION_TYPE_LABEL) as [ReactionQuestionType, string][]).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <input
            className="rounded-lg border border-navy-light px-2 py-1.5 text-xs"
            placeholder="Grupo (opcional)"
            list={groupListId}
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          />
          <datalist id={groupListId}>
            {existingGroupNames.map((g) => <option key={g} value={g} />)}
          </datalist>
        </div>
        <div className="mt-2 flex justify-end gap-3">
          <button onClick={() => setEditing(false)} className="text-xs font-semibold text-ink-soft hover:underline">
            Cancelar
          </button>
          <button onClick={save} disabled={!text.trim() || saving} className="text-xs font-semibold text-navy hover:underline disabled:opacity-60">
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start justify-between gap-2 rounded-xl border border-navy-light p-3">
      <div className="flex items-start gap-2">
        <div className="flex flex-col">
          <button
            onClick={() => onMove(-1)}
            disabled={isFirst}
            className="text-ink-soft hover:text-navy disabled:opacity-30"
            title="Mover para cima"
          >
            ▲
          </button>
          <button
            onClick={() => onMove(1)}
            disabled={isLast}
            className="text-ink-soft hover:text-navy disabled:opacity-30"
            title="Mover para baixo"
          >
            ▼
          </button>
        </div>
        <div>
          <p className="font-medium text-ink">{question.question_text}</p>
          <p className="text-xs font-semibold text-ink-soft">{REACTION_TYPE_LABEL[question.question_type]}</p>
        </div>
      </div>
      <div className="flex shrink-0 gap-3">
        <button onClick={() => setEditing(true)} className="text-xs font-semibold text-navy hover:underline">
          Editar
        </button>
        <button onClick={onDelete} className="text-xs font-semibold text-brand-red hover:underline">
          Remover
        </button>
      </div>
    </div>
  )
}

function ReactionResponsesTable({
  surveyName,
  responses,
}: {
  surveyName: string
  responses: Awaited<ReturnType<typeof getReactionSurveyResponses>>
}) {
  function exportCsv() {
    const headers = ['Curso', 'Aluno', 'Data', 'Respostas']
    const rows = responses.map((r) => [
      r.pillTitle,
      r.userName,
      new Date(r.submittedAt).toLocaleString('pt-BR'),
      r.answers.map((a) => `${a.questionText}: ${a.valueText ?? a.valueNumber ?? '—'}`).join(' | '),
    ])
    downloadCsv(`respostas-${surveyName.toLowerCase().replace(/\s+/g, '-')}.csv`, headers, rows)
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-bold text-ink">Respostas ({responses.length})</h4>
        {responses.length > 0 && (
          <button onClick={exportCsv} className="rounded-lg border border-navy-light px-3 py-1.5 text-xs font-semibold text-navy hover:border-navy">
            Baixar CSV
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-soft">
        A coluna "Curso" identifica em qual curso o aluno estava quando respondeu — a mesma pesquisa pode
        aparecer aqui com cursos diferentes.
      </p>
      <div className="mt-3 max-h-96 overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-surface">
            <tr className="text-ink-soft">
              <th className="px-2 py-1.5">Curso</th>
              <th className="px-2 py-1.5">Aluno</th>
              <th className="px-2 py-1.5">Data</th>
              <th className="px-2 py-1.5">Respostas</th>
            </tr>
          </thead>
          <tbody>
            {responses.map((r) => (
              <tr key={r.id} className="border-t border-navy-light/60 align-top">
                <td className="px-2 py-2 font-semibold text-navy">{r.pillTitle}</td>
                <td className="px-2 py-2">{r.userName}</td>
                <td className="px-2 py-2 whitespace-nowrap">{new Date(r.submittedAt).toLocaleString('pt-BR')}</td>
                <td className="px-2 py-2">
                  {r.answers.map((a, i) => (
                    <p key={i}>
                      <span className="text-ink-soft">{a.questionText}:</span> {a.valueText ?? a.valueNumber ?? '—'}
                    </p>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {responses.length === 0 && <p className="p-3 text-sm text-ink-soft">Nenhuma resposta registrada ainda.</p>}
      </div>
    </div>
  )
}

function NewReactionQuestionForm({
  onAdd,
  existingGroupNames,
}: {
  onAdd: (row: { text: string; type: ReactionQuestionType; group?: string }) => Promise<void>
  existingGroupNames: string[]
}) {
  const [text, setText] = useState('')
  const [type, setType] = useState<ReactionQuestionType>('likert5')
  const [group, setGroup] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!text.trim()) return
    setSaving(true)
    try {
      await onAdd({ text: text.trim(), type, group: group.trim() || undefined })
      setText('')
    } catch {
      // erro já exibido pelo ReactionEditor — mantém o formulário preenchido pro admin tentar de novo
    }
    setSaving(false)
  }

  return (
    <div className="card p-5">
      <h4 className="font-bold text-ink">Nova pergunta de reação</h4>
      <div className="mt-3 flex flex-wrap gap-2">
        <div>
          <label className="block text-xs font-semibold text-ink-soft">Tipo de pergunta</label>
          <select
            className="mt-1 rounded-xl border border-navy-light px-4 py-2.5 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as ReactionQuestionType)}
          >
            {(Object.entries(REACTION_TYPE_LABEL) as [ReactionQuestionType, string][]).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold text-ink-soft">Grupo (opcional)</label>
          <input
            className="mt-1 w-full rounded-xl border border-navy-light px-4 py-2.5 text-sm"
            placeholder='Ex: "Conteúdo e Qualidade"'
            list="new-reaction-question-group-options"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          />
          <datalist id="new-reaction-question-group-options">
            {existingGroupNames.map((g) => <option key={g} value={g} />)}
          </datalist>
        </div>
      </div>
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
