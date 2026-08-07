import type { PdiTier } from '../types/database'

// Conteúdo extraído e resumido do documento de metodologia de PDI (validado
// com o usuário), sourced dos PPPs oficiais da FEA-RP/USP: Administração
// (perfil do egresso 2025/2026, AACSB), Ciências Contábeis (IFAC/IAESB 2019
// + Res. CNE/CES nº 1/2024) e Finanças e Negócios. Economia não tem PPP
// próprio analisado ainda — os exemplos abaixo são inferidos do núcleo
// comum entre os demais cursos e devem ser revistos quando o PPP de
// Economia estiver disponível.

export interface JornadaCadence {
  freq: string
  detail: string
}

export const JORNADA_CADENCE: Record<PdiTier, JornadaCadence> = {
  abaixo: { freq: 'Quinzenal', detail: 'Check-in de 15 min focado em destravar bloqueios pontuais. Calibração formal a cada bimestre.' },
  proximo: { freq: 'Mensal', detail: 'Revisão curta de metas do semestre. Calibração a cada bimestre, fora de semana de prova.' },
  dentro: { freq: 'Trimestral', detail: 'Revisão leve, tom de manutenção. Calibração de faixa uma vez por semestre.' },
  acima: { freq: 'Semestral', detail: 'Conversa focada em novos desafios, não em controle. Calibração alinhada ao fim do semestre.' },
}

interface TierMeta {
  title: string
  summary: string
}

export const TIER_META: Record<PdiTier, TierMeta> = {
  abaixo: {
    title: 'Recomeço guiado',
    summary: 'Foco em reconstruir a base com acompanhamento próximo — sem pressa de subir de faixa antes da hora certa.',
  },
  proximo: {
    title: 'Consistência em construção',
    summary: 'Menos sobre aprender algo novo, mais sobre treinar ritmo e regularidade nas entregas.',
  },
  dentro: {
    title: 'Consolidar com propósito',
    summary: 'A régua está sendo cumprida com qualidade — hora de aprofundar em algo escolhido, com mais autonomia.',
  },
  acima: {
    title: 'Amplie seu raio de impacto',
    summary: 'O desempenho já passou do esperado — o desafio agora é liderar, não repetir mais do mesmo.',
  },
}

interface ProgramJornada {
  pratica: string
  mentoria: string
  formacao: string
  inferred?: boolean
}

// 70% prática real / 20% mentoria-exposição / 10% educação formal, por faixa
// e por curso (profiles.program_id).
const PROGRAM_JOURNEYS: Record<string, Record<PdiTier, ProgramJornada>> = {
  administracao: {
    abaixo: {
      pratica: 'Tarefa pequena e supervisionada dentro de um projeto real de empresa júnior, ligada ao ponto exato do gap.',
      mentoria: 'Check-in curto com monitor + um colega veterano como par de apoio.',
      formacao: 'Revisão dirigida da disciplina com maior peso no gap identificado.',
    },
    proximo: {
      pratica: 'Participação estruturada em projeto de extensão com entregas quinzenais fixas, pra treinar ritmo.',
      mentoria: 'Observação de perto de um colega que já resolveu o mesmo padrão de oscilação.',
      formacao: 'Feedback estruturado de 5 min após cada apresentação em grupo.',
    },
    dentro: {
      pratica: 'Projeto de maior escopo dentro da empresa júnior ou iniciação científica em Administração Geral, Gestão de Pessoas ou Produção e Operações.',
      mentoria: 'Mentoria de manutenção bimestral, mais carreira do que correção de rota.',
      formacao: 'Participação ativa em eventos e semanas acadêmicas do curso.',
    },
    acima: {
      pratica: 'Liderar uma célula ou projeto de empresa júnior, ou representar o curso em competição de cases.',
      mentoria: 'Virar mentor de um colega em faixa Próximo ao Esperado.',
      formacao: 'Certificações avançadas e trilha transversal de competências do futuro.',
    },
  },
  contabeis: {
    abaixo: {
      pratica: 'Exercícios práticos guiados sobre o ponto exato que pesou na prova, revisados por monitor, seguidos de uma tarefa real supervisionada (ex.: conciliação bancária) na Empresa Júnior de Contábeis.',
      mentoria: 'Par de apoio: um veterano que já passou pela mesma disciplina.',
      formacao: 'Revisão dirigida em Contabilidade e Relatórios Financeiros ou na área técnica do gap (Auditoria, Tributação etc.).',
    },
    proximo: {
      pratica: 'Rotina fixa de entregas quinzenais em um caso prático real (auditoria simulada, apuração tributária).',
      mentoria: 'Referência prática de um colega com o mesmo padrão de oscilação já resolvido.',
      formacao: 'Feedback estruturado e direto após cada entrega.',
    },
    dentro: {
      pratica: 'Iniciação científica ou monitoria em Auditoria, Asseguração e Controles Internos, ou em Contabilidade e Decisões Gerenciais.',
      mentoria: 'Mentoria de manutenção bimestral.',
      formacao: 'Participação ativa em eventos do curso e semanas de Ciências Contábeis.',
    },
    acima: {
      pratica: 'Coordenar uma célula de auditoria ou perícia dentro da Empresa Júnior de Contábeis, ou representar o curso em competição de cases.',
      mentoria: 'Mentor de colega em faixa Próximo ao Esperado.',
      formacao: 'Certificações avançadas (ex.: trilhas ligadas a IFAC/IAESB) e competências do futuro.',
    },
  },
  financas: {
    abaixo: {
      pratica: 'Revisão guiada do ponto exato do gap (ex.: Matemática Financeira, Análise das Demonstrações Financeiras) + tarefa supervisionada simples na Empresa Júnior de Finanças.',
      mentoria: 'Par de apoio: veterano que já passou pela mesma disciplina.',
      formacao: 'Revisão dirigida no núcleo técnico do gap (Finanças Corporativas, Mercado Financeiro).',
    },
    proximo: {
      pratica: 'Participação estruturada em um case real de análise de investimento ou crédito, com entregas fixas.',
      mentoria: 'Observar de perto um colega que já resolveu o mesmo padrão de oscilação.',
      formacao: 'Feedback estruturado após cada entrega.',
    },
    dentro: {
      pratica: 'Iniciação científica ou monitoria ligada a Avaliação de Empresas, Mercados e Instrumentos Financeiros ou Análise de Risco.',
      mentoria: 'Mentoria de manutenção bimestral.',
      formacao: 'Participação ativa em eventos do curso.',
    },
    acima: {
      pratica: 'Coordenar uma célula de valuation dentro da Empresa Júnior de Finanças, ou representar o curso em competição de cases.',
      mentoria: 'Mentor de colega em faixa Próximo ao Esperado.',
      formacao: 'Certificações avançadas (mercado financeiro) e competências do futuro.',
    },
  },
  economicas: {
    abaixo: {
      pratica: 'Revisão guiada do ponto exato do gap (ex.: Microeconomia, Macroeconomia) + aplicação prática supervisionada.',
      mentoria: 'Par de apoio: veterano que já passou pela mesma disciplina.',
      formacao: 'Revisão dirigida no núcleo técnico do gap.',
    },
    proximo: {
      pratica: 'Participação estruturada em projeto aplicado de análise de conjuntura, com entregas fixas.',
      mentoria: 'Observar de perto um colega que já resolveu o mesmo padrão de oscilação.',
      formacao: 'Feedback estruturado após cada entrega.',
    },
    dentro: {
      pratica: 'Iniciação científica ligada a análise de conjuntura ou monitoria na disciplina de maior domínio.',
      mentoria: 'Mentoria de manutenção bimestral.',
      formacao: 'Participação ativa em eventos e semanas acadêmicas do curso.',
    },
    acima: {
      pratica: 'Liderar um projeto de pesquisa aplicada ou representar o curso em competição de cases.',
      mentoria: 'Mentor de colega em faixa Próximo ao Esperado.',
      formacao: 'Certificações avançadas e competências do futuro.',
    },
  },
}

const FALLBACK_JOURNEY: Record<PdiTier, ProgramJornada> = PROGRAM_JOURNEYS.administracao

export function isInferredProgram(programId: string | null): boolean {
  return programId === 'economicas'
}

export function getProgramJourney(programId: string | null, tier: PdiTier): ProgramJornada {
  if (!programId) return { ...FALLBACK_JOURNEY[tier], inferred: true }
  const program = PROGRAM_JOURNEYS[programId]
  if (!program) return { ...FALLBACK_JOURNEY[tier], inferred: true }
  return { ...program[tier], inferred: isInferredProgram(programId) }
}
