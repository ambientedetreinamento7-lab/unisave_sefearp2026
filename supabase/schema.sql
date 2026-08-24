-- UniSave SEFEARP — PDI & Soft Skills
-- Supabase schema: tables, RLS policies, and seed data.
-- Run in the Supabase SQL editor (or via `supabase db push`).

create extension if not exists "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================
create type diagnostic_profile as enum ('autogestao', 'tech_ia', 'lideranca');
create type user_role as enum ('aluno', 'moderador', 'admin');
create type pill_status as enum ('not_started', 'in_progress', 'completed');
create type skill_type as enum ('tecnica', 'comportamental', 'etica');
create type content_type as enum ('video', 'iframe', 'scorm', 'reaction');
create type pdi_plan_type as enum ('trilha_evento', 'plano_pessoal', 'plano_institucional');
create type pdi_item_type as enum ('skill_category', 'pill', 'trilha');
create type pdi_item_status as enum ('nao_iniciado', 'em_andamento', 'concluido');
-- Faixa de desempenho (spec: metodologia de PDI 70-20-10), recalculada no
-- client (src/lib/pdiTier.ts) sempre que o Balanço de Competências muda.
create type pdi_tier as enum ('abaixo', 'proximo', 'dentro', 'acima');
-- Classificação 70-20-10 de cada item do plano: prática real, mentoria ou
-- educação formal (spec: metodologia de PDI 70-20-10).
create type pdi_jornada_bucket as enum ('pratica', 'mentoria', 'formacao');

-- Rede social interna (spec: rede social — Fase A). Escopo do post: mural
-- global do evento ou mural exclusivo do curso do autor.
create type social_scope as enum ('global', 'curso');
-- 'enquete' chegou na Fase B, 'video' na Fase C.
create type social_post_type as enum ('texto', 'imagem', 'carrossel', 'enquete', 'video');
-- Fase D — stories: foto ou vídeo (reaproveita o Vimeo), sempre em tabela
-- própria já que expiram em 24h e não têm curtida/comentário, só visualização.
create type social_story_media_type as enum ('imagem', 'video');

-- Central de notificações (sino no header). 'points' é a notificação de
-- "+N pontos" da gamificação, sempre separada da notificação específica
-- do gatilho (ex.: 'course_completed' já avisa a conclusão em si).
create type notification_type as enum ('reaction', 'course_completed', 'pdi_progress', 'points');

-- ============================================================
-- TABLES
-- ============================================================

-- id is a stable slug ('administracao', 'contabeis', 'economicas',
-- 'financas') matching src/lib/quiz.ts PROGRAMS, so the anonymous /estande
-- quiz (no session yet) can reference a program without a prior lookup.
create table programs (
  id text primary key,
  name text not null,
  mission text,
  framework_reference text,
  color_accent text
);

create table skill_categories (
  id uuid primary key default gen_random_uuid(),
  program_id text not null references programs(id) on delete cascade,
  name text not null,
  type skill_type not null
);

create table tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  icon text,
  primary_color text,
  -- Nulos até o curso passar pela etapa de vínculo a programa/perfil (spec:
  -- criação de curso não deve obrigar programa/perfil de cara — isso é
  -- preenchido depois, numa etapa separada). Enquanto nulo, o curso não
  -- entra em nenhum match de trilha recomendada nem de Biblioteca por
  -- perfil — só fica disponível pra quem o admin adicionar manualmente.
  program_id text references programs(id) on delete cascade,
  diagnostic_profile diagnostic_profile,
  -- Curso metadata (spec: página admin de cursos).
  objetivo_geral text,
  publico_alvo text,
  pre_requisitos text,
  carga_horaria_total numeric,
  -- Certificate is awarded once the student completes 100% of the track's
  -- pills — a fixed rule, this flag just turns eligibility on/off per curso.
  certificate_enabled boolean not null default false,
  -- Recommended: cover 1326x495px, thumbnail 895x495px (spec: capa/miniatura).
  cover_url text,
  thumbnail_url text,
  -- Certificate template (spec: página de criação de certificados).
  -- Recommended background size: 1400x895px.
  certificate_background_url text,
  certificate_message text,
  -- Unpublished tracks are hidden from every student-facing view (spec:
  -- publicar/despublicar cursos) but stay editable in the admin panel.
  published boolean not null default true,
  -- Marks the general course catalog ("Biblioteca de Cursos") so it's
  -- never picked up by the /estande recommendation match on
  -- (program_id, diagnostic_profile) — it only reaches a student's PDI if
  -- they add a course from it themselves (spec: biblioteca de cursos).
  is_catalog boolean not null default false,
  -- When true, a pill only unlocks once every earlier pill (by
  -- track_pills.order_index, within this pill's home track — pills.track_id)
  -- is completed (spec: módulos sequenciais ou não). Gating lives in
  -- CoursePlayer, not RLS — enforcing it in Postgres would need the
  -- whole ordered progress chain re-derived on every read.
  sequential boolean not null default false,
  -- Banner rotativo do Dashboard (spec: banner de cursos em destaque) —
  -- usa a mesma capa (cover_url) do curso. Início/fim opcionais: nulo de
  -- um lado = sem limite naquela ponta (ex.: sem fim = banner permanente
  -- até ser desativado manualmente).
  banner_enabled boolean not null default false,
  banner_start_at timestamptz,
  banner_end_at timestamptz
);

-- Many-to-many: which pills (cursos) belong to which trilhas. A pill keeps
-- a "home" track via pills.track_id (where it was created / lives in the
-- admin list), but a trilha's actual displayed content is whatever is
-- linked here — so the same curso can be reused across multiple trilhas
-- (spec: criar trilhas com cursos existentes).
create table track_pills (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id) on delete cascade,
  pill_id uuid not null references pills(id) on delete cascade,
  order_index int not null default 0,
  unique (track_id, pill_id)
);

-- Reusable SCORM packages, managed independently of any single pill (spec:
-- Biblioteca de Scorms). A pill's scorm_library_id points here instead of
-- carrying its own copy of the package URL, so re-uploading a package in
-- the library updates every pill that references it automatically.
create table scorm_library (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  package_url text not null,
  manifest_path text not null default 'index.html',
  created_at timestamptz not null default now()
);

-- Categorias de filtro do catálogo (spec: chips "Categorias" acima do
-- catálogo, editáveis pelo admin — ver /admin/trilhas).
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  order_index int not null default 0
);

-- Categoria do curso como um todo (spec: escolher categoria na criação do
-- curso) — filtra o catálogo igual à categoria por pílula já fazia, só que
-- no nível do curso; um curso "Curso com Módulos" some do card único do
-- Dashboard se filtrarmos só por pílula, então isso cobre esse caso.
alter table tracks add column category_id uuid references categories(id) on delete set null;
create index on tracks (category_id);

create table pills (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id) on delete cascade,
  title text not null,
  axis text,
  description text,
  duration text,
  badge_icon_url text,
  content_type content_type not null default 'video',
  content_url text,
  scorm_package_url text,
  scorm_manifest_path text,
  scorm_library_id uuid references scorm_library(id) on delete set null,
  -- Recommended: cover 1326x495px, thumbnail 895x495px (spec: capa/miniatura).
  cover_url text,
  thumbnail_url text,
  -- Gamificação: quando definido, substitui os pontos padrão da regra
  -- 'course_completed' (gamification_rules) especificamente pra essa
  -- pílula (spec: admin define pontos no próprio item).
  points_override int,
  -- Categoria de filtro do catálogo (spec: chips "Categorias" acima do
  -- catálogo) — separada de `axis` (que segue sendo o rótulo de
  -- "módulo" exibido no card e o agrupamento em Explorar Catálogo).
  category_id uuid references categories(id) on delete set null,
  -- Aparece na seção "Cursos obrigatórios" da Minha Trilha.
  required boolean not null default false,
  -- Por padrão a conclusão do módulo é automática e específica do
  -- conteúdo (vídeo: assistir até o fim sem pular à frente; scorm: pacote
  -- reporta 'completed'; último módulo com quiz: nota de aprovação). Só
  -- quando o admin liga esse campo é que aparece o botão manual
  -- "Concluir Módulo" como atalho — usado, por ex., em iframes genéricos
  -- (não vídeo) onde não há como rastrear o progresso automaticamente.
  allow_manual_completion boolean not null default false,
  -- Quantos alunos distintos já iniciaram essa pílula — incrementado em
  -- markPillInProgress só na primeira vez de cada aluno, alimenta a
  -- seção "Mais acessados".
  access_count int not null default 0,
  created_at timestamptz not null default now()
);

-- id starts decoupled from auth.users: the /estande capture step writes a
-- profile row (with a fresh uuid) before the visitor ever clicks their
-- magic link, i.e. before an auth.users row exists for them. The
-- sync_profile_with_auth trigger below reconciles id -> auth user id (via
-- matching email) the moment the auth user is created, cascading through
-- every FK below so no orphaned progress/plan rows are left behind.
create table profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  phone_whatsapp text,
  program_id text references programs(id),
  curriculum_period text,
  diagnostic_profile diagnostic_profile,
  -- on delete set null: excluir a trilha não deve ficar travado só
  -- porque um aluno tem ela como "recomendada" — o ponteiro vira null e
  -- a Trilha recomendada some do Dashboard dele, sem bloquear o admin.
  selected_track_id uuid references tracks(id) on delete set null,
  role user_role not null default 'aluno',
  created_at timestamptz not null default now(),
  -- Flips to true once sync_profile_with_auth reconciles this row to a real
  -- auth.users id. Lets RLS distinguish "still an anonymous /estande lead"
  -- from "claimed account" without querying auth.users directly (anon has
  -- no SELECT grant there, and shouldn't).
  claimed boolean not null default false,
  -- Flips to true once the aluno sets a password (spec: definir senha na
  -- primeira vez) — RouteGuard sends role='aluno' profiles with this still
  -- false to /definir-senha before letting them into the rest of the app,
  -- so magic link only has to be requested once per student.
  password_set boolean not null default false,
  -- Foto de perfil (spec: Meu Perfil) — sobe pro bucket 'social' já
  -- existente, na própria pasta do usuário.
  avatar_url text,
  -- Gamificação: total acumulado, denormalizado (mesmo padrão de
  -- progress_pct em pdi_plans) pra ranking barato — sem isso, a tela de
  -- ranking teria que somar o ledger inteiro de todo mundo toda vez.
  total_points int not null default 0,
  -- Sequência de dias seguidos de acesso e a última data resgatada — só
  -- usados pelo cálculo do bônus de streak (claimDailyAccess).
  access_streak int not null default 0,
  last_access_date date,
  -- Marca se o aluno já viu (concluiu OU pulou) cada tutorial guiado, pra
  -- não reabrir sozinho de novo — mas continua acessível manualmente pelo
  -- menu do avatar / topo do Meu PDI (spec: tour guiado no primeiro
  -- acesso). Pontuação em si vem de gamification_rules via
  -- user_points_events (idempotente por rule_key), não depende desta flag.
  nav_tutorial_seen boolean not null default false,
  pdi_tutorial_seen boolean not null default false
);

create table user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on update cascade on delete cascade,
  pill_id uuid not null references pills(id) on delete cascade,
  status pill_status not null default 'not_started',
  quiz_score numeric,
  completed_at timestamptz,
  -- Bookmark do player SCORM (cmi.core.lesson_location / cmi.suspend_data),
  -- gravado a cada LMSCommit — é o que permite retomar exatamente de onde
  -- parou em vez de reiniciar o pacote do zero a cada entrada no curso.
  scorm_location text,
  scorm_suspend_data text,
  unique (user_id, pill_id)
);

-- Favoritos do aluno (spec: "Meus favoritos" na Minha Trilha).
create table pill_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on update cascade on delete cascade,
  pill_id uuid not null references pills(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, pill_id)
);

create table quizzes (
  id uuid primary key default gen_random_uuid(),
  pill_id uuid not null references pills(id) on delete cascade,
  min_pass_score numeric not null default 70
);

-- Tipos de pergunta da "avaliação de conhecimento" (Kirkpatrick nível 2 —
-- aprendizagem): reconhecimento (única/múltipla escolha, verdadeiro ou
-- falso) e reflexão aberta (não pontuada, só registrada pro
-- moderador/admin ler — não entra no cálculo de score do quiz).
-- correct_option_index segue existindo pra single_choice/true_false
-- (compatibilidade com o que já estava salvo); correct_option_indexes
-- (plural, array) é só pra multiple_choice, onde mais de uma opção pode
-- estar certa.
create table questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  question_text text not null,
  question_type text not null default 'single_choice',
  options jsonb not null,
  correct_option_index int,
  correct_option_indexes int[],
  order_index int not null default 0
);

-- ---- Avaliação de Reação (Kirkpatrick nível 1) ----
-- Um modelo reutilizável de pesquisa de satisfação (spec: reestruturação
-- — uma avaliação de reação não pertence mais a uma única pílula, pode
-- ser reaproveitada em qualquer curso). Gerenciada centralmente em
-- Admin > Quizzes > Pesquisas de Reação; cada pílula do tipo 'reaction'
-- escolhe qual pesquisa usar via pills.reaction_survey_id (ver abaixo,
-- coluna adicionada depois porque referencia esta tabela).
create table reaction_surveys (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

-- likert5 (escala de concordância 1–5, o clássico "smile sheet" de
-- reação), nps (0–10, "recomendaria este curso?") e open_text (comentário
-- livre) — os três formatos mais usados em pesquisas de reação de
-- treinamento corporativo.
create table reaction_questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references reaction_surveys(id) on delete cascade,
  question_text text not null,
  question_type text not null default 'likert5',
  order_index int not null default 0,
  -- Agrupamento opcional por tema (spec: reorganizar/agrupar perguntas
  -- por tema, ex.: "Conteúdo e Qualidade", "Experiência de Aprendizado").
  -- Denormalizado de propósito (texto livre, não uma tabela separada de
  -- grupos): perguntas consecutivas (por order_index) com o mesmo
  -- group_name viram um bloco visual com essa cabeçalho; renomear um
  -- grupo é um update em massa de todas as linhas com esse group_name.
  -- Nulo = pergunta avulsa, fora de qualquer grupo (agrupar não é
  -- obrigatório).
  group_name text
);

create table reaction_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references reaction_surveys(id) on delete cascade,
  -- Qual pílula (curso/módulo) o aluno estava respondendo — necessário
  -- pra relatório, já que a mesma pesquisa pode estar em vários cursos
  -- (spec: coluna que identifique de qual curso a resposta é). Também é
  -- o que faz a mesma pesquisa poder ser respondida de novo em outro
  -- curso — a unicidade é por (pill_id, user_id), não (survey_id, user_id).
  pill_id uuid not null references pills(id) on delete cascade,
  user_id uuid not null references profiles(id) on update cascade on delete cascade,
  submitted_at timestamptz not null default now(),
  unique (pill_id, user_id)
);

create table reaction_answers (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references reaction_responses(id) on delete cascade,
  question_id uuid not null references reaction_questions(id) on delete cascade,
  value_number int,
  value_text text
);

-- Qual pesquisa de reação uma pílula 'reaction' usa (null até o admin
-- escolher uma) — precisa vir depois de reaction_surveys existir.
alter table pills add column reaction_survey_id uuid references reaction_surveys(id) on delete set null;
create index on pills (reaction_survey_id);

create table skill_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on update cascade on delete cascade,
  skill_category_id uuid not null references skill_categories(id) on delete cascade,
  self_rating numeric,
  moderator_rating numeric,
  rated_at timestamptz not null default now(),
  unique (user_id, skill_category_id)
);

create table pdi_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on update cascade on delete cascade,
  title text not null,
  type pdi_plan_type not null default 'plano_pessoal',
  endorsed boolean not null default false,
  progress_pct numeric not null default 0,
  created_at timestamptz not null default now(),
  -- Faixa de desempenho atual do plano (spec: metodologia de PDI 70-20-10).
  tier pdi_tier
);

create table pdi_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references pdi_plans(id) on delete cascade,
  item_type pdi_item_type not null,
  ref_id uuid not null,
  progress_current int not null default 0,
  progress_total int not null default 4,
  status pdi_item_status not null default 'nao_iniciado',
  order_index int not null default 0,
  -- Classificação 70-20-10 (spec: metodologia de PDI 70-20-10).
  jornada_bucket pdi_jornada_bucket
);

-- Rede social interna — Fase A (feed base: texto/imagem/carrossel, curtir,
-- comentar, duas abas, moderação) + Fase B (enquete). Vídeo (Vimeo) e
-- stories chegam em fases seguintes.
create table social_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on update cascade on delete cascade,
  -- Nome e curso do autor são gravados aqui no momento do post (não lidos
  -- via join em profiles) porque a RLS de profiles só deixa cada aluno ler
  -- o próprio perfil — sem isso o feed não conseguiria mostrar quem postou.
  author_name text not null,
  author_program_id text references programs(id),
  scope social_scope not null,
  -- Obrigatório quando scope='curso' (mural exclusivo daquele curso);
  -- null quando scope='global'.
  program_id text references programs(id),
  post_type social_post_type not null,
  body text,
  -- Moderação pós-publicação (spec: admin apaga ou despublica).
  published boolean not null default true,
  -- Enquete de escolha única, sem prazo automático — só o autor encerra
  -- (spec: proposta de enquete), via a função close_poll() abaixo.
  poll_closed boolean not null default false,
  -- ID numérico do vídeo no Vimeo (post_type='video'), ex.: "1234567890",
  -- extraído do "uri" retornado por api/vimeo-upload.ts. Embutido via
  -- player.vimeo.com/video/{vimeo_id} (spec: Fase C). Vídeo sobe como
  -- público (privacy.view='anybody'), então não precisa de hash extra
  -- na URL do embed.
  vimeo_id text,
  created_at timestamptz not null default now()
);

-- Imagens do post — uma linha pra post_type='imagem' (única), várias pra
-- 'carrossel', em order_index.
create table social_post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references social_posts(id) on delete cascade,
  url text not null,
  order_index int not null default 0
);

-- Opções e votos de enquete (post_type='enquete'). Um voto por aluno por
-- enquete, sem troca depois de votado (unique em social_poll_votes).
create table social_poll_options (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references social_posts(id) on delete cascade,
  label text not null,
  order_index int not null default 0
);

create table social_poll_votes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references social_posts(id) on delete cascade,
  option_id uuid not null references social_poll_options(id) on delete cascade,
  user_id uuid not null references profiles(id) on update cascade on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

-- user_name é snapshotado (mesmo motivo de author_name em social_posts):
-- a RLS de profiles não deixa ler o nome de outro aluno, e "quem curtiu"
-- precisa mostrar o nome de quem reagiu, não só o id.
create table social_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references social_posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on update cascade on delete cascade,
  user_name text not null,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

-- Fase D — stories. Expiram sozinhas em 24h via expires_at (sem job/cron:
-- a query do feed já filtra `expires_at > now()`); autor + admin podem
-- apagar antes disso se precisar.
create table social_stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on update cascade on delete cascade,
  author_name text not null,
  author_program_id text references programs(id),
  media_type social_story_media_type not null,
  image_url text,
  vimeo_id text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

-- Só visualização, sem curtida/comentário (spec: stories). author_name é
-- snapshotado aqui pelo mesmo motivo dos posts: a RLS de profiles não
-- deixa ler o nome de outro aluno, e o autor do story precisa ver quem
-- assistiu.
create table social_story_views (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references social_stories(id) on delete cascade,
  viewer_id uuid not null references profiles(id) on update cascade on delete cascade,
  viewer_name text not null,
  viewed_at timestamptz not null default now(),
  unique (story_id, viewer_id)
);

-- Reação simples (coração), um por espectador por story — mesmo padrão de
-- social_likes, mas em story_id em vez de post_id.
create table social_story_reactions (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references social_stories(id) on delete cascade,
  user_id uuid not null references profiles(id) on update cascade on delete cascade,
  user_name text not null,
  created_at timestamptz not null default now(),
  unique (story_id, user_id)
);

create table social_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references social_posts(id) on delete cascade,
  author_id uuid not null references profiles(id) on update cascade on delete cascade,
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

-- Fila de denúncias — só o admin lê (spec: botão de denunciar).
create table social_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references social_posts(id) on delete cascade,
  reporter_id uuid not null references profiles(id) on update cascade on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);

-- Grade curricular (imported via /admin/grade CSV, spec section 4)
create table curriculum_grid (
  id uuid primary key default gen_random_uuid(),
  program_id text not null,
  period text not null,
  course_name text not null
);

-- Central de notificações (sino no header). user_id é o destinatário —
-- pode ser inserida por outro usuário (ex.: quem reage a um post/story
-- notifica o autor), diferente das demais tabelas onde o autor sempre
-- insere em nome próprio (ver policies de insert abaixo).
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on update cascade on delete cascade,
  type notification_type not null,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Seções da aba "Minha Trilha" do Dashboard (Em andamento, Recentes,
-- Favoritos, Mais acessados, Obrigatórios, Recomendados) — chaves
-- fixas que o código já sabe montar, o admin só reordena/ativa-desativa
-- (mesmo padrão de gamification_rules abaixo).
create table dashboard_sections (
  key text primary key,
  label text not null,
  order_index int not null,
  enabled boolean not null default true
);

-- Configurações gerais da plataforma (chave/valor livre em jsonb) —
-- hoje só guarda o período de degustação (habilitado + dias), mas serve
-- pra qualquer config futura sem precisar de nova tabela/migration.
create table app_settings (
  key text primary key,
  value jsonb not null
);

-- Um registro por certificado emitido (aluno + curso), com um código
-- curto e único gerado na primeira emissão — é o que sustenta a página
-- pública de validação (/validar-certificado). Nome do aluno e título do
-- curso ficam congelados (snapshot) no momento da emissão, iguais ao
-- padrão já usado em social_posts.author_name: a validação pública não
-- pode depender de RLS de profiles/tracks, e o registro deve continuar
-- correto mesmo que o aluno mude de nome ou o curso seja renomeado depois.
create table issued_certificates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  user_id uuid not null references profiles(id) on update cascade on delete cascade,
  track_id uuid not null references tracks(id) on delete cascade,
  student_name text not null,
  track_title text not null,
  completed_at timestamptz,
  issued_at timestamptz not null default now(),
  unique (user_id, track_id)
);

-- ============================================================
-- GAMIFICAÇÃO
-- ============================================================

-- Regras de pontuação — uma linha por tipo de ação, com chaves fixas que
-- o código já sabe disparar (ver src/lib/gamification.ts). Não é um CRUD
-- de chave livre: o admin só edita label/points/enabled/recurrence_days,
-- criar uma chave nova sempre exige um gatilho novo no código.
create table gamification_rules (
  key text primary key,
  label text not null,
  points int not null default 0,
  enabled boolean not null default true,
  -- Só usado pela regra 'daily_access': intervalo em dias entre resgates
  -- do pop-up "Receber pontos" (spec: acesso diário ou recorrência definida).
  recurrence_days int,
  -- Só usado pela regra 'streak_bonus': a cada quantos dias seguidos de
  -- acesso o bônus se repete (spec: pontuação por acesso em dias seguidos).
  streak_days int,
  updated_at timestamptz not null default now()
);

-- Níveis — renomeáveis pelo admin, sempre ordenados por min_points (não
-- tem campo de ordem manual: a posição de cada nível é o próprio ponto
-- de corte, spec: "níveis se organizam conforme os pontos").
create table gamification_levels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  min_points int not null unique,
  badge_icon text not null
);

-- Ledger de pontos concedidos. ref_id desambigua o "primeiro" de cada
-- tipo (id da pílula, data do dia pro acesso, ou '' pra eventos sem
-- referência como troca de foto) — a unique constraint garante que
-- refazer um quiz ou reenviar a foto nunca pontua duas vezes, sem
-- precisar de lógica de "checar antes de inserir" no client.
create table user_points_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on update cascade on delete cascade,
  rule_key text not null references gamification_rules(key),
  ref_id text not null default '',
  points int not null,
  created_at timestamptz not null default now(),
  unique (user_id, rule_key, ref_id)
);

-- Perfil público — só os campos necessários pra ranking/visitar perfil de
-- outro aluno (nome, foto, pontos), sem vazar e-mail/whatsapp. Uma view
-- roda com as permissões do dono (não de quem consulta), então ela
-- contorna a RLS restritiva de profiles ("self read profile") — é
-- justamente por isso que ela existe, em vez de simplesmente abrir mais
-- uma policy de select em profiles (que exporia e-mail/whatsapp junto).
create view public_profiles as
  select id, name, avatar_url, total_points, program_id from profiles;
grant select on public_profiles to authenticated;

-- Validação pública de certificado (sem login): expõe só o necessário
-- pra conferir autenticidade por código, na mesma linha de raciocínio de
-- public_profiles — roda com as permissões do dono e contorna a RLS de
-- issued_certificates, que por padrão só deixa cada aluno ver os seus.
create view public_certificates as
  select id, code, student_name, track_title, completed_at, issued_at from issued_certificates;
grant select on public_certificates to anon, authenticated;

-- Config da plataforma (ex.: período de degustação) precisa ser lida
-- antes/sem sessão (aparece no header assim que o app carrega).
grant select on app_settings to anon, authenticated;

-- ============================================================
-- INDEXES
-- ============================================================
create index on skill_categories (program_id);
create index on tracks (program_id, diagnostic_profile);
create index on pills (track_id);
create index on pills (category_id);
create index on pill_favorites (user_id);
create index on issued_certificates (user_id);
create index on issued_certificates (code);
create index on track_pills (track_id);
create index on track_pills (pill_id);
create index on user_progress (user_id);
create index on questions (quiz_id);
create index on reaction_questions (survey_id);
create index on reaction_responses (survey_id);
create index on reaction_responses (pill_id);
create index on reaction_responses (user_id);
create index on reaction_answers (response_id);
create index on skill_ratings (user_id);
create index on pdi_plans (user_id);
create index on pdi_plan_items (plan_id);
create index on social_posts (scope, program_id, created_at);
create index on social_posts (author_id);
create index on social_post_media (post_id);
create index on social_likes (post_id);
create index on social_comments (post_id);
create index on social_reports (post_id);
create index on social_poll_options (post_id);
create index on social_poll_votes (post_id);
create index on social_stories (expires_at);
create index on social_stories (author_id);
create index on social_story_views (story_id);
create index on social_story_reactions (story_id);
create index on notifications (user_id, created_at desc);
create index on user_points_events (user_id);
create index on profiles (total_points desc);

-- ============================================================
-- AUTH RECONCILIATION
-- ============================================================
-- The /estande quiz creates a profiles row (own uuid) before the visitor's
-- magic link is confirmed. Once Supabase Auth creates the matching
-- auth.users row (same email), reassign the profile's id to the auth user
-- id so `auth.uid() = profiles.id` holds for all future RLS checks. The
-- `on update cascade` FKs above carry every progress/plan row along.
create or replace function sync_profile_with_auth()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  update profiles set id = new.id, claimed = true
  where email = new.email and id <> new.id;

  insert into profiles (id, name, email, role, claimed)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)), new.email, 'aluno', true)
  on conflict (id) do update set claimed = true;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function sync_profile_with_auth();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table programs enable row level security;
alter table skill_categories enable row level security;
alter table tracks enable row level security;
alter table pills enable row level security;
alter table categories enable row level security;
alter table pill_favorites enable row level security;
alter table dashboard_sections enable row level security;
alter table app_settings enable row level security;
alter table issued_certificates enable row level security;
alter table profiles enable row level security;
alter table user_progress enable row level security;
alter table quizzes enable row level security;
alter table questions enable row level security;
alter table reaction_surveys enable row level security;
alter table reaction_questions enable row level security;
alter table reaction_responses enable row level security;
alter table reaction_answers enable row level security;
alter table skill_ratings enable row level security;
alter table pdi_plans enable row level security;
alter table pdi_plan_items enable row level security;
alter table curriculum_grid enable row level security;
alter table scorm_library enable row level security;
alter table track_pills enable row level security;
alter table social_posts enable row level security;
alter table social_post_media enable row level security;
alter table social_likes enable row level security;
alter table social_comments enable row level security;
alter table social_reports enable row level security;
alter table social_poll_options enable row level security;
alter table social_poll_votes enable row level security;
alter table social_stories enable row level security;
alter table social_story_views enable row level security;
alter table social_story_reactions enable row level security;
alter table notifications enable row level security;
alter table gamification_rules enable row level security;
alter table gamification_levels enable row level security;
alter table user_points_events enable row level security;

-- SECURITY DEFINER so this bypasses profiles' own RLS instead of re-entering
-- it — without this, the SELECT below re-triggers policies that call
-- current_role_is() again (mutual recursion), which mostly stayed hidden
-- behind short-circuit evaluation but blew the stack (error 54001) under
-- the storage.objects write path. Safe to bypass RLS here: the WHERE clause
-- is pinned to auth.uid(), so it only ever reveals the caller's own role.
create or replace function current_role_is(role_name user_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = role_name
  );
$$;

-- Catalog content (programs, skills, tracks, pills, quizzes, questions,
-- curriculum grid) is readable by anyone — needed for the anonymous /estande
-- quiz to look up program/track ids before the user has a session.
create policy "catalog readable by all" on programs for select using (true);
create policy "catalog readable by all" on skill_categories for select using (true);
create policy "catalog readable by all" on tracks for select using (true);
create policy "catalog readable by all" on pills for select using (true);
create policy "catalog readable by all" on categories for select using (true);
create policy "catalog readable by all" on dashboard_sections for select using (true);
create policy "catalog readable by all" on quizzes for select using (true);
create policy "catalog readable by all" on questions for select using (true);
create policy "catalog readable by all" on reaction_surveys for select using (true);
create policy "catalog readable by all" on reaction_questions for select using (true);
create policy "catalog readable by all" on curriculum_grid for select using (true);
create policy "catalog readable by all" on scorm_library for select using (true);
create policy "catalog readable by all" on track_pills for select using (true);

create policy "admin manages catalog" on programs for all
  using (current_role_is('admin')) with check (current_role_is('admin'));
create policy "admin manages skills" on skill_categories for all
  using (current_role_is('admin')) with check (current_role_is('admin'));
create policy "admin manages tracks" on tracks for all
  using (current_role_is('admin')) with check (current_role_is('admin'));
create policy "admin manages scorm library" on scorm_library for all
  using (current_role_is('admin')) with check (current_role_is('admin'));
create policy "admin manages pills" on pills for all
  using (current_role_is('admin')) with check (current_role_is('admin'));
create policy "admin manages categories" on categories for all
  using (current_role_is('admin')) with check (current_role_is('admin'));
create policy "admin manages dashboard sections" on dashboard_sections for all
  using (current_role_is('admin')) with check (current_role_is('admin'));

create policy "app settings readable by all" on app_settings for select using (true);
create policy "admin manages app settings" on app_settings for all
  using (current_role_is('admin')) with check (current_role_is('admin'));

create policy "read own certificates" on issued_certificates for select
  using (user_id = auth.uid() or current_role_is('admin'));
create policy "issue own certificate" on issued_certificates for insert
  with check (user_id = auth.uid());
create policy "admin manages certificates" on issued_certificates for all
  using (current_role_is('admin')) with check (current_role_is('admin'));

create policy "read own favorites" on pill_favorites for select using (user_id = auth.uid());
create policy "add own favorites" on pill_favorites for insert with check (user_id = auth.uid());
create policy "remove own favorites" on pill_favorites for delete using (user_id = auth.uid());

-- Alunos não têm permissão de UPDATE em pills (só admin, ver "admin
-- manages pills" acima) — precisa de uma função elevada e estreita só
-- pra esse contador, mesmo padrão de close_poll() abaixo.
create or replace function public.increment_pill_access_count(p_pill_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update pills set access_count = access_count + 1 where id = p_pill_id;
end;
$$;

grant execute on function public.increment_pill_access_count(uuid) to authenticated;
create policy "admin manages track_pills" on track_pills for all
  using (current_role_is('admin')) with check (current_role_is('admin'));
create policy "admin manages quizzes" on quizzes for all
  using (current_role_is('admin')) with check (current_role_is('admin'));
create policy "admin manages questions" on questions for all
  using (current_role_is('admin')) with check (current_role_is('admin'));
create policy "admin manages reaction surveys" on reaction_surveys for all
  using (current_role_is('admin')) with check (current_role_is('admin'));
create policy "admin manages reaction questions" on reaction_questions for all
  using (current_role_is('admin')) with check (current_role_is('admin'));
create policy "admin manages grid" on curriculum_grid for all
  using (current_role_is('admin')) with check (current_role_is('admin'));

-- Profiles: public insert/update by email is needed for the anonymous
-- /estande capture step (upsert on email, before the magic-link session
-- exists); readable/updatable by the owner once logged in, and readable
-- by moderador/admin for cohort management.
create policy "anyone can create a profile at the stand" on profiles
  for insert with check (true);
create policy "self read profile" on profiles for select
  using (auth.uid() = id or current_role_is('moderador') or current_role_is('admin'));
create policy "self update profile" on profiles for update
  using (auth.uid() = id or current_role_is('admin'));

-- The /estande upsert (onConflict: 'email') issues INSERT ... ON CONFLICT DO
-- UPDATE even for a brand-new email, so Postgres evaluates the UPDATE policy
-- too — not just INSERT. Anon has no auth.uid() yet at that point, so allow
-- updates on leads not yet linked to a confirmed auth user, and pin role to
-- 'aluno' so this can't be used to self-promote to moderador/admin.
create policy "anon updates unclaimed leads" on profiles for update
  using (not claimed)
  with check (not claimed and role = 'aluno');

-- Postgres still requires the UPDATE policy's WITH CHECK to pass for an
-- INSERT ... ON CONFLICT DO UPDATE even when the row is brand new (no real
-- conflict), so the upsert above keeps failing with 42501 for first-time
-- emails despite the policy being correct. Route the /estande capture
-- through a SECURITY DEFINER function instead, so it runs with the
-- function owner's privileges and skips RLS entirely for this one
-- controlled, narrowly-scoped operation.
create or replace function public.capture_estande_lead(
  p_name text,
  p_email text,
  p_phone text,
  p_program_id text,
  p_curriculum_period text,
  p_diagnostic_profile diagnostic_profile,
  p_selected_track_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (
    name, email, phone_whatsapp, program_id, curriculum_period,
    diagnostic_profile, selected_track_id, role
  )
  values (
    p_name, p_email, p_phone, p_program_id, p_curriculum_period,
    p_diagnostic_profile, p_selected_track_id, 'aluno'
  )
  on conflict (email) do update set
    name = excluded.name,
    phone_whatsapp = excluded.phone_whatsapp,
    program_id = excluded.program_id,
    curriculum_period = excluded.curriculum_period,
    diagnostic_profile = excluded.diagnostic_profile,
    selected_track_id = excluded.selected_track_id
  where profiles.claimed = false;
end;
$$;

grant execute on function public.capture_estande_lead(
  text, text, text, text, text, diagnostic_profile, uuid
) to anon;

create policy "self manage progress" on user_progress for all
  using (auth.uid() = user_id or current_role_is('moderador') or current_role_is('admin'))
  with check (auth.uid() = user_id);

create policy "self manage reaction responses" on reaction_responses for all
  using (auth.uid() = user_id or current_role_is('moderador') or current_role_is('admin'))
  with check (auth.uid() = user_id);

create policy "self manage reaction answers" on reaction_answers for all
  using (
    exists (
      select 1 from reaction_responses r
      where r.id = reaction_answers.response_id
        and (r.user_id = auth.uid() or current_role_is('moderador') or current_role_is('admin'))
    )
  )
  with check (
    exists (select 1 from reaction_responses r where r.id = reaction_answers.response_id and r.user_id = auth.uid())
  );

create policy "self manage ratings" on skill_ratings for all
  using (auth.uid() = user_id or current_role_is('moderador') or current_role_is('admin'))
  with check (auth.uid() = user_id or current_role_is('moderador'));

create policy "self manage plans" on pdi_plans for all
  using (auth.uid() = user_id or current_role_is('moderador') or current_role_is('admin'))
  with check (auth.uid() = user_id or current_role_is('moderador'));

create policy "self manage plan items" on pdi_plan_items for all
  using (
    exists (select 1 from pdi_plans p where p.id = plan_id and (
      p.user_id = auth.uid() or current_role_is('moderador') or current_role_is('admin')
    ))
  )
  with check (
    exists (select 1 from pdi_plans p where p.id = plan_id and (
      p.user_id = auth.uid() or current_role_is('moderador') or current_role_is('admin')
    ))
  );

-- Rede social interna — Fase A. Pós-moderação: qualquer aluno autenticado
-- publica direto; só o admin apaga (delete) ou despublica (update published).
create policy "read visible posts" on social_posts for select
  using (published or author_id = auth.uid() or current_role_is('moderador') or current_role_is('admin'));
create policy "create own posts" on social_posts for insert
  with check (author_id = auth.uid());
create policy "admin moderates posts" on social_posts for update
  using (current_role_is('admin')) with check (current_role_is('admin'));
create policy "delete own posts or moderate" on social_posts for delete
  using (author_id = auth.uid() or current_role_is('admin'));

create policy "read media of visible posts" on social_post_media for select
  using (exists (
    select 1 from social_posts p where p.id = post_id
    and (p.published or p.author_id = auth.uid() or current_role_is('moderador') or current_role_is('admin'))
  ));
create policy "attach media to own posts" on social_post_media for insert
  with check (exists (select 1 from social_posts p where p.id = post_id and p.author_id = auth.uid()));

create policy "likes readable by all" on social_likes for select using (true);
create policy "like as self" on social_likes for insert with check (user_id = auth.uid());
create policy "unlike as self" on social_likes for delete using (user_id = auth.uid());

create policy "read comments of visible posts" on social_comments for select
  using (exists (
    select 1 from social_posts p where p.id = post_id
    and (p.published or p.author_id = auth.uid() or current_role_is('moderador') or current_role_is('admin'))
  ));
create policy "comment as self" on social_comments for insert with check (author_id = auth.uid());
create policy "delete own comment or moderate" on social_comments for delete
  using (author_id = auth.uid() or current_role_is('admin'));

create policy "report as self" on social_reports for insert with check (reporter_id = auth.uid());
create policy "admin reads reports" on social_reports for select
  using (current_role_is('moderador') or current_role_is('admin'));
create policy "admin manages reports" on social_reports for delete
  using (current_role_is('admin'));

-- Fase B — enquetes.
create policy "read poll options of visible posts" on social_poll_options for select
  using (exists (
    select 1 from social_posts p where p.id = post_id
    and (p.published or p.author_id = auth.uid() or current_role_is('moderador') or current_role_is('admin'))
  ));
create policy "attach options to own posts" on social_poll_options for insert
  with check (exists (select 1 from social_posts p where p.id = post_id and p.author_id = auth.uid()));

create policy "poll votes readable by all" on social_poll_votes for select using (true);
create policy "vote as self" on social_poll_votes for insert with check (user_id = auth.uid());

-- SECURITY DEFINER so the author can flip poll_closed without an UPDATE
-- policy on social_posts that would otherwise let them touch `published`
-- too (undermining admin moderation). Only closes — never reopens, never
-- touches any other column.
create or replace function public.close_poll(p_post_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update social_posts set poll_closed = true
  where id = p_post_id and author_id = auth.uid() and post_type = 'enquete';
end;
$$;

-- Fase D — stories.
create policy "read active or own stories" on social_stories for select
  using (expires_at > now() or author_id = auth.uid() or current_role_is('moderador') or current_role_is('admin'));
create policy "create own stories" on social_stories for insert
  with check (author_id = auth.uid());
create policy "delete own stories or moderate" on social_stories for delete
  using (author_id = auth.uid() or current_role_is('admin'));

-- Só o autor do story (pra saber quem assistiu) e o próprio espectador
-- (sua própria visualização) enxergam uma linha de social_story_views.
create policy "read views on own story or self" on social_story_views for select
  using (
    viewer_id = auth.uid()
    or exists (select 1 from social_stories s where s.id = story_id and s.author_id = auth.uid())
    or current_role_is('admin')
  );
create policy "record own view" on social_story_views for insert with check (viewer_id = auth.uid());

create policy "story reactions readable by all" on social_story_reactions for select using (true);
create policy "react to story as self" on social_story_reactions for insert with check (user_id = auth.uid());
create policy "unreact to story as self" on social_story_reactions for delete using (user_id = auth.uid());

-- Central de notificações. Duas policies de insert: uma pra notificação
-- que o próprio usuário gera pra si (conclusão de curso, progresso do
-- PDI) e outra, mais restrita por type, pra quando quem insere é outra
-- pessoa (reação em post/story notificando o autor) — mesmo modelo de
-- confiança client-side já usado pra author_name/viewer_name.
create policy "read own notifications" on notifications for select using (user_id = auth.uid());
create policy "insert own notifications" on notifications for insert with check (user_id = auth.uid());
create policy "insert reaction notifications for others" on notifications for insert
  with check (type = 'reaction' and user_id <> auth.uid());
create policy "update own notifications" on notifications for update using (user_id = auth.uid());
create policy "delete own notifications" on notifications for delete using (user_id = auth.uid());

-- Gamificação. Regras/níveis: leitura liberada pra todo autenticado (a
-- Dashboard e o perfil precisam calcular nível/pop-up de acesso pra
-- qualquer aluno), escrita só admin. Ledger de pontos: leitura só da
-- própria linha (ou admin, pra auditoria futura); inserção só em nome
-- próprio — mesmo modelo de confiança client-side já usado em notifications.
create policy "gamification rules readable by authenticated" on gamification_rules for select using (true);
create policy "gamification rules writable by admin" on gamification_rules for all
  using (current_role_is('admin')) with check (current_role_is('admin'));

create policy "gamification levels readable by authenticated" on gamification_levels for select using (true);
create policy "gamification levels writable by admin" on gamification_levels for all
  using (current_role_is('admin')) with check (current_role_is('admin'));

create policy "read own points events" on user_points_events for select
  using (user_id = auth.uid() or current_role_is('admin'));
create policy "insert own points events" on user_points_events for insert with check (user_id = auth.uid());

grant execute on function public.close_poll(uuid) to authenticated;

-- ============================================================
-- STORAGE — SCORM packages
-- ============================================================
-- Public bucket: extracted SCORM files (html/js/css/xml/media) are served
-- straight into the ScormPlayer iframe by public URL, one object per file
-- (the admin upload flow unzips client-side and uploads each entry — see
-- AdminTrilhas.tsx). Only admins may write; anyone may read.
insert into storage.buckets (id, name, public)
values ('scorm-packages', 'scorm-packages', true)
on conflict (id) do nothing;

create policy "public can read scorm packages" on storage.objects
  for select using (bucket_id = 'scorm-packages');

create policy "admin manages scorm packages" on storage.objects
  for all using (bucket_id = 'scorm-packages' and current_role_is('admin'))
  with check (bucket_id = 'scorm-packages' and current_role_is('admin'));

-- ============================================================
-- STORAGE — cover/thumbnail/certificate images
-- ============================================================
-- Plain images, so unlike scorm-packages this never touches the
-- text/html-downgrade issue — a normal public bucket is fine to read
-- straight from its public URL.
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

create policy "public can read covers" on storage.objects
  for select using (bucket_id = 'covers');

create policy "admin manages covers" on storage.objects
  for all using (bucket_id = 'covers' and current_role_is('admin'))
  with check (bucket_id = 'covers' and current_role_is('admin'));

-- ============================================================
-- STORAGE — rede social (imagens de post)
-- ============================================================
-- Unlike covers, any authenticated aluno can write here (not just admin) —
-- each object path is prefixed with the author's own id
-- (social/{user_id}/{filename}) so a student can only manage their own
-- uploads, mirroring the post ownership rule above.
insert into storage.buckets (id, name, public)
values ('social', 'social', true)
on conflict (id) do nothing;

create policy "public can read social media" on storage.objects
  for select using (bucket_id = 'social');

create policy "authors manage their own social uploads" on storage.objects
  for all using (bucket_id = 'social' and auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'social' and auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- SEED DATA — 4 programas reais (spec section 1 e 3)
-- ============================================================
insert into programs (id, name, mission, framework_reference, color_accent) values
  ('administracao', 'Administração', 'Formar gestores capazes de liderar com visão sistêmica e ética.', 'PPP Administração', '#1A3B6E'),
  ('contabeis', 'Ciências Contábeis', 'Formar profissionais rigorosos na leitura e governança de dados financeiros.', 'PPP Ciências Contábeis', '#1A3B6E'),
  ('economicas', 'Ciências Econômicas', 'Formar analistas capazes de interpretar cenários e tomar decisões orientadas a dados.', 'PPP Ciências Econômicas', '#1A3B6E'),
  ('financas', 'Finanças', 'Formar especialistas em análise, planejamento e gestão de recursos financeiros.', 'PPP Finanças', '#1A3B6E');

-- Example skill taxonomy per program (adjust with the real PPP taxonomy).
insert into skill_categories (program_id, name, type)
select id, 'Ética e Responsabilidade Socioambiental', 'etica'::skill_type from programs
union all
select id, 'Comunicação e Liderança', 'comportamental'::skill_type from programs
union all
select id, 'Análise de Dados e Tecnologia', 'tecnica'::skill_type from programs
union all
select id, 'Gestão do Tempo e Autogestão', 'comportamental'::skill_type from programs;

-- One example track per program x profile combination (Admin can add the
-- remaining ones later — not all 12 combinations need to exist).
insert into tracks (title, description, program_id, diagnostic_profile)
select
  p.name || ' — ' || case dp
    when 'autogestao' then 'Autogestão & Equilíbrio'
    when 'tech_ia' then 'Tech & IA'
    when 'lideranca' then 'Liderança & Mercado'
  end,
  'Trilha inicial gerada a partir do quiz PDI Express.',
  p.id,
  dp::diagnostic_profile
from programs p
cross join (values ('autogestao'), ('tech_ia'), ('lideranca')) as profiles_seed(dp);

-- ============================================================
-- SEED DATA — Biblioteca de cursos oficiais (spec item 1)
-- ============================================================
-- Cadastro em "casca" (título + eixo temático) dos 52 cursos oficiais,
-- sem conteúdo ainda — o admin preenche vídeo/SCORM depois em
-- /admin/trilhas. Ficam todos numa trilha catálogo dedicada para não
-- forçar um encaixe arbitrário em programa/perfil; o admin pode
-- reorganizar depois.
insert into tracks (title, description, program_id, diagnostic_profile, is_catalog)
values (
  'Biblioteca de Cursos',
  'Catálogo geral de cursos oficiais — organize por trilha específica conforme necessário.',
  'administracao',
  'autogestao',
  true
);

insert into pills (track_id, title, axis, description, duration, content_type, content_url)
select t.id, v.title, v.axis,
  'Pílula prática de ' || lower(v.title) || ' com aplicação imediata na sua rotina acadêmica e profissional.',
  '12 min', 'video', null
from (select id from tracks where title = 'Biblioteca de Cursos') t
cross join (values
  ('A arte de comunicar com assertividade', 'Comunicação'),
  ('Economia Compartilhada', 'Futuro do Trabalho'),
  ('Competências do Futuro', 'Futuro do Trabalho'),
  ('A mente mente', 'Mente & Emoções'),
  ('Dieta emocional: O funcionamento da mente', 'Mente & Emoções'),
  ('Diálogos consultivos', 'Comunicação'),
  ('Gestão de senhas seguras', 'Segurança Digital'),
  ('Líder Real - Como fazer diferente', 'Liderança'),
  ('Líder Real - A virada de chave', 'Liderança'),
  ('Liderando a Si mesmo 1 - Práticas de Autoconhecimento', 'Autoconhecimento'),
  ('Liderando a Si mesmo 2 - Arquétipos e Inteligência Emocional', 'Autoconhecimento'),
  ('Propósito de Vida: Encontre o seu porquê', 'Autoconhecimento'),
  ('A mente mente: O futuro infecta o presente', 'Mente & Emoções'),
  ('A mente mente: Transtornos que aprisionam', 'Mente & Emoções'),
  ('Ansiedade: como enfrentar o mal do século', 'Bem-estar'),
  ('Burnout: Como lidar com a síndrome do esgotamento profissional', 'Bem-estar'),
  ('Capacidade Analítica', 'Dados & Análise'),
  ('Como desenvolver a inteligência emocional', 'Inteligência Emocional'),
  ('Comunicação Não Violenta', 'Comunicação'),
  ('Comunicação para líderes em momentos sensíveis', 'Comunicação'),
  ('Conectando Gerações', 'Diversidade & Inclusão'),
  ('Confiança', 'Cultura & Times'),
  ('Desafios da primeira liderança', 'Liderança'),
  ('Diversidade e Inclusão', 'Diversidade & Inclusão'),
  ('Dominando o ChatGPT: A arte de criacao de prompt', 'IA Generativa'),
  ('Dominando o ChatGPT: Aprender', 'IA Generativa'),
  ('Dominando o ChatGPT: Criando seu projeto', 'IA Generativa'),
  ('Dominando o ChatGPT: Escrever (variáveis)', 'IA Generativa'),
  ('Dominando o ChatGPT: Introducao ao ChatGPT.', 'IA Generativa'),
  ('Dominando o ChatGPT: Pensar (Criterização)', 'IA Generativa'),
  ('Dominando o ChatGPT: Ter Ideias', 'IA Generativa'),
  ('Empatia', 'Cultura & Times'),
  ('Empresas inclusivas e viés do inconsciente', 'Diversidade & Inclusão'),
  ('Escrita assertiva: elimine conflitos na comunicação escrita', 'Comunicação'),
  ('Escuta Ativa', 'Comunicação'),
  ('Feedback', 'Comunicação'),
  ('Finanças Pessoais', 'Vida Financeira'),
  ('Foco & Concentração: Como lidar com a SPA', 'Produtividade'),
  ('Formação de multiplicadores de Treinamento', 'Liderança'),
  ('Gestão das emoções no trabalho', 'Inteligência Emocional'),
  ('Gestão do Tempo', 'Produtividade'),
  ('Introdução a Banco de Dados', 'Dados & Análise'),
  ('Lógica de Programação', 'Tecnologia'),
  ('Mude seu mindset', 'Autoconhecimento'),
  ('O Fim da Inteligência Emocional', 'Inteligência Emocional'),
  ('O poder do networking', 'Mercado & Carreira'),
  ('Oratória', 'Comunicação'),
  ('Organização e planejamento', 'Produtividade'),
  ('Pais brilhantes, profissionais fascinantes', 'Vida & Trabalho'),
  ('Perfis Comportamentais', 'Cultura & Times'),
  ('Protagonismo', 'Autoconhecimento'),
  ('Segurança psicológica', 'Cultura & Times')
) as v(title, axis);

-- Backfill: every pill starts linked to its own home track via track_pills
-- (the join table trilhas now read from), so nothing regresses for tracks
-- that don't reuse courses across trilhas.
insert into track_pills (track_id, pill_id, order_index)
select track_id, id, row_number() over (partition by track_id order by id) - 1
from pills
on conflict (track_id, pill_id) do nothing;

-- Relaciona os 52 cursos da Biblioteca com as trilhas curadas (uma por
-- programa × perfil de diagnóstico), pelo perfil que o quiz calcula a
-- partir das respostas do aluno sobre o que espera desenvolver — o
-- conteúdo é de desenvolvimento pessoal/profissional genérico, não
-- específico de cada programa, então a mesma classificação por perfil
-- vale pros 4 programas (spec: catálogo de cursos compõe o PDI).
insert into track_pills (track_id, pill_id, order_index)
select t.id, p.id, row_number() over (partition by t.id order by p.title) - 1
from (values
  ('A arte de comunicar com assertividade', 'lideranca'),
  ('Economia Compartilhada', 'lideranca'),
  ('Competências do Futuro', 'lideranca'),
  ('A mente mente', 'autogestao'),
  ('Dieta emocional: O funcionamento da mente', 'autogestao'),
  ('Diálogos consultivos', 'lideranca'),
  ('Gestão de senhas seguras', 'tech_ia'),
  ('Líder Real - Como fazer diferente', 'lideranca'),
  ('Líder Real - A virada de chave', 'lideranca'),
  ('Liderando a Si mesmo 1 - Práticas de Autoconhecimento', 'autogestao'),
  ('Liderando a Si mesmo 2 - Arquétipos e Inteligência Emocional', 'autogestao'),
  ('Propósito de Vida: Encontre o seu porquê', 'autogestao'),
  ('A mente mente: O futuro infecta o presente', 'autogestao'),
  ('A mente mente: Transtornos que aprisionam', 'autogestao'),
  ('Ansiedade: como enfrentar o mal do século', 'autogestao'),
  ('Burnout: Como lidar com a síndrome do esgotamento profissional', 'autogestao'),
  ('Capacidade Analítica', 'tech_ia'),
  ('Como desenvolver a inteligência emocional', 'autogestao'),
  ('Comunicação Não Violenta', 'autogestao'),
  ('Comunicação para líderes em momentos sensíveis', 'lideranca'),
  ('Conectando Gerações', 'lideranca'),
  ('Confiança', 'autogestao'),
  ('Desafios da primeira liderança', 'lideranca'),
  ('Diversidade e Inclusão', 'lideranca'),
  ('Dominando o ChatGPT: A arte de criacao de prompt', 'tech_ia'),
  ('Dominando o ChatGPT: Aprender', 'tech_ia'),
  ('Dominando o ChatGPT: Criando seu projeto', 'tech_ia'),
  ('Dominando o ChatGPT: Escrever (variáveis)', 'tech_ia'),
  ('Dominando o ChatGPT: Introducao ao ChatGPT.', 'tech_ia'),
  ('Dominando o ChatGPT: Pensar (Criterização)', 'tech_ia'),
  ('Dominando o ChatGPT: Ter Ideias', 'tech_ia'),
  ('Empatia', 'autogestao'),
  ('Empresas inclusivas e viés do inconsciente', 'lideranca'),
  ('Escrita assertiva: elimine conflitos na comunicação escrita', 'autogestao'),
  ('Escuta Ativa', 'autogestao'),
  ('Feedback', 'lideranca'),
  ('Finanças Pessoais', 'autogestao'),
  ('Foco & Concentração: Como lidar com a SPA', 'autogestao'),
  ('Formação de multiplicadores de Treinamento', 'lideranca'),
  ('Gestão das emoções no trabalho', 'autogestao'),
  ('Gestão do Tempo', 'autogestao'),
  ('Introdução a Banco de Dados', 'tech_ia'),
  ('Lógica de Programação', 'tech_ia'),
  ('Mude seu mindset', 'autogestao'),
  ('O Fim da Inteligência Emocional', 'autogestao'),
  ('O poder do networking', 'lideranca'),
  ('Oratória', 'lideranca'),
  ('Organização e planejamento', 'autogestao'),
  ('Pais brilhantes, profissionais fascinantes', 'autogestao'),
  ('Perfis Comportamentais', 'lideranca'),
  ('Protagonismo', 'autogestao'),
  ('Segurança psicológica', 'lideranca')
) as v(title, profile)
join pills p on p.title = v.title
join tracks src on src.title = 'Biblioteca de Cursos' and p.track_id = src.id
join tracks t on t.diagnostic_profile = v.profile::diagnostic_profile and t.is_catalog = false
on conflict (track_id, pill_id) do nothing;

-- Gamificação — regras seedadas (admin ajusta points/enabled/label em
-- /admin/gamificacao) e níveis de exemplo (renomeáveis).
insert into gamification_rules (key, label, points, recurrence_days, streak_days) values
  ('pill_started', 'Iniciar um curso/pílula', 2, null, null),
  ('course_completed', 'Conclusão de curso/pílula', 10, null, null),
  ('daily_access', 'Acesso recorrente', 2, 1, null),
  ('streak_bonus', 'Bônus por dias seguidos de acesso', 15, null, 7),
  ('certificate_earned', 'Certificado obtido', 20, null, null),
  ('avatar_changed', 'Alterou a foto de perfil', 5, null, null),
  ('first_post_texto', 'Primeira postagem de texto', 5, null, null),
  ('first_post_imagem', 'Primeira postagem de imagem', 5, null, null),
  ('first_post_carrossel', 'Primeira postagem em carrossel', 5, null, null),
  ('first_post_video', 'Primeira postagem de vídeo', 5, null, null),
  ('first_post_enquete', 'Primeira enquete criada', 5, null, null),
  ('first_story', 'Primeiro story publicado', 5, null, null),
  ('nav_tutorial', 'Concluiu o tutorial de navegação', 15, null, null),
  ('pdi_tutorial', 'Concluiu o tutorial do Meu PDI', 15, null, null)
on conflict (key) do nothing;

insert into gamification_levels (name, min_points, badge_icon) values
  ('Bronze', 0, '🥉'),
  ('Prata', 50, '🥈'),
  ('Ouro', 150, '🥇'),
  ('Platina', 300, '💎')
on conflict (min_points) do nothing;

-- Categorias de filtro do catálogo, consolidando os eixos dos 52 cursos
-- da Biblioteca num conjunto menor de chips (spec: catálogo de cursos).
insert into categories (name, order_index) values
  ('Finanças', 0),
  ('Liderança', 1),
  ('Performance e Produtividade', 2),
  ('Saúde e Bem-estar', 3),
  ('Comunicação', 4),
  ('Segurança da Informação', 5),
  ('Tecnologia', 6),
  ('Diversidade, Equidade e Inclusão', 7);

update pills p
set category_id = m.category_id
from (
  select axis_map.axis, c.id as category_id
  from (values
    ('Vida Financeira', 'Finanças'),
    ('Liderança', 'Liderança'),
    ('Produtividade', 'Performance e Produtividade'),
    ('Mente & Emoções', 'Saúde e Bem-estar'),
    ('Bem-estar', 'Saúde e Bem-estar'),
    ('Inteligência Emocional', 'Saúde e Bem-estar'),
    ('Autoconhecimento', 'Saúde e Bem-estar'),
    ('Vida & Trabalho', 'Saúde e Bem-estar'),
    ('Comunicação', 'Comunicação'),
    ('Segurança Digital', 'Segurança da Informação'),
    ('Tecnologia', 'Tecnologia'),
    ('IA Generativa', 'Tecnologia'),
    ('Dados & Análise', 'Tecnologia'),
    ('Diversidade & Inclusão', 'Diversidade, Equidade e Inclusão'),
    ('Cultura & Times', 'Diversidade, Equidade e Inclusão'),
    ('Mercado & Carreira', 'Diversidade, Equidade e Inclusão'),
    ('Futuro do Trabalho', 'Diversidade, Equidade e Inclusão')
  ) as axis_map(axis, category_name)
  join categories c on c.name = axis_map.category_name
) m
where p.axis = m.axis;

-- Seções da Minha Trilha — ordem inicial sugerida, o admin reordena/
-- ativa-desativa em /admin/trilhas.
insert into dashboard_sections (key, label, order_index, enabled) values
  ('em_andamento', 'Cursos em andamento', 0, true),
  ('recomendados', 'Cursos recomendados', 1, true),
  ('recentes', 'Adicionados recentemente', 2, true),
  ('favoritos', 'Meus favoritos', 3, true),
  ('mais_acessados', 'Mais acessados', 4, true),
  ('obrigatorios', 'Cursos obrigatórios', 5, true)
on conflict (key) do nothing;

-- Período de degustação — 14 dias, habilitado, editável em
-- /admin/configuracoes.
insert into app_settings (key, value) values
  ('trial', '{"enabled": true, "days": 14}'::jsonb)
on conflict (key) do nothing;
