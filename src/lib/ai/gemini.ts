import {
  compararMeses,
  equipeStatus,
  previsaoCaixa,
  projecaoMesAtual,
  resumoMes,
  servicosOrcadoVsRecebido,
  todayBR,
  type AiData,
} from "@/lib/ai/metrics";

export type ChatMessage = { role: "user" | "model"; text: string };

type Part = {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: unknown };
  [extra: string]: unknown;
};
type Content = { role: "user" | "model"; parts: Part[] };

const MES = {
  type: "integer",
  description: "Mes de 1 (janeiro) a 12 (dezembro).",
};
const ANO = { type: "integer", description: "Ano com 4 digitos, ex.: 2026." };

const TOOLS = [
  {
    name: "resumo_mes",
    description:
      "Resumo financeiro e comercial de um mes: despesa paga, recebido, margem, valores a pagar/receber (em atraso e a vencer), maiores despesas por conta, maiores receitas por servico, e o comercial (orcado, contratado, em orcamento, nao aprovado, ticket medio, servicos).",
    parameters: { type: "object", properties: { ano: ANO, mes: MES }, required: ["ano", "mes"] },
  },
  {
    name: "comparar_meses",
    description:
      "Compara um mes com os meses anteriores (resumo de cada um e variacao do mes contra o anterior). Use para 'como foi o mes X', tendencias e comparacoes.",
    parameters: {
      type: "object",
      properties: {
        ano: ANO,
        mes: MES,
        meses_anteriores: { type: "integer", description: "Quantos meses anteriores incluir (1 a 11). Padrao 2." },
      },
      required: ["ano", "mes"],
    },
  },
  {
    name: "projecao_mes_atual",
    description:
      "Projecao do mes corrente: realizado ate hoje, o que ainda vence no mes, duas projecoes (liquidando tudo que vence e mantendo o ritmo diario) e referencia do mes anterior e da media de 3 meses.",
  },
  {
    name: "previsao_caixa",
    description:
      "Previsao de fluxo de caixa liquido para os proximos dias (padrao 90), em faixas de 30 dias, com entradas e saidas previstas pelos vencimentos em aberto, e o valor ja em atraso separado.",
    parameters: {
      type: "object",
      properties: { dias: { type: "integer", description: "Horizonte em dias (30 a 180). Padrao 90." } },
    },
  },
  {
    name: "servicos_orcado_vs_recebido",
    description:
      "Cruza Comercial e Financeiro por servico: quanto foi contratado, orcado, nao aprovado, recebido e a receber, em um ano ou mes.",
    parameters: {
      type: "object",
      properties: { ano: ANO, mes: { ...MES, description: "Opcional. Se omitido, considera o ano inteiro." } },
      required: ["ano"],
    },
  },
  {
    name: "equipe_status",
    description: "Situacao das etapas da Gestao de Tarefas por responsavel (concluidas, em andamento, pendentes).",
  },
];

function runTool(data: AiData, name: string, args: Record<string, unknown>) {
  const today = todayBR();
  const int = (v: unknown, fallback: number) => (Number.isFinite(Number(v)) && v != null ? Math.trunc(Number(v)) : fallback);
  const ano = int(args.ano, Number(today.slice(0, 4)));
  const mes = int(args.mes, Number(today.slice(5, 7)));
  if (mes < 1 || mes > 12) return { erro: "Mes invalido (use 1 a 12)." };

  switch (name) {
    case "resumo_mes":
      return resumoMes(data, ano, mes);
    case "comparar_meses":
      return compararMeses(data, ano, mes, int(args.meses_anteriores, 2));
    case "projecao_mes_atual":
      return projecaoMesAtual(data);
    case "previsao_caixa":
      return previsaoCaixa(data, int(args.dias, 90));
    case "servicos_orcado_vs_recebido":
      return servicosOrcadoVsRecebido(data, ano, args.mes == null ? undefined : mes);
    case "equipe_status":
      return equipeStatus(data);
    default:
      return { erro: `Ferramenta desconhecida: ${name}` };
  }
}

function systemPrompt() {
  return `Voce e o analista financeiro e comercial da Master Regularizacao Imobiliaria, falando com o dono da empresa dentro do Painel Gerencial. Hoje e ${todayBR()} (horario de Brasilia).

REGRAS
- Responda sempre em portugues do Brasil, de forma objetiva e executiva. Valores em reais (R$ 1.234,56).
- NUNCA invente numeros. Para qualquer valor, use as ferramentas disponiveis e cite apenas o que elas retornarem. Se faltar dado, diga isso.
- Os dados chegam agregados; voce nao tem nomes de clientes nem de fornecedores. Se pedirem algo por cliente, explique que o assistente trabalha so com totais.
- Definicoes da empresa: "Despesa paga" = pagamentos quitados no mes; "Recebido" = recebimentos quitados no mes; "Margem" = recebido - despesa paga; a margem percentual e calculada sobre a despesa paga. "Em atraso" = vencido e nao pago. "Contratado" = O.S aprovadas; "Em orcamento" = aguardando aprovacao.
- Projecoes e previsoes sao estimativas: diga isso e explique a base do calculo. Na projecao do mes, apresente SEMPRE uma faixa: a projecao pelos vencimentos (referencia) e o cenario prudente (despesa nunca abaixo da media de 3 meses, pois despesas ainda nao lancadas nao aparecem como a pagar). Nao conclua que a margem vai melhorar sem mostrar o cenario prudente. Trate o ritmo diario com cautela (despesas grandes caem em datas fixas) e compare com o mes anterior e a media de 3 meses.
- Para "como foi o mes X", use comparar_meses e responda com estas secoes: Resumo (2 a 3 linhas), Pontos positivos, Pontos de atencao, Comparacao com os meses anteriores e, se for o mes atual, Projecao.
- Use listas curtas, destaque numeros-chave em **negrito** e tabelas simples quando comparar periodos. Sem emojis. Termine com uma recomendacao pratica quando fizer sentido.`;
}

const MAX_STEPS = 6;

async function callGemini(body: unknown) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY nao configurada.");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(50_000),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gemini ${res.status}: ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as {
    candidates?: { content?: { parts?: Part[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };
}

// Conversa com o Gemini, deixando-o chamar as ferramentas de metricas ate chegar na resposta.
export async function askAssistant(history: ChatMessage[], loadData: () => Promise<AiData>) {
  const contents: Content[] = history.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
  let data: AiData | null = null;
  const toolsUsed: string[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await callGemini({
      systemInstruction: { parts: [{ text: systemPrompt() }] },
      contents,
      tools: [{ functionDeclarations: TOOLS }],
      generationConfig: { temperature: 0.3 },
    });

    const parts = res.candidates?.[0]?.content?.parts ?? [];
    const calls = parts.filter((p) => p.functionCall);

    if (calls.length === 0) {
      const text = parts
        .map((p) => p.text ?? "")
        .join("")
        .trim();
      if (!text) {
        const why = res.promptFeedback?.blockReason ?? res.candidates?.[0]?.finishReason ?? "resposta vazia";
        throw new Error(`O Gemini nao retornou texto (${why}).`);
      }
      return { reply: text, toolsUsed };
    }

    // Devolve as partes do modelo exatamente como vieram (preserva assinaturas de raciocinio).
    contents.push({ role: "model", parts });
    data ??= await loadData();
    const responses: Part[] = calls.map((p) => {
      const name = p.functionCall!.name;
      toolsUsed.push(name);
      return { functionResponse: { name, response: { resultado: runTool(data!, name, p.functionCall!.args ?? {}) } } };
    });
    contents.push({ role: "user", parts: responses });
  }

  throw new Error("O assistente fez consultas demais sem concluir a resposta. Tente reformular a pergunta.");
}
