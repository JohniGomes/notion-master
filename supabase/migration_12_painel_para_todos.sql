-- Migracao 12: libera o Painel Gerencial para todos os usuarios logados
-- Rode no SQL Editor do Supabase, depois de migration_11_conta_detalhes.sql.
-- Para voltar a restringir ao dono, rode migration_08 (policies "owner read ...") novamente.

-- Tabelas do Shop9: leitura para qualquer usuario autenticado (escrita continua so pelo script de importacao).
drop policy if exists "owner read shop9_situacoes" on shop9_situacoes;
drop policy if exists "owner read shop9_tipos_os" on shop9_tipos_os;
drop policy if exists "owner read shop9_os" on shop9_os;
drop policy if exists "owner read shop9_os_itens" on shop9_os_itens;
drop policy if exists "owner read shop9_contas" on shop9_contas;

create policy "authenticated read shop9_situacoes" on shop9_situacoes for select using (auth.uid() is not null);
create policy "authenticated read shop9_tipos_os" on shop9_tipos_os for select using (auth.uid() is not null);
create policy "authenticated read shop9_os" on shop9_os for select using (auth.uid() is not null);
create policy "authenticated read shop9_os_itens" on shop9_os_itens for select using (auth.uid() is not null);
create policy "authenticated read shop9_contas" on shop9_contas for select using (auth.uid() is not null);

-- Espaco visivel para todos e protegido contra exclusao (esconde o botao de excluir na barra lateral).
update spaces set restricted_to_email = null, is_default = true where kind = 'dashboards';
