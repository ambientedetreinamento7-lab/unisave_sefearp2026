export type DiagnosticProfile = 'autogestao' | 'tech_ia' | 'lideranca'
export type UserRole = 'aluno' | 'moderador' | 'admin'
export type PillStatus = 'not_started' | 'in_progress' | 'completed'
export type SkillType = 'tecnica' | 'comportamental' | 'etica'
export type ContentType = 'video' | 'iframe' | 'scorm' | 'reaction'
export type PdiPlanType = 'trilha_evento' | 'plano_pessoal' | 'plano_institucional'
export type PdiItemType = 'skill_category' | 'pill' | 'trilha'
export type PdiItemStatus = 'nao_iniciado' | 'em_andamento' | 'concluido'
export type PdiTier = 'abaixo' | 'proximo' | 'dentro' | 'acima'
export type PdiJornadaBucket = 'pratica' | 'mentoria' | 'formacao'
export type SocialScope = 'global' | 'curso'
export type SocialPostType = 'texto' | 'imagem' | 'carrossel' | 'enquete' | 'video'
export type SocialStoryMediaType = 'imagem' | 'video'
export type NotificationType = 'reaction' | 'course_completed' | 'pdi_progress' | 'points'
export type QuestionType = 'single_choice' | 'multiple_choice' | 'true_false' | 'open_text'
export type ReactionQuestionType = 'likert5' | 'nps' | 'open_text'

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
  password_set: boolean
  avatar_url: string | null
  total_points: number
  access_streak: number
  last_access_date: string | null
  nav_tutorial_seen: boolean
  pdi_tutorial_seen: boolean
  ranking_opt_out: boolean
  terms_accepted_version: string | null
  terms_accepted_at: string | null
  birth_date: string | null
}

export interface PublicProfile {
  id: string
  name: string
  avatar_url: string | null
  total_points: number
  program_id: string | null
  ranking_opt_out: boolean
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
  program_id: string | null
  diagnostic_profile: DiagnosticProfile | null
  category_id: string | null
  skill_category_id: string | null
  objetivo_geral: string | null
  publico_alvo: string | null
  pre_requisitos: string | null
  carga_horaria_total: number | null
  certificate_enabled: boolean
  cover_url: string | null
  thumbnail_url: string | null
  certificate_template_id: string | null
  conteudo_programatico: string | null
  certificate_syllabus_same_page: boolean
  published: boolean
  is_catalog: boolean
  sequential: boolean
  banner_enabled: boolean
  banner_start_at: string | null
  banner_end_at: string | null
}

export interface TrackPill {
  id: string
  track_id: string
  pill_id: string
  order_index: number
}

export interface ScormLibraryItem {
  id: string
  name: string
  package_url: string
  manifest_path: string
  created_at: string
  updated_at: string
}

export interface CertificateTemplate {
  id: string
  name: string
  background_url: string | null
  message: string | null
  created_at: string
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
  scorm_library_id: string | null
  cover_url: string | null
  thumbnail_url: string | null
  points_override: number | null
  category_id: string | null
  reaction_survey_id: string | null
  allow_manual_completion: boolean | null
  required: boolean
  access_count: number
  created_at: string
}

export interface Category {
  id: string
  name: string
  order_index: number
}

export interface PillFavorite {
  id: string
  user_id: string
  pill_id: string
  created_at: string
}

export interface DashboardSection {
  key: string
  label: string
  order_index: number
  enabled: boolean
}

export interface AppSetting {
  key: string
  value: unknown
}

export interface TrialSettings {
  enabled: boolean
  days: number
}

export interface BrandingSettings {
  platformName: string | null
  logoUrl: string | null
  secondaryLogoUrl: string | null
  primaryColor: string | null
  accentColor: string | null
  loginBackgroundImageUrl: string | null
  loginOverlayOpacity: number
}

export interface SignupSettings {
  open: boolean
  closedMessage: string
  requireTermsAcceptance: boolean
  activationMethod: 'magic_link' | 'default_password'
}

export interface ModuleCompletionSettings {
  allowManualCompletionDefault: boolean
}

export interface CommunitySettings {
  requireModeration: boolean
  allowRankingOptOut: boolean
}

export interface SessionSettings {
  inactivityTimeoutMinutes: number | null
}

export interface LegalSettings {
  termsUrl: string | null
  privacyUrl: string | null
  termsVersion: string
}

export interface SecuritySettings {
  magicLinkResetEnabled: boolean
  birthDateResetEnabled: boolean
}

export interface MaintenanceSettings {
  enabled: boolean
  message: string
}

export interface IssuedCertificate {
  id: string
  code: string
  user_id: string
  track_id: string
  student_name: string
  track_title: string
  completed_at: string | null
  issued_at: string
}

export interface PublicCertificate {
  id: string
  code: string
  student_name: string
  track_title: string
  completed_at: string | null
  issued_at: string
}

export interface UserProgress {
  id: string
  user_id: string
  pill_id: string
  status: PillStatus
  quiz_score: number | null
  completed_at: string | null
  scorm_location: string | null
  scorm_suspend_data: string | null
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
  question_type: QuestionType
  options: string[]
  correct_option_index: number | null
  correct_option_indexes: number[] | null
  order_index: number
}

export interface ReactionSurvey {
  id: string
  name: string
}

export interface ReactionQuestion {
  id: string
  survey_id: string
  question_text: string
  question_type: ReactionQuestionType
  order_index: number
  group_name: string | null
}

export interface ReactionResponse {
  id: string
  survey_id: string
  pill_id: string
  user_id: string
  submitted_at: string
}

export interface ReactionAnswer {
  id: string
  response_id: string
  question_id: string
  value_number: number | null
  value_text: string | null
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
  tier: PdiTier | null
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
  jornada_bucket: PdiJornadaBucket | null
}

export interface SocialPost {
  id: string
  author_id: string
  author_name: string
  author_program_id: string | null
  scope: SocialScope
  program_id: string | null
  post_type: SocialPostType
  body: string | null
  published: boolean
  poll_closed: boolean
  vimeo_id: string | null
  created_at: string
}

export interface SocialPollOption {
  id: string
  post_id: string
  label: string
  order_index: number
}

export interface SocialPollVote {
  id: string
  post_id: string
  option_id: string
  user_id: string
  created_at: string
}

export interface SocialPostMedia {
  id: string
  post_id: string
  url: string
  order_index: number
}

export interface SocialLike {
  id: string
  post_id: string
  user_id: string
  user_name: string
  created_at: string
}

export interface SocialComment {
  id: string
  post_id: string
  author_id: string
  author_name: string
  body: string
  created_at: string
}

export interface SocialReport {
  id: string
  post_id: string
  reporter_id: string
  reason: string
  created_at: string
}

export interface SocialStory {
  id: string
  author_id: string
  author_name: string
  author_program_id: string | null
  media_type: SocialStoryMediaType
  image_url: string | null
  vimeo_id: string | null
  created_at: string
  expires_at: string
}

export interface SocialStoryView {
  id: string
  story_id: string
  viewer_id: string
  viewer_name: string
  viewed_at: string
}

export interface SocialStoryReaction {
  id: string
  story_id: string
  user_id: string
  user_name: string
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string | null
  link: string | null
  read: boolean
  created_at: string
}

export interface GamificationRule {
  key: string
  label: string
  points: number
  enabled: boolean
  recurrence_days: number | null
  streak_days: number | null
  updated_at: string
}

export interface GamificationLevel {
  id: string
  name: string
  min_points: number
  badge_icon: string
}

export interface UserPointsEvent {
  id: string
  user_id: string
  rule_key: string
  ref_id: string
  points: number
  created_at: string
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
      categories: { Row: Category; Insert: Partial<Category>; Update: Partial<Category> }
      pill_favorites: { Row: PillFavorite; Insert: Partial<PillFavorite>; Update: Partial<PillFavorite> }
      dashboard_sections: { Row: DashboardSection; Insert: Partial<DashboardSection>; Update: Partial<DashboardSection> }
      app_settings: { Row: AppSetting; Insert: Partial<AppSetting>; Update: Partial<AppSetting> }
      issued_certificates: { Row: IssuedCertificate; Insert: Partial<IssuedCertificate>; Update: Partial<IssuedCertificate> }
      public_certificates: { Row: PublicCertificate; Insert: never; Update: never }
      user_progress: { Row: UserProgress; Insert: Partial<UserProgress>; Update: Partial<UserProgress> }
      quizzes: { Row: Quiz; Insert: Partial<Quiz>; Update: Partial<Quiz> }
      questions: { Row: QuizQuestion; Insert: Partial<QuizQuestion>; Update: Partial<QuizQuestion> }
      reaction_surveys: { Row: ReactionSurvey; Insert: Partial<ReactionSurvey>; Update: Partial<ReactionSurvey> }
      reaction_questions: { Row: ReactionQuestion; Insert: Partial<ReactionQuestion>; Update: Partial<ReactionQuestion> }
      reaction_responses: { Row: ReactionResponse; Insert: Partial<ReactionResponse>; Update: Partial<ReactionResponse> }
      reaction_answers: { Row: ReactionAnswer; Insert: Partial<ReactionAnswer>; Update: Partial<ReactionAnswer> }
      skill_ratings: { Row: SkillRating; Insert: Partial<SkillRating>; Update: Partial<SkillRating> }
      pdi_plans: { Row: PdiPlan; Insert: Partial<PdiPlan>; Update: Partial<PdiPlan> }
      pdi_plan_items: { Row: PdiPlanItem; Insert: Partial<PdiPlanItem>; Update: Partial<PdiPlanItem> }
      scorm_library: { Row: ScormLibraryItem; Insert: Partial<ScormLibraryItem>; Update: Partial<ScormLibraryItem> }
      track_pills: { Row: TrackPill; Insert: Partial<TrackPill>; Update: Partial<TrackPill> }
      social_posts: { Row: SocialPost; Insert: Partial<SocialPost>; Update: Partial<SocialPost> }
      social_post_media: { Row: SocialPostMedia; Insert: Partial<SocialPostMedia>; Update: Partial<SocialPostMedia> }
      social_likes: { Row: SocialLike; Insert: Partial<SocialLike>; Update: Partial<SocialLike> }
      social_comments: { Row: SocialComment; Insert: Partial<SocialComment>; Update: Partial<SocialComment> }
      social_reports: { Row: SocialReport; Insert: Partial<SocialReport>; Update: Partial<SocialReport> }
      social_poll_options: { Row: SocialPollOption; Insert: Partial<SocialPollOption>; Update: Partial<SocialPollOption> }
      social_poll_votes: { Row: SocialPollVote; Insert: Partial<SocialPollVote>; Update: Partial<SocialPollVote> }
      social_stories: { Row: SocialStory; Insert: Partial<SocialStory>; Update: Partial<SocialStory> }
      social_story_views: { Row: SocialStoryView; Insert: Partial<SocialStoryView>; Update: Partial<SocialStoryView> }
      social_story_reactions: { Row: SocialStoryReaction; Insert: Partial<SocialStoryReaction>; Update: Partial<SocialStoryReaction> }
      notifications: { Row: Notification; Insert: Partial<Notification>; Update: Partial<Notification> }
      gamification_rules: { Row: GamificationRule; Insert: Partial<GamificationRule>; Update: Partial<GamificationRule> }
      gamification_levels: { Row: GamificationLevel; Insert: Partial<GamificationLevel>; Update: Partial<GamificationLevel> }
      user_points_events: { Row: UserPointsEvent; Insert: Partial<UserPointsEvent>; Update: Partial<UserPointsEvent> }
      public_profiles: { Row: PublicProfile; Insert: never; Update: never }
    }
  }
}
