import type { Shop9Conta } from "@/lib/supabase/types";
import type { PeopleTask, loadCommercialData } from "@/lib/data/shop9";

// Metricas que o assistente de IA pode consultar. Tudo e calculado aqui (no codigo) e
// devolvido ao modelo ja agregado, sem nome de cliente, fornecedor ou descricao de lancamento:
// a IA so narra os numeros, nao calcula nem recebe dados pessoais.

export type AiData = {
  contas: Shop9Conta[];
  commercial: Awaited<ReturnType<typeof loadCommercialData>>;
  tasks: PeopleTask[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const pct = (part: number, total: number) => (total > 0 ? r2((part / total) * 100) : 0);
const ym = (iso: string | null | undefined) => (iso ? iso.slice(0, 7) : "");
const key = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, "0")}`;

// Data de hoje no horario de Brasilia.
export function todayBR(): string {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function previousMonth(ano: number, mes: number) {
  return mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
}

function topN(map: Map<string, number>, n: number, total: number) {
  return Array.from(map.entries())
    .map(([nome, valor]) => ({ nome, valor: r2(valor), pct: pct(valor, total) }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, n);
}

// Fatias de um recebimento entre os servicos da venda (ou "Outros").
function slicesOf(c: Shop9Conta, valor: number): { nome: string; valor: number }[] {
  if (c.servicos && c.servicos.length > 0) return c.servicos.map((s) => ({ nome: s.n, valor: valor * s.f }));
  return [{ nome: "Outros (reembolsos, saldos)", valor }];
}

export function resumoMes(data: AiData, ano: number, mes: number) {
  const k = key(ano, mes);
  const today = todayBR();

  let despesaPaga = 0;
  let recebido = 0;
  let pagarAtraso = 0;
  let pagarAVencer = 0;
  let receberAtraso = 0;
  let receberAVencer = 0;
  const despPorConta = new Map<string, number>();
  const recPorServico = new Map<string, number>();

  for (const c of data.contas) {
    if (c.valor_quitado > 0 && ym(c.data_quitacao) === k) {
      if (c.pagar_receber === "P") {
        despesaPaga += c.valor_quitado;
        const conta = c.plano_codigo != null ? `${c.plano_codigo} - ${c.plano_nome ?? ""}` : "Sem conta";
        despPorConta.set(conta, (despPorConta.get(conta) ?? 0) + c.valor_quitado);
      } else {
        recebido += c.valor_quitado;
        for (const s of slicesOf(c, c.valor_quitado)) recPorServico.set(s.nome, (recPorServico.get(s.nome) ?? 0) + s.valor);
      }
    }
    if (c.valor_pendente > 0 && ym(c.data_vencimento) === k) {
      const late = (c.data_vencimento ?? "") < today;
      if (c.pagar_receber === "P") {
        if (late) pagarAtraso += c.valor_pendente;
        else pagarAVencer += c.valor_pendente;
      } else if (late) receberAtraso += c.valor_pendente;
      else receberAVencer += c.valor_pendente;
    }
  }

  const { os, itens, tipos } = data.commercial;
  const tipoNome = new Map(tipos.map((t) => [t.ordem, t.nome]));
  const osDoMes = os.filter((o) => ym(o.data_gravacao) === k);
  const por = (nome: string) => {
    const lista = osDoMes.filter((o) => tipoNome.get(o.tipo_ordem ?? -1) === nome);
    return { qtd: lista.length, valor: r2(lista.reduce((s, o) => s + o.valor_total, 0)) };
  };
  const orcadoValor = osDoMes.reduce((s, o) => s + o.valor_total, 0);
  const clientes = new Set(osDoMes.map((o) => o.cliente).filter(Boolean)).size;
  const movimentos = new Set(osDoMes.map((o) => o.ordem_movimento));
  const servicos = new Map<string, number>();
  for (const i of itens) {
    if (movimentos.has(i.ordem_movimento) && i.servico_nome) {
      servicos.set(i.servico_nome, (servicos.get(i.servico_nome) ?? 0) + i.preco_final);
    }
  }

  const margem = recebido - despesaPaga;
  return {
    periodo: k,
    financeiro: {
      despesa_paga: r2(despesaPaga),
      recebido: r2(recebido),
      margem: r2(margem),
      margem_pct_sobre_despesa_paga: pct(margem, despesaPaga),
      a_pagar_em_atraso: r2(pagarAtraso),
      a_pagar_a_vencer: r2(pagarAVencer),
      a_receber_em_atraso: r2(receberAtraso),
      a_receber_a_vencer: r2(receberAVencer),
      maiores_despesas_por_conta: topN(despPorConta, 8, despesaPaga),
      maiores_receitas_por_servico: topN(recPorServico, 8, recebido),
    },
    comercial: {
      orcado_total: { qtd: osDoMes.length, valor: r2(orcadoValor) },
      contratado: por("Contratado"),
      em_orcamento_aguardando_aprovacao: por("Orçamento"),
      nao_aprovado: por("Não Aprovado"),
      ticket_medio_por_cliente: clientes > 0 ? r2(orcadoValor / clientes) : 0,
      clientes_distintos: clientes,
      servicos_por_valor_orcado: topN(servicos, 8, orcadoValor),
    },
  };
}

const delta = (atual: number, anterior: number) => ({
  atual: r2(atual),
  anterior: r2(anterior),
  diferenca: r2(atual - anterior),
  variacao_pct: anterior !== 0 ? r2(((atual - anterior) / Math.abs(anterior)) * 100) : null,
});

export function compararMeses(data: AiData, ano: number, mes: number, mesesAnteriores: number) {
  const n = Math.min(Math.max(mesesAnteriores, 1), 11);
  const meses = [resumoMes(data, ano, mes)];
  let cursor = { ano, mes };
  for (let i = 0; i < n; i++) {
    cursor = previousMonth(cursor.ano, cursor.mes);
    meses.push(resumoMes(data, cursor.ano, cursor.mes));
  }
  const [atual, anterior] = meses;
  return {
    meses_do_mais_recente_para_o_mais_antigo: meses,
    variacao_mes_vs_mes_anterior: {
      despesa_paga: delta(atual.financeiro.despesa_paga, anterior.financeiro.despesa_paga),
      recebido: delta(atual.financeiro.recebido, anterior.financeiro.recebido),
      margem: delta(atual.financeiro.margem, anterior.financeiro.margem),
      orcado_total: delta(atual.comercial.orcado_total.valor, anterior.comercial.orcado_total.valor),
      contratado: delta(atual.comercial.contratado.valor, anterior.comercial.contratado.valor),
    },
  };
}

export function projecaoMesAtual(data: AiData) {
  const today = todayBR();
  const ano = Number(today.slice(0, 4));
  const mes = Number(today.slice(5, 7));
  const diaAtual = Number(today.slice(8, 10));
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const k = key(ano, mes);

  const atual = resumoMes(data, ano, mes);
  const f = atual.financeiro;
  // Pendentes do mes: tudo que vence no mes e ainda nao foi liquidado (atraso + a vencer).
  const pagarPendenteMes = f.a_pagar_em_atraso + f.a_pagar_a_vencer;
  const receberPendenteMes = f.a_receber_em_atraso + f.a_receber_a_vencer;

  const ritmoDespesa = (f.despesa_paga / diaAtual) * diasNoMes;
  const ritmoReceita = (f.recebido / diaAtual) * diasNoMes;

  const anterior = previousMonth(ano, mes);
  const m1 = resumoMes(data, anterior.ano, anterior.mes);
  const a2 = previousMonth(anterior.ano, anterior.mes);
  const m2 = resumoMes(data, a2.ano, a2.mes);
  const a3 = previousMonth(a2.ano, a2.mes);
  const m3 = resumoMes(data, a3.ano, a3.mes);
  const media = (sel: (m: ReturnType<typeof resumoMes>) => number) => r2((sel(m1) + sel(m2) + sel(m3)) / 3);

  return {
    periodo: k,
    hoje: today,
    dias_decorridos: diaAtual,
    dias_no_mes: diasNoMes,
    realizado_ate_hoje: {
      despesa_paga: f.despesa_paga,
      recebido: f.recebido,
      margem: f.margem,
    },
    pendente_do_mes: {
      a_pagar: r2(pagarPendenteMes),
      a_receber: r2(receberPendenteMes),
      a_pagar_em_atraso: f.a_pagar_em_atraso,
      a_receber_em_atraso: f.a_receber_em_atraso,
    },
    projecao_se_tudo_que_vence_no_mes_for_liquidado: {
      despesa: r2(f.despesa_paga + pagarPendenteMes),
      receita: r2(f.recebido + receberPendenteMes),
      margem: r2(f.recebido + receberPendenteMes - (f.despesa_paga + pagarPendenteMes)),
    },
    cenario_prudente: {
      despesa: r2(Math.max(f.despesa_paga + pagarPendenteMes, media((m) => m.financeiro.despesa_paga))),
      receita: r2(f.recebido + receberPendenteMes),
      margem: r2(
        f.recebido +
          receberPendenteMes -
          Math.max(f.despesa_paga + pagarPendenteMes, media((m) => m.financeiro.despesa_paga))
      ),
      observacao:
        "Despesas ainda nao lancadas no Shop9 nao aparecem como 'a pagar'; por isso a despesa prudente e a maior entre os vencimentos ja lancados e a media de despesa paga dos ultimos 3 meses.",
    },
    projecao_pelo_ritmo_dos_dias_decorridos: {
      despesa: r2(ritmoDespesa),
      receita: r2(ritmoReceita),
      margem: r2(ritmoReceita - ritmoDespesa),
    },
    referencia_meses_anteriores: {
      mes_anterior: {
        periodo: m1.periodo,
        despesa_paga: m1.financeiro.despesa_paga,
        recebido: m1.financeiro.recebido,
        margem: m1.financeiro.margem,
      },
      media_ultimos_3_meses: {
        despesa_paga: media((m) => m.financeiro.despesa_paga),
        recebido: media((m) => m.financeiro.recebido),
        margem: media((m) => m.financeiro.margem),
      },
    },
    comercial_do_mes_ate_hoje: atual.comercial,
    observacao:
      "Duas projecoes: (1) liquidando tudo que vence no mes (referencia principal; pode superestimar a receita se houver inadimplencia); (2) mantendo o ritmo medio diario ate agora (apenas referencia: distorce quando poucos dias passaram, pois despesas grandes como pro-labore e salarios sao pagas em datas fixas, em geral no fim do mes). Compare com o mes anterior e a media de 3 meses. Sao estimativas.",
  };
}

export function previsaoCaixa(data: AiData, dias: number) {
  const horizonte = Math.min(Math.max(dias, 30), 180);
  const today = todayBR();
  const faixas: { de: number; ate: number; nome: string }[] = [];
  for (let d = 0; d < horizonte; d += 30) faixas.push({ de: d, ate: Math.min(d + 29, horizonte - 1), nome: `dias ${d + 1} a ${Math.min(d + 30, horizonte)}` });

  const emAtraso = { entradas: 0, saidas: 0 };
  const buckets = faixas.map(() => ({ entradas: 0, saidas: 0 }));
  const alemDoHorizonte = { entradas: 0, saidas: 0 };

  for (const c of data.contas) {
    if (c.valor_pendente <= 0 || !c.data_vencimento) continue;
    const entrada = c.pagar_receber === "R";
    if (c.data_vencimento < today) {
      if (entrada) emAtraso.entradas += c.valor_pendente;
      else emAtraso.saidas += c.valor_pendente;
      continue;
    }
    const idx = faixas.findIndex(
      (f) => c.data_vencimento! >= addDays(today, f.de) && c.data_vencimento! <= addDays(today, f.ate)
    );
    if (idx === -1) {
      if (entrada) alemDoHorizonte.entradas += c.valor_pendente;
      else alemDoHorizonte.saidas += c.valor_pendente;
    } else if (entrada) buckets[idx].entradas += c.valor_pendente;
    else buckets[idx].saidas += c.valor_pendente;
  }

  let acumulado = 0;
  const periodos = faixas.map((f, i) => {
    const saldo = buckets[i].entradas - buckets[i].saidas;
    acumulado += saldo;
    return {
      periodo: f.nome,
      entradas_previstas: r2(buckets[i].entradas),
      saidas_previstas: r2(buckets[i].saidas),
      saldo_liquido: r2(saldo),
      saldo_liquido_acumulado: r2(acumulado),
    };
  });

  return {
    hoje: today,
    horizonte_dias: horizonte,
    em_atraso_ja_vencido: {
      a_receber: r2(emAtraso.entradas),
      a_pagar: r2(emAtraso.saidas),
    },
    periodos,
    total_no_horizonte: {
      entradas: r2(buckets.reduce((s, b) => s + b.entradas, 0)),
      saidas: r2(buckets.reduce((s, b) => s + b.saidas, 0)),
    },
    observacao:
      "Fluxo liquido previsto pelos vencimentos em aberto; nao considera saldo bancario inicial, despesas ainda nao lancadas nem inadimplencia. Valores em atraso estao separados e nao entram nos periodos.",
  };
}

export function servicosOrcadoVsRecebido(data: AiData, ano: number, mes?: number) {
  const noPeriodo = (iso: string | null | undefined) => {
    if (!iso) return false;
    if (iso.slice(0, 4) !== String(ano)) return false;
    return mes == null || Number(iso.slice(5, 7)) === mes;
  };
  const { os, itens, tipos } = data.commercial;
  const tipoNome = new Map(tipos.map((t) => [t.ordem, t.nome]));

  type Linha = { contratado: number; em_orcamento: number; nao_aprovado: number; recebido: number; a_receber: number };
  const vazio = (): Linha => ({ contratado: 0, em_orcamento: 0, nao_aprovado: 0, recebido: 0, a_receber: 0 });
  const porServico = new Map<string, Linha>();
  const linha = (nome: string) => {
    const cur = porServico.get(nome) ?? vazio();
    porServico.set(nome, cur);
    return cur;
  };

  const tipoDoMovimento = new Map<number, string>();
  for (const o of os) {
    if (noPeriodo(o.data_gravacao)) tipoDoMovimento.set(o.ordem_movimento, tipoNome.get(o.tipo_ordem ?? -1) ?? "");
  }
  for (const i of itens) {
    const tipo = tipoDoMovimento.get(i.ordem_movimento);
    if (tipo == null || !i.servico_nome) continue;
    const l = linha(i.servico_nome);
    if (tipo === "Contratado") l.contratado += i.preco_final;
    else if (tipo === "Orçamento") l.em_orcamento += i.preco_final;
    else if (tipo === "Não Aprovado") l.nao_aprovado += i.preco_final;
  }
  for (const c of data.contas) {
    if (c.pagar_receber !== "R") continue;
    if (c.valor_quitado > 0 && noPeriodo(c.data_quitacao)) {
      for (const s of slicesOf(c, c.valor_quitado)) linha(s.nome).recebido += s.valor;
    }
    if (c.valor_pendente > 0 && noPeriodo(c.data_vencimento)) {
      for (const s of slicesOf(c, c.valor_pendente)) linha(s.nome).a_receber += s.valor;
    }
  }

  const servicos = Array.from(porServico.entries())
    .map(([servico, l]) => ({
      servico,
      contratado: r2(l.contratado),
      em_orcamento: r2(l.em_orcamento),
      nao_aprovado: r2(l.nao_aprovado),
      recebido: r2(l.recebido),
      a_receber: r2(l.a_receber),
    }))
    .sort((a, b) => b.contratado + b.recebido - (a.contratado + a.recebido))
    .slice(0, 15);

  return {
    periodo: mes ? key(ano, mes) : String(ano),
    servicos_maiores_primeiro: servicos,
    observacao:
      "contratado/em_orcamento/nao_aprovado = valor dos servicos das O.S criadas no periodo; recebido = recebimentos quitados no periodo; a_receber = parcelas pendentes que vencem no periodo. Recebido pode vir de O.S de periodos anteriores.",
  };
}

export function equipeStatus(data: AiData) {
  const por = new Map<string, { concluidas: number; em_andamento: number; pendentes: number }>();
  for (const t of data.tasks) {
    const cur = por.get(t.responsavel) ?? { concluidas: 0, em_andamento: 0, pendentes: 0 };
    if (t.status === "done") cur.concluidas += 1;
    else if (t.status === "in_progress") cur.em_andamento += 1;
    else cur.pendentes += 1;
    por.set(t.responsavel, cur);
  }
  const total = { concluidas: 0, em_andamento: 0, pendentes: 0 };
  for (const v of por.values()) {
    total.concluidas += v.concluidas;
    total.em_andamento += v.em_andamento;
    total.pendentes += v.pendentes;
  }
  return {
    total_etapas: data.tasks.length,
    total,
    por_responsavel: Array.from(por.entries())
      .map(([responsavel, v]) => ({ responsavel, ...v, abertas: v.em_andamento + v.pendentes }))
      .sort((a, b) => b.abertas - a.abertas),
    observacao: "Etapas da Gestao de Tarefas (todas as O.S). 'Nao atribuido' sao etapas sem responsavel definido.",
  };
}
