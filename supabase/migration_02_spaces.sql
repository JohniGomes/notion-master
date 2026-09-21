-- Migração 2: Espaços (menu lateral estilo Notion) + responsável por nome livre
-- Rode no SQL Editor do Supabase, depois de já ter rodado migration.sql

create table if not exists spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cover_url text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table clients add column if not exists space_id uuid references spaces(id);

-- Responsável por nome livre, para quando a pessoa ainda não tem conta na plataforma
-- (ex.: dados migrados da planilha original). Se assignee_id estiver preenchido, ele
-- tem prioridade na exibição; assignee_name é o fallback.
alter table tasks add column if not exists assignee_name text;

alter table spaces enable row level security;
drop policy if exists "authenticated full access" on spaces;
create policy "authenticated full access" on spaces for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop trigger if exists set_updated_at on spaces;
create trigger set_updated_at before update on spaces
  for each row execute procedure public.set_updated_at();

-- Cria o espaço "Gestão de Tarefas" se ainda não existir nenhum espaço,
-- e migra todos os clientes existentes (sem espaço) para ele.
insert into spaces (name, created_by)
select 'Gestão de Tarefas', (select id from profiles order by created_at limit 1)
where not exists (select 1 from spaces);

update clients
set space_id = (select id from spaces order by created_at limit 1)
where space_id is null;

alter table clients alter column space_id set not null;

create index if not exists clients_space_id_idx on clients (space_id);

-- Remove a observação de placeholder que a migração original deixou nas
-- etapas marcadas como "Não se aplica" na planilha.
update tasks
set observation = null
where observation = 'Etapa não se aplica a este caso (planilha original)';
