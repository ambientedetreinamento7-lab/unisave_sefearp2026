import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { NivelCard } from '../../components/NivelCard'
import { useAuth } from '../../context/AuthContext'
import { getPublicProfile } from '../../lib/gamification'
import { PROGRAMS } from '../../lib/quiz'
import { supabase } from '../../lib/supabase'
import type { Program, PublicProfile } from '../../types/database'

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

  // O id do programa no banco é o mesmo slug usado no diagnóstico (ver seed
  // em supabase/schema.sql) — reaproveita o selo de lá em vez de exigir
  // upload de imagem por programa, que hoje nem tem UI de edição.
  const courseBadgeUrl = publicProfile?.program_id
    ? (PROGRAMS.find((p) => p.id === publicProfile.program_id)?.badge ?? null)
    : null

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
            courseBadgeUrl={courseBadgeUrl}
          />
        )}
      </main>
    </div>
  )
}
