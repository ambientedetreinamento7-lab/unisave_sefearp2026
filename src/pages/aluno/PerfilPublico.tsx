import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { NivelCard } from '../../components/NivelCard'
import { useAuth } from '../../context/AuthContext'
import { getPublicProfile } from '../../lib/gamification'
import type { PublicProfile } from '../../types/database'

export function PerfilPublico() {
  const { userId } = useParams<{ userId: string }>()
  const { profile } = useAuth()
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    getPublicProfile(userId).then((p) => {
      setPublicProfile(p)
      setLoading(false)
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
          <NivelCard name={publicProfile.name} avatarUrl={publicProfile.avatar_url} totalPoints={publicProfile.total_points} />
        )}
      </main>
    </div>
  )
}
