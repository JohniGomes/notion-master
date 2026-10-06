-- Migracao 10: servicos de cada conta a receber (ranking de receitas por servico)
-- Rode no SQL Editor do Supabase, depois de migration_09_shop9_contas.sql.
-- Formato: [{"n": "Nome do servico", "f": 0.5}, ...]  (f = fracao do valor da conta)

alter table shop9_contas add column if not exists servicos jsonb;
