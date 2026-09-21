-- Migração 5: permite que qualquer membro autenticado edite o nome de qualquer colega
-- (antes só era possível editar o próprio nome). Mesma lógica de confiança já usada
-- em clients/tasks/spaces (equipe pequena e interna).
-- Rode no SQL Editor do Supabase, depois de já ter rodado migration_04_soft_delete.sql

drop policy if exists "update own profile" on profiles;
create policy "authenticated update profiles" on profiles for update
  using (auth.uid() is not null);
