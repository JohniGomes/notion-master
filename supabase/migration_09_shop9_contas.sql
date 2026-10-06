-- Migracao 9: contas a pagar/receber do Shop9 (dashboard Financeiro)
-- Rode no SQL Editor do Supabase, depois de migration_08_private_dashboards.sql.
-- So parcelas reais (Tipo_Conta = 'R'), sem canceladas. Leitura restrita ao dono, como as demais shop9_*.

create table shop9_contas (
  ordem int primary key,
  pagar_receber text not null,          -- 'P' = despesa, 'R' = receita
  situacao text not null,               -- A = aberta, R = parcial, Q = quitada
  data_vencimento date,
  data_quitacao date,
  valor_total numeric(14,2) not null default 0,
  valor_quitado numeric(14,2) not null default 0,
  valor_pendente numeric(14,2) not null default 0,
  plano_codigo int,
  plano_nome text,
  synced_at timestamptz not null default now()
);
create index on shop9_contas (pagar_receber, data_quitacao);
create index on shop9_contas (pagar_receber, data_vencimento);

alter table shop9_contas enable row level security;
create policy "owner read shop9_contas" on shop9_contas for select
  using (lower(auth.jwt() ->> 'email') = 'jmichael@masterregularizacaoimobiliaria.com');
