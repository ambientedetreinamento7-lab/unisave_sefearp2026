import type { IconName } from '../components/Icon'
import type { DiagnosticProfile } from '../types/database'

export const PROGRAMS = [
  { id: 'administracao', name: 'Administração', subtitle: 'Diretrizes CNE 2020 · 7 áreas + 6 eixos' },
  { id: 'contabeis', name: 'Ciências Contábeis', subtitle: 'Framework IFAC/IAESB · 3 blocos' },
  { id: 'economicas', name: 'Ciências Econômicas', subtitle: '4 blocos de formação' },
  { id: 'financas', name: 'Finanças', subtitle: 'Taxonomia sintetizada dos 3 PPPs' },
] as const

export type ProgramSlug = (typeof PROGRAMS)[number]['id']

export const CURRICULUM_PERIODS = [
  { id: 'inicio', label: 'Início do curso' },
  { id: 'meio', label: 'Meio do curso' },
  { id: 'final', label: 'Final do curso' },
] as const

interface ProfileInfo {
  label: string
  title: string
  description: string
  color: string
  avatarLetter: string
  trackTitle: string
  talk: { title: string; location: string }
}

export const PROFILE_INFO: Record<DiagnosticProfile, ProfileInfo> = {
  autogestao: {
    label: 'Autogestão',
    title: 'Autogestão & Equilíbrio',
    description:
      'Trilha para quem busca foco, produtividade saudável e equilíbrio entre faculdade, vida pessoal e carreira.',
    color: '#E30613',
    avatarLetter: 'A',
    trackTitle: 'Domine seu tempo, sua energia e sua ansiedade',
    talk: { title: 'Rotina de alta performance sem burnout', location: 'Auditório Central, 15h' },
  },
  tech_ia: {
    label: 'Tech & IA',
    title: 'Tech & IA',
    description:
      'Trilha para quem busca alta performance com dados, lógica e inteligência artificial aplicada ao curso.',
    color: '#E30613',
    avatarLetter: 'T',
    trackTitle: 'Domine dados, lógica e IA aplicada ao seu curso',
    talk: { title: 'IA aplicada ao seu curso — dados e decisão na prática', location: 'Auditório Central, 16h' },
  },
  lideranca: {
    label: 'Liderança',
    title: 'Liderança & Mercado',
    description:
      'Trilha para quem busca comunicação, posicionamento e preparação para estágio, trainee e liderança.',
    color: '#E30613',
    avatarLetter: 'L',
    trackTitle: 'Domine comunicação, negociação e liderança',
    talk: { title: 'Do estágio à liderança — seu diferencial de mercado', location: 'Auditório Central, 17h' },
  },
}

interface QuizOption {
  value: string
  label: string
  subtitle: string
  icon: IconName
  weight: Partial<Record<DiagnosticProfile, number>>
}

interface QuizQuestionDef {
  id: 'fase' | 'desafio' | 'objetivo'
  question: string
  subtitle: string
  options: QuizOption[]
}

export const QUIZ_QUESTIONS: QuizQuestionDef[] = [
  {
    id: 'fase',
    question: 'Em qual fase da faculdade você está?',
    subtitle: 'Isso define a fase curricular do seu plano.',
    options: [
      { value: 'inicio', label: 'Início', subtitle: '1º ao 3º semestre', icon: 'graduation-cap', weight: {} },
      { value: 'meio', label: 'Meio', subtitle: '4º ao 6º semestre', icon: 'target', weight: {} },
      { value: 'final', label: 'Final', subtitle: '7º em diante', icon: 'trophy', weight: {} },
    ],
  },
  {
    id: 'desafio',
    question: 'Qual é o seu maior desafio hoje?',
    subtitle: 'Escolha o que mais te consome energia agora.',
    options: [
      {
        value: 'tempo_ansiedade',
        label: 'Gestão do tempo e ansiedade',
        subtitle: 'Foco, rotina, equilíbrio',
        icon: 'clock',
        weight: { autogestao: 2 },
      },
      {
        value: 'ia_dados',
        label: 'IA, lógica e dados',
        subtitle: 'Ferramentas e pensamento tech',
        icon: 'cpu',
        weight: { tech_ia: 2 },
      },
      {
        value: 'comunicacao_lideranca',
        label: 'Comunicação e liderança',
        subtitle: 'Falar, negociar, se posicionar',
        icon: 'users',
        weight: { lideranca: 2 },
      },
    ],
  },
  {
    id: 'objetivo',
    question: 'Qual seu objetivo curricular?',
    subtitle: 'O que você quer conquistar nos próximos 12 meses.',
    options: [
      {
        value: 'equilibrio_foco',
        label: 'Equilíbrio e foco',
        subtitle: 'Estudar melhor, viver melhor',
        icon: 'clock',
        weight: { autogestao: 2 },
      },
      {
        value: 'alta_performance_tech',
        label: 'Alta performance Tech',
        subtitle: 'Dominar IA e dados no mercado',
        icon: 'cpu',
        weight: { tech_ia: 2 },
      },
      {
        value: 'estagio_trainee_lideranca',
        label: 'Estágio, trainee, liderança',
        subtitle: 'Se destacar profissionalmente',
        icon: 'users',
        weight: { lideranca: 2 },
      },
    ],
  },
]

export interface QuizAnswers {
  fase: string
  desafio: string
  objetivo: string
  program: ProgramSlug
}

export function computeProfile(answers: Pick<QuizAnswers, 'desafio' | 'objetivo'>): DiagnosticProfile {
  const scores: Record<DiagnosticProfile, number> = { autogestao: 0, tech_ia: 0, lideranca: 0 }

  for (const qId of ['desafio', 'objetivo'] as const) {
    const value = answers[qId]
    const question = QUIZ_QUESTIONS.find((q) => q.id === qId)
    const option = question?.options.find((o) => o.value === value)
    if (!option) continue
    for (const [profile, weight] of Object.entries(option.weight)) {
      scores[profile as DiagnosticProfile] += weight ?? 0
    }
  }

  return (Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] as DiagnosticProfile) ?? 'autogestao'
}
