import type { IconName } from '../components/Icon'
import type { DiagnosticProfile } from '../types/database'

export const PROGRAMS = [
  // badge: null enquanto o selo do curso não estiver disponível em
  // public/course-badges — OptionRow cai pro ícone genérico nesse caso.
  {
    id: 'administracao',
    name: 'Administração',
    subtitle: 'Diretrizes CNE 2020 · 7 áreas + 6 eixos',
    badge: '/course-badges/selo-adm.png',
  },
  {
    id: 'contabeis',
    name: 'Ciências Contábeis',
    subtitle: 'Framework IFAC/IAESB · 3 blocos',
    badge: '/course-badges/selo-contabilidade.png',
  },
  {
    id: 'economicas',
    name: 'Ciências Econômicas',
    subtitle: '4 blocos de formação',
    badge: '/course-badges/selo-economia.png',
  },
  {
    id: 'financas',
    name: 'Finanças',
    subtitle: 'Taxonomia sintetizada dos 3 PPPs',
    badge: '/course-badges/selo-finan%C3%A7as.png',
  },
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

/** Meu PDI — Painel 70/20/10: as 10 soft skills do passo "maior desafio"
 * (seleção múltipla, até 3). O `label` de cada uma é exatamente o `name`
 * semeado em skill_categories — é assim que Estande.tsx resolve a
 * escolha (texto) pro id real da competência daquele curso, depois do
 * envio. `weight` continua alimentando computeProfile (perfil de 3
 * válvulas), só pra Resultado/recomendação de trilha do pós-evento
 * continuarem funcionando sem mudança. */
export const SOFT_SKILLS: QuizOption[] = [
  { value: 'gestao_tempo', label: 'Gestão de Tempo', subtitle: 'Foco, rotina, prioridades', icon: 'clock', weight: { autogestao: 1 } },
  { value: 'inteligencia_emocional', label: 'Inteligência Emocional', subtitle: 'Autocontrole, empatia', icon: 'heart', weight: { autogestao: 1 } },
  { value: 'logica_dados', label: 'Lógica e Dados', subtitle: 'Análise, raciocínio estruturado', icon: 'cpu', weight: { tech_ia: 1 } },
  { value: 'ia_inovacao', label: 'IA e Inovação', subtitle: 'Novas ferramentas e ideias', icon: 'sparkles', weight: { tech_ia: 1 } },
  { value: 'comunicacao', label: 'Comunicação', subtitle: 'Falar e escrever com clareza', icon: 'message-circle', weight: { lideranca: 1 } },
  { value: 'lideranca', label: 'Liderança', subtitle: 'Guiar pessoas e projetos', icon: 'flag', weight: { lideranca: 1 } },
  { value: 'trabalho_equipe', label: 'Trabalho em Equipe e Colaboração', subtitle: 'Construir junto', icon: 'users', weight: { lideranca: 1 } },
  { value: 'atendimento_cliente', label: 'Atendimento ao Cliente', subtitle: 'Ouvir e resolver pro outro', icon: 'shield', weight: { lideranca: 1 } },
  { value: 'resolucao_problemas', label: 'Resolução de Problemas', subtitle: 'Diagnosticar e agir', icon: 'target', weight: { tech_ia: 1 } },
  { value: 'adaptabilidade', label: 'Adaptabilidade e Gestão da Mudança', subtitle: 'Lidar bem com o imprevisto', icon: 'sun', weight: { autogestao: 1 } },
]

export const MAX_DESAFIO_SKILLS = 3

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
    subtitle: 'Escolha até 3 competências que mais te consomem energia agora.',
    options: SOFT_SKILLS,
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
  /** Até 3 values de SOFT_SKILLS (seleção múltipla). */
  desafio: string[]
  objetivo: string
  program: ProgramSlug
}

/** Perfil de 3 válvulas (Autogestão/Tech&IA/Liderança) — mantido por
 * baixo só pra Resultado.tsx e a recomendação de trilha/catálogo do
 * pós-evento continuarem funcionando sem mudança. Cada uma das até-3
 * soft skills escolhidas soma seu peso, igual ao objetivo (1 escolha só). */
export function computeProfile(answers: Pick<QuizAnswers, 'desafio' | 'objetivo'>): DiagnosticProfile {
  const scores: Record<DiagnosticProfile, number> = { autogestao: 0, tech_ia: 0, lideranca: 0 }

  const desafioQuestion = QUIZ_QUESTIONS.find((q) => q.id === 'desafio')
  for (const value of answers.desafio) {
    const option = desafioQuestion?.options.find((o) => o.value === value)
    if (!option) continue
    for (const [profile, weight] of Object.entries(option.weight)) {
      scores[profile as DiagnosticProfile] += weight ?? 0
    }
  }

  const objetivoQuestion = QUIZ_QUESTIONS.find((q) => q.id === 'objetivo')
  const objetivoOption = objetivoQuestion?.options.find((o) => o.value === answers.objetivo)
  if (objetivoOption) {
    for (const [profile, weight] of Object.entries(objetivoOption.weight)) {
      scores[profile as DiagnosticProfile] += weight ?? 0
    }
  }

  return (Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] as DiagnosticProfile) ?? 'autogestao'
}
