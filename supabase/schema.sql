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
create type content_type as enum ('video', 'iframe', 'scorm');
create type pdi_plan_type as enum ('trilha_evento', 'plano_pessoal', 'plano_institucional');
create type pdi_item_type as enum ('skill_category', 'pill', 'trilha');
create type pdi_item_status as enum ('nao_iniciado', 'em_andamento', 'concluido');
-- Faixa de desempenho (spec: metodologia de PDI 70-20-10), recalculada no
-- client (src/lib/pdiTier.ts) sempre que o Balanço de Competências muda.
create type pdi_tier as enum ('abaixo', 'proximo', 'dentro', 'acima');
-- Classificação 70-20-10 de cada item do plano: prática real, mentoria ou
-- educação formal (spec: metodologia de PDI 70-20-10).
create type pdi_jornada_bucket as enum ('pratica', 'mentoria', 'formacao');

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
  program_id text not null references programs(id) on delete cascade,
  diagnostic_profile diagnostic_profile not null,
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
  is_catalog boolean not null default false
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
  thumbnail_url text
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
  selected_track_id uuid references tracks(id),
  role user_role not null default 'aluno',
  created_at timestamptz not null default now(),
  -- Flips to true once sync_profile_with_auth reconciles this row to a real
  -- auth.users id. Lets RLS distinguish "still an anonymous /estande lead"
  -- from "claimed account" without querying auth.users directly (anon has
  -- no SELECT grant there, and shouldn't).
  claimed boolean not null default false
);

create table user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on update cascade on delete cascade,
  pill_id uuid not null references pills(id) on delete cascade,
  status pill_status not null default 'not_started',
  quiz_score numeric,
  completed_at timestamptz,
  unique (user_id, pill_id)
);

create table quizzes (
  id uuid primary key default gen_random_uuid(),
  pill_id uuid not null references pills(id) on delete cascade,
  min_pass_score numeric not null default 70
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  question_text text not null,
  options jsonb not null,
  correct_option_index int not null
);

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

-- Grade curricular (imported via /admin/grade CSV, spec section 4)
create table curriculum_grid (
  id uuid primary key default gen_random_uuid(),
  program_id text not null,
  period text not null,
  course_name text not null
);

-- ============================================================
-- INDEXES
-- ============================================================
create index on skill_categories (program_id);
create index on tracks (program_id, diagnostic_profile);
create index on pills (track_id);
create index on track_pills (track_id);
create index on track_pills (pill_id);
create index on user_progress (user_id);
create index on questions (quiz_id);
create index on skill_ratings (user_id);
create index on pdi_plans (user_id);
create index on pdi_plan_items (plan_id);

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
alter table profiles enable row level security;
alter table user_progress enable row level security;
alter table quizzes enable row level security;
alter table questions enable row level security;
alter table skill_ratings enable row level security;
alter table pdi_plans enable row level security;
alter table pdi_plan_items enable row level security;
alter table curriculum_grid enable row level security;
alter table scorm_library enable row level security;
alter table track_pills enable row level security;

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
create policy "catalog readable by all" on quizzes for select using (true);
create policy "catalog readable by all" on questions for select using (true);
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
create policy "admin manages track_pills" on track_pills for all
  using (current_role_is('admin')) with check (current_role_is('admin'));
create policy "admin manages quizzes" on quizzes for all
  using (current_role_is('admin')) with check (current_role_is('admin'));
create policy "admin manages questions" on questions for all
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

-- One sample pill per seeded track (Admin cadastra o restante em /admin/trilhas).
insert into pills (track_id, title, axis, description, duration, content_type, content_url)
select
  t.id,
  'Boas-vindas à trilha',
  'Introdução',
  'Vídeo de boas-vindas e visão geral da trilha.',
  '5 min',
  'video',
  null
from tracks t;

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
