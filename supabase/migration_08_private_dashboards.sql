-- Migracao 8: espacos restritos a um e-mail + espaco "Painel Gerencial" (dashboards do Shop9)
-- Rode no SQL Editor do Supabase, depois de migration_07_shop9.sql.
-- A restricao e aplicada pelo banco (RLS), nao so pela tela.

alter table spaces add column if not exists restricted_to_email text;
alter table spaces add column if not exists kind text not null default 'tasks';

-- Espaco restrito so aparece (e so pode ser alterado) para o e-mail dono.
drop policy if exists "authenticated full access" on spaces;
drop policy if exists "spaces visible" on spaces;
create policy "spaces visible" on spaces for all
  using (
    auth.uid() is not null
    and (restricted_to_email is null or lower(restricted_to_email) = lower(auth.jwt() ->> 'email'))
  )
  with check (
    auth.uid() is not null
    and (restricted_to_email is null or lower(restricted_to_email) = lower(auth.jwt() ->> 'email'))
  );

-- Dados do Shop9 (valores financeiros): leitura so para o dono.
drop policy if exists "authenticated read shop9_situacoes" on shop9_situacoes;
drop policy if exists "authenticated read shop9_tipos_os" on shop9_tipos_os;
drop policy if exists "authenticated read shop9_os" on shop9_os;
drop policy if exists "authenticated read shop9_os_itens" on shop9_os_itens;

create policy "owner read shop9_situacoes" on shop9_situacoes for select
  using (lower(auth.jwt() ->> 'email') = 'jmichael@masterregularizacaoimobiliaria.com');
create policy "owner read shop9_tipos_os" on shop9_tipos_os for select
  using (lower(auth.jwt() ->> 'email') = 'jmichael@masterregularizacaoimobiliaria.com');
create policy "owner read shop9_os" on shop9_os for select
  using (lower(auth.jwt() ->> 'email') = 'jmichael@masterregularizacaoimobiliaria.com');
create policy "owner read shop9_os_itens" on shop9_os_itens for select
  using (lower(auth.jwt() ->> 'email') = 'jmichael@masterregularizacaoimobiliaria.com');

-- Cria o espaco (fica abaixo de "Gestao de Tarefas" pela ordem de criacao).
insert into spaces (name, kind, restricted_to_email, created_by)
select 'Painel Gerencial', 'dashboards', 'jmichael@masterregularizacaoimobiliaria.com', p.id
from profiles p
where lower(p.email) = 'jmichael@masterregularizacaoimobiliaria.com'
  and not exists (select 1 from spaces where kind = 'dashboards');
