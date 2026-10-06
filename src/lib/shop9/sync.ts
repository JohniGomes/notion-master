/**
 * Importa O.S do Shop9 (SQL Server, somente leitura) para o Supabase.
 * Rode com a VPN do escritorio ligada:  npm run sync-shop9
 *
 * Variaveis no .env.local: SHOP9_SQL_HOST, SHOP9_SQL_PORT, SHOP9_SQL_USER,
 * SHOP9_SQL_PASSWORD, SHOP9_SQL_DATABASE (padrao S9_Real).
 * Este script so executa SELECT no Shop9.
 */
import { resolve } from "node:path";
import dotenv from "dotenv";
import sql from "mssql";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: resolve(__dirname, "../../../.env.local") });

function need(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(`Falta ${key} no .env.local`);
    process.exit(1);
  }
  return value;
}

type Row = Record<string, unknown>;

// O Shop9 usa um cliente generico nos orcamentos; o nome real fica na descricao.
function resolveClient(cadastro: string | null, descricao: string | null): string {
  const generic = /^cliente or[cç]amento$/i.test((cadastro ?? "").trim());
  return ((generic ? descricao : cadastro) ?? cadastro ?? descricao ?? "").trim();
}

async function main() {
  const startedAt = new Date().toISOString();

  const supabase = createClient(need("NEXT_PUBLIC_SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const pool = await sql.connect({
    server: need("SHOP9_SQL_HOST"),
    port: Number(process.env.SHOP9_SQL_PORT ?? 2500),
    user: need("SHOP9_SQL_USER"),
    password: need("SHOP9_SQL_PASSWORD"),
    database: process.env.SHOP9_SQL_DATABASE ?? "S9_Real",
    options: { encrypt: true, trustServerCertificate: true },
    connectionTimeout: 20000,
    requestTimeout: 120000,
  });
  console.log("Conectado ao Shop9.");

  async function upsert(table: string, rows: Row[], onConflict: string) {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from(table).upsert(rows.slice(i, i + 500), { onConflict });
      if (error) throw new Error(`${table}: ${error.message}`);
    }
    console.log(`  ${table}: ${rows.length} linhas`);
  }

  // Tabelas de cadastro: lidas por posicao de coluna (Ordem, Nome, ...).
  const situacoesReq = pool.request();
  situacoesReq.arrayRowMode = true;
  const situacoes = (await situacoesReq.query("SELECT * FROM Configuracoes_Ordem_Servico_Situacoes"))
    .recordset as unknown as unknown[][];
  await upsert(
    "shop9_situacoes",
    situacoes.map((r) => ({ ordem: Number(r[0]), nome: String(r[1]), final: Boolean(r[2]) })),
    "ordem"
  );

  const tiposReq = pool.request();
  tiposReq.arrayRowMode = true;
  const tipos = (await tiposReq.query("SELECT * FROM Configuracoes_Ordem_Servico_Tipos"))
    .recordset as unknown as unknown[][];
  await upsert(
    "shop9_tipos_os",
    tipos.map((r) => ({ ordem: Number(r[0]), nome: String(r[1]) })),
    "ordem"
  );

  const itens = (
    await pool.request().query<Row>(`
      SELECT mps.Ordem AS ordem, mps.Ordem_Movimento AS ordem_movimento, mps.Numero_Linha AS numero_linha,
             ps.Codigo AS servico_codigo, ps.Nome AS servico_nome, mps.Preco_Final AS preco_final,
             mps.Servico_Concluido AS concluido, t.Nome AS tecnico, v.Nome AS vendedor
      FROM Movimento_Prod_Serv mps
      JOIN Prod_Serv ps ON ps.Ordem = mps.Ordem_Prod_Serv
      LEFT JOIN Funcionarios t ON t.Ordem = mps.Ordem_Tecnico1
      LEFT JOIN Funcionarios v ON v.Ordem = mps.Ordem_Vendedor
      WHERE ISNULL(mps.Linha_Excluida, 0) = 0
        AND mps.Ordem_Movimento IN (SELECT Ordem_Movimento FROM Movimento_Ordem_Servico)
    `)
  ).recordset;

  const totalByMovimento = new Map<number, number>();
  for (const item of itens) {
    const key = Number(item.ordem_movimento);
    totalByMovimento.set(key, (totalByMovimento.get(key) ?? 0) + Number(item.preco_final ?? 0));
  }

  const ordens = (
    await pool.request().query<Row>(`
      SELECT mos.Ordem AS ordem, mos.Numero AS numero, mos.Ordem_Movimento AS ordem_movimento,
             c.Nome AS cliente_cadastro, mos.Nome_Prod_Serv AS descricao,
             mos.Ordem_Tipo_OS AS tipo_ordem, mos.Ordem_Situacao_OS AS situacao_ordem,
             mos.Orcamento_Aprovado AS aprovado, mos.Fechada AS fechada, mos.Cancelada AS cancelada,
             mos.Data_Gravacao AS data_gravacao, mos.Orcamento_Prazo_Conclusao AS prazo
      FROM Movimento_Ordem_Servico mos
      JOIN Movimento m ON m.Ordem = mos.Ordem_Movimento
      LEFT JOIN Cli_For c ON c.Ordem = m.Ordem_Cli_For
      WHERE ISNULL(m.Apagado, 0) = 0
    `)
  ).recordset;

  // Contas: so parcelas reais (Tipo_Conta = 'R'); 'A' sao contas-pai e recebimentos duplicados.
  const contas = (
    await pool.request().query<Row>(`
      SELECT fc.Ordem AS ordem, fc.Pagar_Receber AS pagar_receber, fc.Situacao AS situacao,
             fc.Data_Vencimento AS data_vencimento, fc.Data_Quitacao AS data_quitacao,
             fc.Valor_Total AS valor_total, fc.Valor_Quitado AS valor_quitado,
             fc.Valor_Final_Calculado AS valor_pendente,
             p3.Codigo AS plano_codigo, p3.Nome AS plano_nome,
             fc.Descricao AS descricao, cf.Nome AS parceiro
      FROM Financeiro_Contas fc
      LEFT JOIN Plano_Contas3 p3 ON p3.Ordem = fc.Ordem_Plano_Contas3
      LEFT JOIN Cli_For cf ON cf.Ordem = fc.Ordem_Cli_For
      WHERE fc.Tipo_Conta = 'R' AND fc.Situacao <> 'C'
    `)
  ).recordset;

  // Servicos de cada recebimento: a parcela aponta para a conta-pai (Ordem_Pai), que e a
  // conta da venda (Movimento.Ordem_Financeiro); os itens da venda sao os servicos.
  const links = (
    await pool.request().query<Row>(`
      SELECT fc.Ordem AS conta, ps.Nome AS servico_nome, SUM(mps.Preco_Final) AS valor
      FROM Financeiro_Contas fc
      JOIN Movimento m ON m.Ordem_Financeiro = fc.Ordem_Pai
      JOIN Movimento_Prod_Serv mps ON mps.Ordem_Movimento = m.Ordem AND ISNULL(mps.Linha_Excluida, 0) = 0
      JOIN Prod_Serv ps ON ps.Ordem = mps.Ordem_Prod_Serv
      WHERE fc.Pagar_Receber = 'R' AND fc.Tipo_Conta = 'R' AND fc.Situacao <> 'C' AND fc.Ordem_Pai > 0
      GROUP BY fc.Ordem, ps.Nome
    `)
  ).recordset;

  await pool.close();

  const byConta = new Map<number, { n: string; valor: number }[]>();
  for (const l of links) {
    const list = byConta.get(Number(l.conta)) ?? [];
    list.push({ n: String(l.servico_nome).trim(), valor: Number(l.valor ?? 0) });
    byConta.set(Number(l.conta), list);
  }
  const servicosDaConta = (ordem: number) => {
    const list = byConta.get(ordem);
    if (!list || list.length === 0) return null;
    const total = list.reduce((s, i) => s + i.valor, 0);
    // Sem valores nos itens, divide por igual entre os servicos.
    return list.map((i) => ({ n: i.n, f: total > 0 ? i.valor / total : 1 / list.length }));
  };

  const toDay = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : null);
  await upsert(
    "shop9_contas",
    contas.map((c) => ({
      ordem: Number(c.ordem),
      pagar_receber: String(c.pagar_receber),
      situacao: String(c.situacao),
      data_vencimento: toDay(c.data_vencimento),
      data_quitacao: toDay(c.data_quitacao),
      valor_total: Number(c.valor_total ?? 0),
      valor_quitado: Number(c.valor_quitado ?? 0),
      valor_pendente: Number(c.valor_pendente ?? 0),
      plano_codigo: c.plano_codigo == null ? null : Number(c.plano_codigo),
      plano_nome: c.plano_nome == null ? null : String(c.plano_nome).trim(),
      servicos: String(c.pagar_receber) === "R" ? servicosDaConta(Number(c.ordem)) : null,
      descricao: c.descricao == null ? null : String(c.descricao).trim(),
      parceiro: c.parceiro == null ? null : String(c.parceiro).trim(),
      synced_at: startedAt,
    })),
    "ordem"
  );

  const validMovimentos = new Set(ordens.map((o) => Number(o.ordem_movimento)));
  const toIso = (d: unknown) => (d instanceof Date ? d.toISOString() : null);

  await upsert(
    "shop9_os",
    ordens.map((o) => ({
      ordem: Number(o.ordem),
      numero: o.numero == null ? null : Number(o.numero),
      ordem_movimento: Number(o.ordem_movimento),
      cliente: resolveClient(o.cliente_cadastro as string | null, o.descricao as string | null),
      cliente_cadastro: o.cliente_cadastro ?? null,
      descricao: o.descricao ?? null,
      tipo_ordem: o.tipo_ordem == null ? null : Number(o.tipo_ordem),
      situacao_ordem: o.situacao_ordem == null ? null : Number(o.situacao_ordem),
      aprovado: Boolean(o.aprovado),
      fechada: Boolean(o.fechada),
      cancelada: Boolean(o.cancelada),
      valor_total: totalByMovimento.get(Number(o.ordem_movimento)) ?? 0,
      data_gravacao: toIso(o.data_gravacao),
      prazo: toIso(o.prazo),
      synced_at: startedAt,
    })),
    "ordem"
  );

  await upsert(
    "shop9_os_itens",
    itens
      .filter((i) => validMovimentos.has(Number(i.ordem_movimento)))
      .map((i) => ({
        ordem: Number(i.ordem),
        ordem_movimento: Number(i.ordem_movimento),
        numero_linha: i.numero_linha == null ? null : Number(i.numero_linha),
        servico_codigo: i.servico_codigo == null ? null : Number(i.servico_codigo),
        servico_nome: i.servico_nome ?? null,
        preco_final: Number(i.preco_final ?? 0),
        concluido: Boolean(i.concluido),
        tecnico: i.tecnico ?? null,
        vendedor: i.vendedor ?? null,
        synced_at: startedAt,
      })),
    "ordem"
  );

  // Remove o que deixou de existir no Shop9 (apagado ou fora do filtro).
  for (const table of ["shop9_os", "shop9_os_itens", "shop9_contas"]) {
    const { error } = await supabase.from(table).delete().lt("synced_at", startedAt);
    if (error) throw new Error(`limpeza ${table}: ${error.message}`);
  }

  console.log("Importacao concluida.");
}

main().catch((err) => {
  console.error("Falha na importacao:", err instanceof Error ? err.message : err);
  process.exit(1);
});
