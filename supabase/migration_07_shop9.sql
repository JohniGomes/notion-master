-- Migracao 7: espelho dos dados do Shop9 (importacao mensal via scripts/sync-shop9.ts)
-- Rode no SQL Editor do Supabase. Escrita so pelo script (service_role); leitura para usuarios logados.

create table shop9_situacoes (
  ordem int primary key,
  nome text not null,
  final boolean not null default false
);

create table shop9_tipos_os (
  ordem int primary key,
  nome text not null
);

create table shop9_os (
  ordem int primary key,
  numero int,
  ordem_movimento int,
  cliente text,
  cliente_cadastro text,
  descricao text,
  tipo_ordem int,
  situacao_ordem int,
  aprovado boolean not null default false,
  fechada boolean not null default false,
  cancelada boolean not null default false,
  valor_total numeric(14,2) not null default 0,
  data_gravacao timestamptz,
  prazo timestamptz,
  synced_at timestamptz not null default now()
);
create index on shop9_os (numero);
create index on shop9_os (data_gravacao);

create table shop9_os_itens (
  ordem int primary key,
  ordem_movimento int not null,
  numero_linha int,
  servico_codigo int,
  servico_nome text,
  preco_final numeric(14,2) not null default 0,
  concluido boolean not null default false,
  tecnico text,
  vendedor text,
  synced_at timestamptz not null default now()
);
create index on shop9_os_itens (ordem_movimento);

alter table shop9_situacoes enable row level security;
alter table shop9_tipos_os enable row level security;
alter table shop9_os enable row level security;
alter table shop9_os_itens enable row level security;

create policy "authenticated read shop9_situacoes" on shop9_situacoes for select using (auth.uid() is not null);
create policy "authenticated read shop9_tipos_os" on shop9_tipos_os for select using (auth.uid() is not null);
create policy "authenticated read shop9_os" on shop9_os for select using (auth.uid() is not null);
create policy "authenticated read shop9_os_itens" on shop9_os_itens for select using (auth.uid() is not null);
