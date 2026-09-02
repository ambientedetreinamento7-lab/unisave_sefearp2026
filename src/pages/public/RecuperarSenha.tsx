import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { HeroBrandBar } from '../../components/HeroBrandBar'
import { usePlatformSettings } from '../../context/PlatformSettingsContext'
import { supabase } from '../../lib/supabase'

export function RecuperarSenha() {
  const navigate = useNavigate()
  const { security } = usePlatformSettings()
  const [email, setEmail] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  async function submit() {
    if (!email || !birthDate) {
      setError('Informe seu e-mail e sua data de nascimento.')
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

    const { error: rpcError } = await supabase.rpc('reset_password_with_birth_date', {
      p_email: email,
      p_birth_date: birthDate,
      p_new_password: password,
    })
    setSaving(false)
    if (rpcError) {
      setError('E-mail ou data de nascimento não conferem, ou houve tentativas em excesso. Tente novamente em alguns minutos.')
      return
    }
    setDone(true)
  }

  if (!security.birthDateResetEnabled) {
    return (
      <div className="hero-gradient flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center">
            <HeroBrandBar compact />
          </div>
          <div className="card p-6 text-center">
            <h1 className="text-lg font-bold text-ink">Recuperação indisponível</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Essa forma de recuperar a senha está desativada no momento. Use o link mágico na tela de login.
            </p>
            <Link
              to="/entrar"
              className="mt-5 block w-full rounded-xl bg-brand-red py-3 font-bold text-white transition hover:bg-brand-red-dark"
            >
              Voltar para o login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="hero-gradient flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center">
            <HeroBrandBar compact />
          </div>
          <div className="card p-6 text-center">
            <h1 className="text-lg font-bold text-ink">Senha atualizada!</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Sua senha foi trocada com sucesso. Agora é só entrar com o e-mail e a nova senha.
            </p>
            <button
              onClick={() => navigate('/entrar')}
              className="mt-5 w-full rounded-xl bg-brand-red py-3 font-bold text-white transition hover:bg-brand-red-dark"
            >
              Ir para o login
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="hero-gradient flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <HeroBrandBar compact />
        </div>

        <div className="card p-6">
          <h1 className="text-lg font-bold text-ink">Recuperar senha</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Confirme seu e-mail e sua data de nascimento para definir uma nova senha, sem precisar de e-mail de
            confirmação. Esse caminho só funciona se você já preencheu sua data de nascimento em Meu Perfil.
          </p>

          <input
            className="mt-5 w-full rounded-xl border border-navy-light px-4 py-3 outline-none focus:border-navy"
            placeholder="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="mt-3 block text-xs font-semibold text-ink-soft">Data de nascimento</label>
          <input
            className="mt-1 w-full rounded-xl border border-navy-light px-4 py-3 outline-none focus:border-navy"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
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
            disabled={saving || !email || !birthDate || !password || !confirm}
            className="mt-5 w-full rounded-xl bg-brand-red py-3 font-bold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
          >
            {saving ? 'Verificando…' : 'Trocar senha'}
          </button>

          <p className="mt-4 text-center text-sm text-ink-soft">
            Prefere usar o e-mail?{' '}
            <Link to="/entrar" className="font-semibold text-navy">
              Voltar para o login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
