import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  // Descarta uma resposta de loadProfile atrasada de uma troca de sessão
  // anterior (ex.: signInWithPassword seguido de updateUser em sequência,
  // como em AtivarConta) — sem isso, a resposta mais lenta podia sobrescrever
  // o profile já correto de uma chamada mais recente.
  const loadSeq = useRef(0)
  // Guarda o usuário da sessão atual só pra distinguir um SIGNED_IN de
  // verdade (login novo) de um SIGNED_IN "fantasma" — o supabase-js dispara
  // esse mesmo evento de novo toda vez que a aba volta a ficar visível, só
  // pra revalidar a sessão (ver GoTrueClient._onVisibilityChanged), mesmo
  // sem o usuário ter trocado. Sem isso, cada troca de aba/minimização
  // acionava "loading" de novo, o RouteGuard remontava a rota inteira e
  // qualquer vídeo/SCORM em andamento perdia o progresso — parecia a
  // página tendo recarregado sozinha.
  const sessionUserIdRef = useRef<string | null>(null)

  async function loadProfile(userId: string) {
    const seq = ++loadSeq.current
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (seq !== loadSeq.current) return
    setProfile((data as Profile) ?? null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      sessionUserIdRef.current = data.session?.user.id ?? null
      if (data.session) await loadProfile(data.session.user.id)
      setLoading(false)
    })

    // "loading" precisa cobrir qualquer troca de sessão, não só a carga
    // inicial do app — senão RouteGuard renderiza a rota de destino com
    // profile ainda nulo logo após um login (ex.: cadastro em AtivarConta),
    // e as regras que dependem do profile (termos pendentes, senha ainda
    // não definida) não chegam a rodar a tempo, deixando a tela travada até
    // um refresh manual. TOKEN_REFRESHED fica de fora pra não piscar
    // "Carregando…" pra quem já está logado só por renovar o token — e um
    // SIGNED_IN do mesmo usuário que já estava logado (ver comentário
    // acima) recebe o mesmo tratamento.
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      if (!newSession) {
        sessionUserIdRef.current = null
        setProfile(null)
        return
      }
      const sameUser = sessionUserIdRef.current === newSession.user.id
      sessionUserIdRef.current = newSession.user.id
      if (event === 'TOKEN_REFRESHED' || (event === 'SIGNED_IN' && sameUser)) return
      setLoading(true)
      loadProfile(newSession.user.id).finally(() => setLoading(false))
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  async function refreshProfile() {
    if (session) await loadProfile(session.user.id)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
