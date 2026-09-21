-- Migração 4: exclusão reversível (soft delete) + proteção do espaço padrão
-- Rode no SQL Editor do Supabase, depois de já ter rodado migration_03_cascade.sql

alter table spaces add column if not exists deleted_at timestamptz;
alter table spaces add column if not exists is_default boolean not null default false;
alter table clients add column if not exists deleted_at timestamptz;
alter table tasks add column if not exists deleted_at timestamptz;

-- Marca o espaço mais antigo ("Gestão de Tarefas") como padrão/protegido contra exclusão.
update spaces set is_default = true
where id = (select id from spaces order by created_at limit 1)
and not exists (select 1 from spaces where is_default = true);

create index if not exists spaces_deleted_at_idx on spaces (deleted_at);
create index if not exists clients_deleted_at_idx on clients (deleted_at);
create index if not exists tasks_deleted_at_idx on tasks (deleted_at);
