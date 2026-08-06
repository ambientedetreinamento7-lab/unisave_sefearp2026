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
  diagnostic_profile diagnostic_profile not null
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
  scorm_manifest_path text
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
  created_at timestamptz not null default now()
);

create table pdi_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references pdi_plans(id) on delete cascade,
  item_type pdi_item_type not null,
  ref_id uuid not null,
  progress_current int not null default 0,
  progress_total int not null default 4,
  status pdi_item_status not null default 'nao_iniciado',
  order_index int not null default 0
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

create or replace function current_role_is(role_name user_role)
returns boolean language sql stable as $$
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

create policy "admin manages catalog" on programs for all
  using (current_role_is('admin')) with check (current_role_is('admin'));
create policy "admin manages skills" on skill_categories for all
  using (current_role_is('admin')) with check (current_role_is('admin'));
create policy "admin manages tracks" on tracks for all
  using (current_role_is('admin')) with check (current_role_is('admin'));
create policy "admin manages pills" on pills for all
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
