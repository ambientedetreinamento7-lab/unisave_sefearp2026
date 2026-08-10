import { useState } from 'react'
import { Link } from 'react-router-dom'
import { HeroBrandBar } from '../../components/HeroBrandBar'
import { supabase } from '../../lib/supabase'

export function Entrar() {
  const [mode, setMode] = useState<'magic' | 'senha'>('magic')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleMagicLink() {
    setLoading(true)
    setStatus('idle')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    })
    setLoading(false)
    if (error) {
      setErrorMsg(error.message)
      setStatus('error')
    } else {
      setStatus('sent')
    }
  }

  async function handlePassword() {
    setLoading(true)
    setStatus('idle')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setErrorMsg(error.message)
      setStatus('error')
    } else {
      window.location.href = '/dashboard'
    }
  }

  return (
    <div className="hero-gradient flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <HeroBrandBar compact />
        </div>

        <div className="card p-6">
          <div className="mb-5 flex rounded-full bg-navy-light p-1 text-sm font-semibold">
            <button
              onClick={() => setMode('magic')}
              className={`flex-1 rounded-full py-2 ${mode === 'magic' ? 'bg-navy text-white' : 'text-navy'}`}
            >
              Link mágico
            </button>
            <button
              onClick={() => setMode('senha')}
              className={`flex-1 rounded-full py-2 ${mode === 'senha' ? 'bg-navy text-white' : 'text-navy'}`}
            >
              Senha
            </button>
          </div>
          {mode === 'magic' && (
            <p className="mb-3 text-xs text-ink-soft">
              Primeira vez ou esqueceu a senha? Use o link mágico — você define uma senha assim que entrar.
            </p>
          )}

          <input
            className="mb-3 w-full rounded-xl border border-navy-light px-4 py-3 outline-none focus:border-navy"
            placeholder="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {mode === 'senha' && (
            <input
              className="mb-3 w-full rounded-xl border border-navy-light px-4 py-3 outline-none focus:border-navy"
              placeholder="Senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}

          {status === 'sent' && (
            <p className="mb-3 text-sm text-success">Link mágico enviado! Confira seu e-mail.</p>
          )}
          {status === 'error' && <p className="mb-3 text-sm text-brand-red">{errorMsg}</p>}

          <button
            onClick={mode === 'magic' ? handleMagicLink : handlePassword}
            disabled={loading || !email}
            className="w-full rounded-xl bg-brand-red py-3 font-bold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
          >
            {loading ? 'Enviando…' : mode === 'magic' ? 'Enviar link mágico' : 'Entrar'}
          </button>

          <p className="mt-4 text-center text-sm text-ink-soft">
            Ainda não fez o quiz?{' '}
            <Link to="/estande" className="font-semibold text-navy">
              Comece aqui
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
