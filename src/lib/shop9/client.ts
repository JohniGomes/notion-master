import crypto from "node:crypto";

// Camada de integração com a API de Integrações do Shop Control 9 (IdealSoft).
// Documentação pública: https://www.idealsoft.com.br/integracoes/
//
// Duas coisas que a documentação pública NÃO deixa claras e foram
// descobertas testando contra o ambiente de homologação:
// 1. O endpoint de O.S é `/ordemservico/{pagina}`, não `/os/{pagina}`.
// 2. O header `Timestamp` precisa estar no formato de "ticks" do .NET
//    (unidades de 100ns desde 0001-01-01), não ISO 8601 nem epoch Unix.

const DOTNET_EPOCH_TICKS = BigInt("621355968000000000"); // ticks de 0001-01-01 até 1970-01-01

type Shop9Envelope<T> = {
  sucesso: boolean;
  mensagem: string | null;
  tipo: string | null;
  complementoTipo: string | null;
  statusCode: number;
  dados: T;
};

function nowAsDotnetTicks(): string {
  const unixMillis = BigInt(Date.now());
  const ticks = unixMillis * BigInt(10000) + DOTNET_EPOCH_TICKS;
  return ticks.toString();
}

function computeSignature(method: string, timestamp: string, body: string, senhaModulo: string): string {
  const bodyBase64 = Buffer.from(body.trim()).toString("base64");
  const conteudo = method.toLowerCase() + timestamp + bodyBase64;
  return crypto.createHmac("sha256", senhaModulo).update(conteudo).digest("base64");
}

function getConfig() {
  const baseUrl = process.env.SHOP9_BASE_URL;
  const serie = process.env.SHOP9_SERIE;
  const codFilial = process.env.SHOP9_CODFILIAL;
  const senhaModulo = process.env.SHOP9_SENHA_MODULO;
  if (!baseUrl || !serie || !codFilial || !senhaModulo) {
    throw new Error("Variáveis SHOP9_* não configuradas.");
  }
  return { baseUrl, serie, codFilial, senhaModulo };
}

let cachedToken: { token: string; expireAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expireAt > Date.now() + 30_000) {
    return cachedToken.token;
  }

  const { baseUrl, serie, codFilial } = getConfig();
  const res = await fetch(`${baseUrl}/auth/?serie=${encodeURIComponent(serie)}&codfilial=${codFilial}`);
  const body = (await res.json()) as Shop9Envelope<{ token: string; expireAt: string }>;
  if (!body.sucesso) {
    throw new Error(`Falha ao autenticar no Shop9: ${body.mensagem}`);
  }

  cachedToken = { token: body.dados.token, expireAt: new Date(body.dados.expireAt).getTime() };
  return cachedToken.token;
}

async function request<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const { baseUrl, codFilial, senhaModulo } = getConfig();
  const token = await getToken();
  const timestamp = nowAsDotnetTicks();
  const bodyString = body ? JSON.stringify(body) : "";
  const signature = computeSignature(method, timestamp, bodyString, senhaModulo);

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Token ${token}`,
      CodFilial: codFilial,
      Timestamp: timestamp,
      Signature: signature,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: bodyString || undefined,
  });

  const envelope = (await res.json()) as Shop9Envelope<T>;
  if (!envelope.sucesso && envelope.tipo !== "FIM_DE_PAGINA") {
    throw new Error(`Shop9 API (${path}): ${envelope.mensagem ?? envelope.tipo}`);
  }
  return envelope.dados;
}

/** Percorre todas as páginas de um endpoint paginado até `FIM_DE_PAGINA`. */
export async function listAllPages<T>(pathPrefix: string): Promise<T[]> {
  const { baseUrl, codFilial, senhaModulo } = getConfig();
  const results: T[] = [];
  let page = 1;

  while (true) {
    const token = await getToken();
    const timestamp = nowAsDotnetTicks();
    const signature = computeSignature("GET", timestamp, "", senhaModulo);

    const res = await fetch(`${baseUrl}${pathPrefix}${page}`, {
      headers: {
        Authorization: `Token ${token}`,
        CodFilial: codFilial,
        Timestamp: timestamp,
        Signature: signature,
      },
    });
    const envelope = (await res.json()) as Shop9Envelope<T[]>;

    if (envelope.tipo === "FIM_DE_PAGINA") break;
    if (!envelope.sucesso) throw new Error(`Shop9 API (${pathPrefix}${page}): ${envelope.mensagem}`);

    results.push(...(envelope.dados ?? []));
    page += 1;
  }

  return results;
}

export const shop9 = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};
