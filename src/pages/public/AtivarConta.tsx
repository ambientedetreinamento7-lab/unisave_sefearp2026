import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { HeroBrandBar } from '../../components/HeroBrandBar'
import { supabase } from '../../lib/supabase'

const DEFAULT_PASSWORD = 'Mudar@123'

export function AtivarConta() {
  const navigate = useNavigate()
  const location = useLocation()
  const stateEmail = (location.state as { email?: string } | null)?.email ?? ''
  const [email, setEmail] = useState(stateEmail)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!email) {
      setError('Informe o e-mail usado no cadastro.')
      return
    }
    if (password.length < 6) {
      setError('A nova senha precisa ter pelo menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }
    setSaving(true)
    setError('')

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: DEFAULT_PASSWORD,
    })
    if (signInError || !signInData.session) {
      setError('Não foi possível confirmar a senha inicial. Confira o e-mail ou fale com o administrador.')
      setSaving(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    await supabase.from('profiles').update({ password_set: true }).eq('id', signInData.session.user.id)
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
          <h1 className="text-lg font-bold text-ink">Ative sua conta</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Sua senha inicial é <strong className="text-ink">Mudar@123</strong>. Confirme com esse valor e defina uma
            senha nova para continuar.
          </p>

          <label className="mt-5 block text-xs font-semibold text-ink-soft">E-mail</label>
          <input
            className="mt-1 w-full rounded-xl border border-navy-light px-4 py-3 outline-none focus:border-navy"
            placeholder="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="mt-3 block text-xs font-semibold text-ink-soft">Nova senha</label>
          <input
            className="mt-1 w-full rounded-xl border border-navy-light px-4 py-3 outline-none focus:border-navy"
            placeholder="Nova senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <label className="mt-3 block text-xs font-semibold text-ink-soft">Confirmar nova senha</label>
          <input
            className="mt-1 w-full rounded-xl border border-navy-light px-4 py-3 outline-none focus:border-navy"
            placeholder="Confirmar nova senha"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />

          {error && <p className="mt-3 text-sm text-brand-red">{error}</p>}

          <button
            onClick={submit}
            disabled={saving || !email || !password || !confirm}
            className="mt-5 w-full rounded-xl bg-brand-red py-3 font-bold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
          >
            {saving ? 'Ativando…' : 'Ativar conta e entrar'}
          </button>
        </div>
      </div>
    </div>
  )
}
