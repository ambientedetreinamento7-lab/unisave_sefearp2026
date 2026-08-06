import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HeroBrandBar } from '../../components/HeroBrandBar'
import { Icon } from '../../components/Icon'
import { PROGRAMS, QUIZ_QUESTIONS, computeProfile, type ProgramSlug } from '../../lib/quiz'
import { supabase } from '../../lib/supabase'

type Step = 0 | 1 | 2 | 3 | 4 // 0 = curso, 1-3 = quiz Qs, 4 = capture

const TOTAL_STEPS = 5

export function Estande() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(0)
  const [program, setProgram] = useState<ProgramSlug | ''>('')
  const [fase, setFase] = useState('')
  const [desafio, setDesafio] = useState('')
  const [objetivo, setObjetivo] = useState('')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const answers = { fase, desafio, objetivo }
  const pct = Math.round(((step + 1) / TOTAL_STEPS) * 100)

  function pickProgram(slug: ProgramSlug) {
    setProgram(slug)
    setStep(1)
  }

  function pickOption(qId: 'fase' | 'desafio' | 'objetivo', value: string) {
    if (qId === 'fase') setFase(value)
    if (qId === 'desafio') setDesafio(value)
    if (qId === 'objetivo') setObjetivo(value)
    setStep((s) => (s + 1) as Step)
  }

  async function submit() {
    if (!name || !email || !program) {
      setError('Preencha nome, e-mail e curso antes de continuar.')
      return
    }
    setSubmitting(true)
    setError('')

    try {
      const diagnostic_profile = computeProfile({ desafio, objetivo })

      const { data: programRow } = await supabase.from('programs').select('id').eq('id', program).maybeSingle()
      const { data: trackRow } = await supabase
        .from('tracks')
        .select('id')
        .eq('program_id', program)
        .eq('diagnostic_profile', diagnostic_profile)
        .maybeSingle()

      const { error: upsertError } = await supabase.from('profiles').upsert(
        {
          name,
          email,
          phone_whatsapp: whatsapp || null,
          program_id: programRow?.id ?? program,
          curriculum_period: fase,
          diagnostic_profile,
          selected_track_id: trackRow?.id ?? null,
          role: 'aluno',
        },
        { onConflict: 'email' },
      )
      if (upsertError) throw upsertError

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      })
      if (otpError) throw otpError

      navigate('/resultado', { state: { profile: diagnostic_profile, program, name, email } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="hero-gradient min-h-screen px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <HeroBrandBar />

        <div className="mt-8 text-center sm:mt-10">
          <span className="glass-pill px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide">
            <Icon name="sparkles" size={13} />
            PDI Express · 60 segundos
          </span>

          <h1 className="mx-auto mt-5 max-w-xl text-balance text-[clamp(1.9rem,6vw,2.75rem)] font-extrabold leading-[1.08] text-white">
            Descubra sua trilha de <span className="text-brand-red">desenvolvimento</span> ideal
          </h1>

          <p className="mx-auto mt-4 max-w-md text-sm text-white/70 sm:text-[15px]">
            4 perguntas rápidas. Ao final você recebe um PDI ancorado no perfil de egresso oficial do seu curso e
            acesso liberado à plataforma.
          </p>
        </div>

        <div className="mt-8">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-white/70">
            <span>Passo {step + 1} de {TOTAL_STEPS}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-white transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="card mt-6 p-6 sm:p-8">
          {step === 0 && (
            <StepBlock title="Qual é o seu curso?" subtitle="Seu PDI nasce da taxonomia oficial do curso (PPP / perfil de egresso).">
              <div className="flex flex-col gap-3">
                {PROGRAMS.map((p) => (
                  <OptionRow
                    key={p.id}
                    icon="book"
                    title={p.name}
                    subtitle={p.subtitle}
                    selected={program === p.id}
                    onClick={() => pickProgram(p.id)}
                  />
                ))}
              </div>
            </StepBlock>
          )}

          {step >= 1 && step <= 3 && (
            <StepBlock title={QUIZ_QUESTIONS[step - 1].question} subtitle={QUIZ_QUESTIONS[step - 1].subtitle}>
              <div className="flex flex-col gap-3">
                {QUIZ_QUESTIONS[step - 1].options.map((opt) => (
                  <OptionRow
                    key={opt.value}
                    icon={opt.icon}
                    title={opt.label}
                    subtitle={opt.subtitle}
                    selected={answers[QUIZ_QUESTIONS[step - 1].id] === opt.value}
                    onClick={() => pickOption(QUIZ_QUESTIONS[step - 1].id, opt.value)}
                  />
                ))}
              </div>
            </StepBlock>
          )}

          {step === 4 && (
            <StepBlock title="Quase lá!" subtitle="Informe seus dados para receber seu PDI e o acesso à sua trilha.">
              <div className="flex flex-col gap-3">
                <input
                  className="w-full rounded-xl border border-navy-light px-4 py-3 outline-none focus:border-navy"
                  placeholder="Nome completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <input
                  className="w-full rounded-xl border border-navy-light px-4 py-3 outline-none focus:border-navy"
                  placeholder="E-mail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <input
                  className="w-full rounded-xl border border-navy-light px-4 py-3 outline-none focus:border-navy"
                  placeholder="WhatsApp"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                />
              </div>
              {error && <p className="mt-3 text-sm text-brand-red">{error}</p>}
              <button
                onClick={submit}
                disabled={submitting}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-red py-3 font-bold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
              >
                {submitting ? 'Enviando…' : 'Gerar meu PDI'}
                {!submitting && <Icon name="arrow-right" size={16} />}
              </button>
            </StepBlock>
          )}

          {step > 0 && (
            <button
              onClick={() => setStep((s) => (s - 1) as Step)}
              className="mt-6 text-sm font-medium text-ink-soft hover:text-navy"
            >
              ← Voltar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function StepBlock({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xl font-extrabold text-ink sm:text-2xl">{title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>
      <div className="mt-6">{children}</div>
    </div>
  )
}

function OptionRow({
  icon,
  title,
  subtitle,
  selected,
  onClick,
}: {
  icon: Parameters<typeof Icon>[0]['name']
  title: string
  subtitle: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-4 rounded-2xl border-2 p-4 text-left transition ${
        selected ? 'border-brand-red bg-red-50' : 'border-navy-light hover:border-navy'
      }`}
    >
      <span className="icon-badge h-11 w-11">
        <Icon name={icon} size={20} />
      </span>
      <span className="flex-1">
        <span className={`block font-bold ${selected ? 'text-brand-red' : 'text-ink'}`}>{title}</span>
        <span className="block text-xs text-ink-soft">{subtitle}</span>
      </span>
      <Icon name="arrow-right" size={18} className="text-ink-soft" />
    </button>
  )
}
