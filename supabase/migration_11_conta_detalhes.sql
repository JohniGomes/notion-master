-- Migracao 11: descricao e cliente/fornecedor de cada conta (lista de detalhes por mes no Financeiro)
-- Rode no SQL Editor do Supabase, depois de migration_10_conta_servicos.sql.

alter table shop9_contas add column if not exists descricao text;
alter table shop9_contas add column if not exists parceiro text;
