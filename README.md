# UniSave SEFEARP — PDI & Soft Skills

LXP para a feira SEFEARP (Modo Estande) e para a jornada pós-evento (Modo
Pós-Evento), construída com React + Vite + TypeScript + Tailwind v4 +
Supabase.

## Stack

- **Frontend:** React 19, React Router 7, Tailwind CSS v4
- **Backend:** Supabase (Postgres + Auth + Storage), Row Level Security
- **Gráficos:** Recharts (funil de analytics do Admin)
- **SCORM:** `scorm-again` (client-side, opcional — ver seção abaixo)

## Setup

```bash
npm install
cp .env.example .env   # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev
```

### Banco de dados

Rode `supabase/schema.sql` no SQL editor do seu projeto Supabase (ou
`supabase db push` se estiver usando a CLI). O script cria:

- Todas as tabelas do modelo de dados (seções 3, 9.4 e 10.1 do spec)
- Policies de RLS (catálogo público para leitura; dados pessoais
  restritos ao dono, moderador ou admin)
- Um trigger `sync_profile_with_auth` que reconcilia o `profiles.id`
  criado anonimamente no quiz do estande com o `auth.users.id` real assim
  que o aluno confirma o magic link (todas as FKs usam `on update
  cascade`, então progresso/planos migram automaticamente)
- Seed dos 4 programas reais, taxonomia de skills de exemplo, uma trilha
  por combinação programa × perfil, e uma pílula de boas-vindas por trilha

Para reproduzir pacotes SCORM, crie um bucket público `scorm-packages` no
Storage do projeto.

### Primeiro usuário Admin

Depois de logar pela primeira vez (crie o usuário direto no painel de
Authentication do Supabase e faça login em `/entrar` → aba
Moderador/Admin), rode:

```sql
update profiles set role = 'admin' where email = 'seu-email@exemplo.com';
```

## Estrutura de páginas

| Rota | Descrição |
| --- | --- |
| `/estande` | Quiz PDI Express (Q1–Q4) + captura + magic link |
| `/resultado` | Perfil calculado + recomendação de palestra + CTA |
| `/entrar` | Login (magic link para aluno, e-mail/senha para moderador/admin) |
| `/dashboard` | Painel do aluno — trilha recomendada + catálogo completo |
| `/curso/:id` | Player (vídeo, iframe ou SCORM) |
| `/curso/:id/quiz` | Quiz de fixação (≥70% libera badge) |
| `/conquistas` | Galeria de badges + relatório de PDI |
| `/meu-pdi` | Meu PDI / Balanço de Competências / Biblioteca de Trilhas |
| `/moderador` | Gaps de skill, fila de endosso, lista de alunos |
| `/admin/programas`, `/trilhas`, `/grade`, `/usuarios`, `/analytics` | Administração |

## SCORM

`src/components/ScormPlayer.tsx` usa `scorm-again` (já incluído nas
dependências) para simular a API SCORM no navegador.

O upload do `.zip` em `/admin/trilhas` hoje sobe o arquivo bruto para o
bucket `scorm-packages`. A extração do `.zip` para arquivos estáticos
(`scorm-packages/{pill_id}/...`) deve ser feita por uma Supabase Edge
Function (spec seção 10.3) — não incluída neste repositório.

## Fases de implementação (do spec)

1. **Fase 1 (crítica para a feira):** `/estande` + `/resultado` — pronto.
2. **Fase 2:** Dashboard, player, quiz de fixação, badges — pronto.
3. **Fase 3:** Relatório de PDI em PDF e certificados — botão de download
   está no lugar em `/conquistas`, mas a geração do PDF ainda não está
   implementada (não havia biblioteca de PDF especificada no spec).
4. **Fase 4:** Painéis de Moderador e Admin — pronto.
