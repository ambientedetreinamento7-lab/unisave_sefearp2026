import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { NivelCard } from '../../components/NivelCard'
import { useConfirm } from '../../components/ConfirmDialog'
import { useAuth } from '../../context/AuthContext'
import { getPublicProfile } from '../../lib/gamification'
import { createOccurrence, deleteOccurrence, getStudentOccurrences } from '../../lib/occurrences'
import type { StudentOccurrenceWithAuthor } from '../../lib/occurrences'
import { supabase } from '../../lib/supabase'
import type { OccurrenceType, Program, PublicProfile } from '../../types/database'

export function PerfilPublico() {
  const { userId } = useParams<{ userId: string }>()
  const { profile } = useAuth()
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null)
  const [courseName, setCourseName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    getPublicProfile(userId).then(async (p) => {
      setPublicProfile(p)
      setLoading(false)
      if (p?.program_id) {
        const { data } = await supabase.from('programs').select('*').eq('id', p.program_id).maybeSingle()
        setCourseName((data as Program | null)?.name ?? null)
      } else {
        setCourseName(null)
      }
    })
  }, [userId])

  if (profile && userId === profile.id) {
    return (
      <div className="min-h-screen bg-bg pb-16">
        <AppHeader />
        <main className="mx-auto max-w-xl px-4 py-8">
          <p className="text-ink-soft">
            Esse é o seu próprio perfil —{' '}
            <Link to="/meu-perfil" className="font-semibold text-navy hover:underline">
              acesse Meu Perfil
            </Link>{' '}
            pra editar seus dados.
          </p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg pb-16">
      <AppHeader />
      <main className="mx-auto max-w-xl px-4 py-8">
        <h1 className="text-2xl font-extrabold text-ink">Perfil do aluno</h1>

        {loading && <p className="mt-6 text-ink-soft">Carregando…</p>}
        {!loading && !publicProfile && <p className="mt-6 text-ink-soft">Perfil não encontrado.</p>}
        {!loading && publicProfile && (
          <NivelCard
            name={publicProfile.name}
            avatarUrl={publicProfile.avatar_url}
            totalPoints={publicProfile.total_points}
            courseName={courseName}
            programId={publicProfile.program_id}
          />
        )}

        {!loading && publicProfile && userId && (profile?.role === 'admin' || profile?.role === 'moderador') && (
          <OcorrenciasSection studentId={userId} authorId={profile!.id} />
        )}
      </main>
    </div>
  )
}

const TYPE_LABEL: Record<OccurrenceType, string> = { positivo: '🟢 Positivo', atencao: '🔴 Atenção' }

/** Histórico interno de ocorrências sobre o aluno (formações presenciais
 * etc.) — só visível aqui, pra quem abre o perfil como admin/moderador; o
 * próprio aluno nunca vê esta seção nem os dados (RLS barra o select). */
function OcorrenciasSection({ studentId, authorId }: { studentId: string; authorId: string }) {
  const confirm = useConfirm()
  const [items, setItems] = useState<StudentOccurrenceWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<OccurrenceType>('positivo')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function reload() {
    setItems(await getStudentOccurrences(studentId))
    setLoading(false)
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId])

  async function handleCreate() {
    if (!note.trim()) return
    setSaving(true)
    setError('')
    try {
      await createOccurrence(studentId, authorId, type, note)
      setNote('')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível registrar a ocorrência.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!(await confirm('Remover esta ocorrência? Esta ação não pode ser desfeita.', { danger: true, confirmLabel: 'Remover' })))
      return
    await deleteOccurrence(id)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  return (
    <div className="card mt-6 p-6">
      <h2 className="font-bold text-ink">Ocorrências</h2>
      <p className="mt-1 text-xs text-ink-soft">
        Registro interno — visível só pra admin e moderador, nunca aparece pro aluno.
      </p>

      <div className="mt-4 space-y-2">
        <div className="flex gap-2">
          <button
            onClick={() => setType('positivo')}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              type === 'positivo' ? 'bg-green-50 text-success' : 'bg-chip text-ink-soft'
            }`}
          >
            🟢 Positivo
          </button>
          <button
            onClick={() => setType('atencao')}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              type === 'atencao' ? 'bg-red-50 text-brand-red' : 'bg-chip text-ink-soft'
            }`}
          >
            🔴 Atenção
          </button>
        </div>
        <textarea
          className="w-full rounded-xl border border-navy-light px-4 py-3 text-sm outline-none focus:border-navy"
          rows={3}
          placeholder="O que aconteceu na formação presencial…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {error && <p className="text-sm text-brand-red">{error}</p>}
        <button
          onClick={handleCreate}
          disabled={saving || !note.trim()}
          className="rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark disabled:opacity-60"
        >
          {saving ? 'Registrando…' : '+ Registrar ocorrência'}
        </button>
      </div>

      <div className="mt-5 space-y-2 border-t border-navy-light pt-4">
        {loading && <p className="text-sm text-ink-soft">Carregando…</p>}
        {!loading && items.length === 0 && <p className="text-sm text-ink-soft">Nenhuma ocorrência registrada ainda.</p>}
        {items.map((item) => (
          <div key={item.id} className="rounded-xl bg-bg p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-xs font-semibold">{TYPE_LABEL[item.type]}</span>
                <p className="mt-1 text-sm text-ink">{item.note}</p>
                <p className="mt-1 text-xs text-ink-soft">
                  {item.authorName} · {new Date(item.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <button onClick={() => handleDelete(item.id)} className="shrink-0 text-xs font-medium text-brand-red hover:underline">
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
