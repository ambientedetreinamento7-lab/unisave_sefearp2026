import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HeroBrandBar } from '../../components/HeroBrandBar'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

export function DefinirSenha() {
  const { profile, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }
    setSaving(true)
    setError('')

    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    if (profile) {
      await supabase.from('profiles').update({ password_set: true }).eq('id', profile.id)
      await refreshProfile()
    }
    setSaving(false)
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="hero-gradient flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <HeroBrandBar compact />
        </div>

        <div className="card p-6">
          <h1 className="text-lg font-bold text-ink">Defina sua senha</h1>
          <p className="mt-1 text-sm text-ink-soft">
            É só nesta primeira vez — depois disso você entra direto com e-mail e senha, sem precisar de um novo
            link por e-mail toda vez.
          </p>

          <input
            className="mt-5 w-full rounded-xl border border-navy-light px-4 py-3 outline-none focus:border-navy"
            placeholder="Nova senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            className="mt-3 w-full rounded-xl border border-navy-light px-4 py-3 outline-none focus:border-navy"
            placeholder="Confirmar senha"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />

          {error && <p className="mt-3 text-sm text-brand-red">{error}</p>}

          <button
            onClick={submit}
            disabled={saving || !password || !confirm}
            className="mt-5 w-full rounded-xl bg-brand-red py-3 font-bold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
          >
            {saving ? 'Salvando…' : 'Salvar e continuar'}
          </button>

          <button onClick={signOut} className="mt-4 w-full text-center text-sm font-medium text-ink-soft hover:text-navy">
            Sair
          </button>
        </div>
      </div>
    </div>
  )
}
