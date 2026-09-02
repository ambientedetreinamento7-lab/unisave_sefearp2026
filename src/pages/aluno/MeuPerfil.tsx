import { useEffect, useState } from 'react'
import { AppHeader } from '../../components/AppHeader'
import { Icon } from '../../components/Icon'
import { NivelCard } from '../../components/NivelCard'
import { useAuth } from '../../context/AuthContext'
import { colorForName, initials } from '../../lib/avatar'
import { awardPoints } from '../../lib/gamification'
import { getCommunitySettings } from '../../lib/settings'
import { supabase } from '../../lib/supabase'
import type { Program } from '../../types/database'

const FASE_OPTIONS = [
  { value: 'inicio', label: 'Início (1º ao 3º semestre)' },
  { value: 'meio', label: 'Meio (4º ao 6º semestre)' },
  { value: 'final', label: 'Final (7º em diante)' },
]

export function MeuPerfil() {
  const { profile, refreshProfile } = useAuth()
  const [allowRankingOptOut, setAllowRankingOptOut] = useState(false)

  useEffect(() => {
    getCommunitySettings().then((s) => setAllowRankingOptOut(s.allowRankingOptOut))
  }, [])

  if (!profile) return null

  return (
    <div className="min-h-screen bg-bg pb-16">
      <AppHeader />
      <main className="mx-auto max-w-xl px-4 py-8">
        <h1 className="text-2xl font-extrabold text-ink">Meu Perfil</h1>
        <p className="mt-1 text-ink-soft">Seus dados, foto e senha de acesso.</p>

        <NivelCard name={profile.name} avatarUrl={profile.avatar_url} totalPoints={profile.total_points} />

        <AvatarCard userId={profile.id} name={profile.name} avatarUrl={profile.avatar_url} onChanged={refreshProfile} />
        <DadosCard
          userId={profile.id}
          email={profile.email}
          initialName={profile.name}
          initialPhone={profile.phone_whatsapp}
          initialProgramId={profile.program_id}
          initialFase={profile.curriculum_period}
          initialBirthDate={profile.birth_date}
          onChanged={refreshProfile}
        />
        {allowRankingOptOut && (
          <PrivacidadeCard userId={profile.id} initialOptOut={profile.ranking_opt_out} onChanged={refreshProfile} />
        )}
        <SenhaCard />
      </main>
    </div>
  )
}

function AvatarCard({
  userId,
  name,
  avatarUrl,
  onChanged,
}: {
  userId: string
  name: string
  avatarUrl: string | null
  onChanged: () => Promise<void>
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleSelect(file: File | undefined) {
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const path = `${userId}/avatar-${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('social')
        .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' })
      if (uploadError) throw uploadError
      const url = supabase.storage.from('social').getPublicUrl(path).data.publicUrl
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId)
      if (updateError) throw updateError
      await awardPoints(userId, 'avatar_changed', '')
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível trocar a foto.')
    }
    setUploading(false)
  }

  async function handleRemove() {
    setUploading(true)
    setError('')
    try {
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId)
      if (updateError) throw updateError
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível remover a foto.')
    }
    setUploading(false)
  }

  return (
    <div className="card mt-6 flex items-center gap-4 p-5">
      <label className="group relative h-20 w-20 shrink-0 cursor-pointer">
        <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span
              className="flex h-full w-full items-center justify-center text-xl font-bold text-white"
              style={{ background: colorForName(name) }}
            >
              {initials(name)}
            </span>
          )}
        </span>
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-white opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
          <Icon name="image" size={20} />
        </span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleSelect(e.target.files?.[0])}
        />
      </label>
      <div>
        <p className="font-bold text-ink">{name}</p>
        <p className="text-sm text-ink-soft">{uploading ? 'Enviando…' : 'Clique na foto pra trocar'}</p>
        {avatarUrl && !uploading && (
          <button type="button" onClick={handleRemove} className="mt-0.5 text-xs font-semibold text-brand-red hover:underline">
            Remover foto
          </button>
        )}
        {error && <p className="mt-1 text-xs text-brand-red">{error}</p>}
      </div>
    </div>
  )
}

function DadosCard({
  userId,
  email,
  initialName,
  initialPhone,
  initialProgramId,
  initialFase,
  initialBirthDate,
  onChanged,
}: {
  userId: string
  email: string
  initialName: string
  initialPhone: string | null
  initialProgramId: string | null
  initialFase: string | null
  initialBirthDate: string | null
  onChanged: () => Promise<void>
}) {
  const [programs, setPrograms] = useState<Program[]>([])
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone ?? '')
  const [programId, setProgramId] = useState(initialProgramId ?? '')
  const [fase, setFase] = useState(initialFase ?? '')
  const [birthDate, setBirthDate] = useState(initialBirthDate ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('programs')
      .select('*')
      .then(({ data }) => setPrograms((data as Program[]) ?? []))
  }, [])

  async function submit() {
    setSaving(true)
    setSaved(false)
    setError('')
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        name: name.trim(),
        phone_whatsapp: phone.trim() || null,
        program_id: programId || null,
        curriculum_period: fase || null,
        birth_date: birthDate || null,
      })
      .eq('id', userId)
    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }
    await onChanged()
    setSaving(false)
    setSaved(true)
  }

  return (
    <div className="card mt-4 p-5">
      <h2 className="font-bold text-ink">Dados pessoais</h2>

      <label className="mt-4 block text-xs font-semibold text-ink-soft">Nome</label>
      <input
        className="mt-1 w-full rounded-xl border border-navy-light px-4 py-2.5 outline-none focus:border-navy"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <label className="mt-3 block text-xs font-semibold text-ink-soft">E-mail</label>
      <input
        className="mt-1 w-full rounded-xl border border-navy-light bg-bg px-4 py-2.5 text-ink-soft"
        value={email}
        disabled
      />

      <label className="mt-3 block text-xs font-semibold text-ink-soft">WhatsApp</label>
      <input
        className="mt-1 w-full rounded-xl border border-navy-light px-4 py-2.5 outline-none focus:border-navy"
        placeholder="(00) 00000-0000"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />

      <label className="mt-3 block text-xs font-semibold text-ink-soft">Curso</label>
      <select
        className="mt-1 w-full rounded-xl border border-navy-light px-4 py-2.5"
        value={programId}
        onChange={(e) => setProgramId(e.target.value)}
      >
        <option value="">Selecione…</option>
        {programs.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      <label className="mt-3 block text-xs font-semibold text-ink-soft">Fase da faculdade</label>
      <select
        className="mt-1 w-full rounded-xl border border-navy-light px-4 py-2.5"
        value={fase}
        onChange={(e) => setFase(e.target.value)}
      >
        <option value="">Selecione…</option>
        {FASE_OPTIONS.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>

      <label className="mt-3 block text-xs font-semibold text-ink-soft">Data de nascimento</label>
      <input
        className="mt-1 w-full rounded-xl border border-navy-light px-4 py-2.5 outline-none focus:border-navy"
        type="date"
        value={birthDate}
        onChange={(e) => setBirthDate(e.target.value)}
      />
      <p className="mt-1 text-xs text-ink-soft">
        Usada só para recuperar sua senha caso você perca o acesso ao seu e-mail.
      </p>

      {error && <p className="mt-3 text-sm text-brand-red">{error}</p>}
      {saved && <p className="mt-3 text-sm text-success">Dados salvos!</p>}

      <button
        onClick={submit}
        disabled={saving || !name.trim()}
        className="mt-4 rounded-xl bg-brand-red px-5 py-2.5 font-bold text-white hover:bg-brand-red-dark disabled:opacity-60"
      >
        {saving ? 'Salvando…' : 'Salvar alterações'}
      </button>
    </div>
  )
}

function PrivacidadeCard({
  userId,
  initialOptOut,
  onChanged,
}: {
  userId: string
  initialOptOut: boolean
  onChanged: () => Promise<void>
}) {
  const [optOut, setOptOut] = useState(initialOptOut)
  const [saving, setSaving] = useState(false)

  async function toggle(value: boolean) {
    setOptOut(value)
    setSaving(true)
    await supabase.from('profiles').update({ ranking_opt_out: value }).eq('id', userId)
    await onChanged()
    setSaving(false)
  }

  return (
    <div className="card mt-4 p-5">
      <h3 className="font-bold text-ink">Privacidade</h3>
      <label className="mt-3 flex items-center gap-2 text-sm font-medium text-ink">
        <input type="checkbox" checked={optOut} disabled={saving} onChange={(e) => toggle(e.target.checked)} />
        Não aparecer no ranking público
      </label>
    </div>
  )
}

function SenhaCard() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

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
    setSaved(false)
    setError('')
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }
    setSaving(false)
    setSaved(true)
    setPassword('')
    setConfirm('')
  }

  return (
    <div className="card mt-4 p-5">
      <h2 className="font-bold text-ink">Trocar senha</h2>

      <label className="mt-4 block text-xs font-semibold text-ink-soft">Nova senha</label>
      <input
        type="password"
        className="mt-1 w-full rounded-xl border border-navy-light px-4 py-2.5 outline-none focus:border-navy"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <label className="mt-3 block text-xs font-semibold text-ink-soft">Confirmar nova senha</label>
      <input
        type="password"
        className="mt-1 w-full rounded-xl border border-navy-light px-4 py-2.5 outline-none focus:border-navy"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />

      {error && <p className="mt-3 text-sm text-brand-red">{error}</p>}
      {saved && <p className="mt-3 text-sm text-success">Senha atualizada!</p>}

      <button
        onClick={submit}
        disabled={saving || !password || !confirm}
        className="mt-4 rounded-xl bg-navy px-5 py-2.5 font-bold text-white hover:bg-navy-dark disabled:opacity-60"
      >
        {saving ? 'Salvando…' : 'Atualizar senha'}
      </button>
    </div>
  )
}
