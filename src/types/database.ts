export type DiagnosticProfile = 'autogestao' | 'tech_ia' | 'lideranca'
export type UserRole = 'aluno' | 'moderador' | 'admin'
export type PillStatus = 'not_started' | 'in_progress' | 'completed'
export type SkillType = 'tecnica' | 'comportamental' | 'etica'
export type ContentType = 'video' | 'iframe' | 'scorm'
export type PdiPlanType = 'trilha_evento' | 'plano_pessoal' | 'plano_institucional'
export type PdiItemType = 'skill_category' | 'pill' | 'trilha'
export type PdiItemStatus = 'nao_iniciado' | 'em_andamento' | 'concluido'

export interface Profile {
  id: string
  name: string
  email: string
  phone_whatsapp: string | null
  program_id: string | null
  curriculum_period: string | null
  diagnostic_profile: DiagnosticProfile | null
  selected_track_id: string | null
  role: UserRole
  created_at: string
}

export interface Program {
  id: string
  name: string
  mission: string | null
  framework_reference: string | null
  color_accent: string | null
}

export interface SkillCategory {
  id: string
  program_id: string
  name: string
  type: SkillType
}

export interface Track {
  id: string
  title: string
  description: string | null
  icon: string | null
  primary_color: string | null
  program_id: string
  diagnostic_profile: DiagnosticProfile
  objetivo_geral: string | null
  publico_alvo: string | null
  pre_requisitos: string | null
  carga_horaria_total: number | null
  certificate_enabled: boolean
}

export interface Pill {
  id: string
  track_id: string
  title: string
  axis: string | null
  description: string | null
  duration: string | null
  badge_icon_url: string | null
  content_type: ContentType
  content_url: string | null
  scorm_package_url: string | null
  scorm_manifest_path: string | null
}

export interface UserProgress {
  id: string
  user_id: string
  pill_id: string
  status: PillStatus
  quiz_score: number | null
  completed_at: string | null
}

export interface Quiz {
  id: string
  pill_id: string
  min_pass_score: number
}

export interface QuizQuestion {
  id: string
  quiz_id: string
  question_text: string
  options: string[]
  correct_option_index: number
}

export interface SkillRating {
  id: string
  user_id: string
  skill_category_id: string
  self_rating: number | null
  moderator_rating: number | null
  rated_at: string
}

export interface PdiPlan {
  id: string
  user_id: string
  title: string
  type: PdiPlanType
  endorsed: boolean
  progress_pct: number
  created_at: string
}

export interface PdiPlanItem {
  id: string
  plan_id: string
  item_type: PdiItemType
  ref_id: string
  progress_current: number
  progress_total: number
  status: PdiItemStatus
  order_index: number
}

// Minimal Supabase Database generic — extend with generated types once the
// project is linked (`supabase gen types typescript`).
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> }
      programs: { Row: Program; Insert: Partial<Program>; Update: Partial<Program> }
      skill_categories: { Row: SkillCategory; Insert: Partial<SkillCategory>; Update: Partial<SkillCategory> }
      tracks: { Row: Track; Insert: Partial<Track>; Update: Partial<Track> }
      pills: { Row: Pill; Insert: Partial<Pill>; Update: Partial<Pill> }
      user_progress: { Row: UserProgress; Insert: Partial<UserProgress>; Update: Partial<UserProgress> }
      quizzes: { Row: Quiz; Insert: Partial<Quiz>; Update: Partial<Quiz> }
      questions: { Row: QuizQuestion; Insert: Partial<QuizQuestion>; Update: Partial<QuizQuestion> }
      skill_ratings: { Row: SkillRating; Insert: Partial<SkillRating>; Update: Partial<SkillRating> }
      pdi_plans: { Row: PdiPlan; Insert: Partial<PdiPlan>; Update: Partial<PdiPlan> }
      pdi_plan_items: { Row: PdiPlanItem; Insert: Partial<PdiPlanItem>; Update: Partial<PdiPlanItem> }
    }
  }
}
