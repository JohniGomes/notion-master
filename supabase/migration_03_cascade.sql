-- Migração 3: ao excluir um espaço, os clientes (e etapas) dele devem ir junto.
-- Rode no SQL Editor do Supabase, depois de já ter rodado migration_02_spaces.sql

alter table clients drop constraint if exists clients_space_id_fkey;
alter table clients
  add constraint clients_space_id_fkey
  foreign key (space_id) references spaces(id) on delete cascade;
