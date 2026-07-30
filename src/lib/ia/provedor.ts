/**
 * Provedor de IA pra estimar macros — Groq (tier gratuito) por padrão, com
 * Anthropic de reserva. A chamada é um fetch simples, sem SDK: os dois
 * provedores expõem uma API de chat por HTTP e o formato de cada um mora nas
 * funções puras abaixo (montarRequisicao/extrairTexto), fáceis de testar sem
 * rede.
 *
 * Trocar de provedor é só uma variável de ambiente: sem GROQ_API_KEY nem
 * ANTHROPIC_API_KEY, gerarTexto lança IaNaoConfiguradaError; quando o
 * provedor responde erro (sem crédito, limite, fora do ar), lança
 * IaIndisponivelError — quem chama traduz os dois em mensagem tratada, nunca
 * inventa um rascunho.
 */

/** Nenhuma chave de provedor configurada. */
export class IaNaoConfiguradaError extends Error {}

/** O provedor existe mas recusou/falhou agora (crédito, limite, rede, 5xx). */
export class IaIndisponivelError extends Error {}

export type NomeProvedor = "groq" | "anthropic";

export interface Provedor {
  nome: NomeProvedor;
  apiKey: string;
  modelo: string;
}

export interface GerarTextoParams {
  prompt: string;
  maxTokens?: number;
}

export interface RequisicaoIa {
  url: string;
  headers: Record<string, string>;
  body: string;
}

// Modelos padrão. Groq: um modelo aberto e gratuito, bom o bastante pra
// devolver o JSON de macros. Anthropic: mantém o que já estava em uso.
const MODELO_GROQ_PADRAO = "llama-3.3-70b-versatile";
const MODELO_ANTHROPIC_PADRAO = "claude-sonnet-5";

interface EnvIa {
  // Índice pra aceitar process.env direto (todas as chaves são opcionais, o
  // que sem isto dispara a checagem de "weak type" do TS).
  [chave: string]: string | undefined;
  IA_PROVEDOR?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
}

/**
 * Escolhe o provedor a partir das variáveis de ambiente. Sem preferência
 * explícita (IA_PROVEDOR), Groq vem primeiro por ser o gratuito; Anthropic
 * entra só como reserva. Devolve null quando nenhuma chave existe — aí quem
 * chama lança IaNaoConfiguradaError.
 */
export function selecionarProvedor(env: EnvIa): Provedor | null {
  const preferido = env.IA_PROVEDOR?.trim().toLowerCase();

  const groq: Provedor | null = env.GROQ_API_KEY
    ? { nome: "groq", apiKey: env.GROQ_API_KEY, modelo: env.GROQ_MODEL || MODELO_GROQ_PADRAO }
    : null;
  const anthropic: Provedor | null = env.ANTHROPIC_API_KEY
    ? { nome: "anthropic", apiKey: env.ANTHROPIC_API_KEY, modelo: env.ANTHROPIC_MODEL || MODELO_ANTHROPIC_PADRAO }
    : null;

  if (preferido === "anthropic" && anthropic) return anthropic;
  if (preferido === "groq" && groq) return groq;

  return groq ?? anthropic;
}

/** Monta URL, headers e corpo no formato do provedor escolhido. */
export function montarRequisicao(provedor: Provedor, prompt: string, maxTokens: number): RequisicaoIa {
  const mensagens = [{ role: "user", content: prompt }];

  if (provedor.nome === "groq") {
    // Groq fala o dialeto OpenAI (chat/completions).
    return {
      url: "https://api.groq.com/openai/v1/chat/completions",
      headers: {
        authorization: `Bearer ${provedor.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: provedor.modelo, max_tokens: maxTokens, messages: mensagens }),
    };
  }

  return {
    url: "https://api.anthropic.com/v1/messages",
    headers: {
      "x-api-key": provedor.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: provedor.modelo, max_tokens: maxTokens, messages: mensagens }),
  };
}

interface RespostaGroq {
  choices?: Array<{ message?: { content?: string } }>;
}
interface RespostaAnthropic {
  content?: Array<{ type: string; text?: string }>;
}

/** Extrai o texto da resposta, cada provedor no seu formato. Null se não veio. */
export function extrairTexto(provedor: Provedor, dados: unknown): string | null {
  if (provedor.nome === "groq") {
    const groq = dados as RespostaGroq;
    return groq.choices?.[0]?.message?.content ?? null;
  }
  const anthropic = dados as RespostaAnthropic;
  return anthropic.content?.find((bloco) => bloco.type === "text")?.text ?? null;
}

export async function gerarTexto({ prompt, maxTokens = 1600 }: GerarTextoParams): Promise<string> {
  // Resposta fixa pra teste de ponta a ponta, no mesmo espírito do
  // SEED_POPULACAO_DEMO: opt-in por variável que ninguém define em produção.
  // Existe porque a IA é o único ponto do fluxo que sai pra rede, e o E2E
  // precisa exercitar o registro de refeição sem depender de provedor nem
  // gastar cota. O valor é o texto cru que extrairMacros vai parsear.
  const respostaFixa = process.env.IA_STUB_JSON;
  if (respostaFixa) {
    return respostaFixa;
  }

  const provedor = selecionarProvedor(process.env);
  if (!provedor) {
    throw new IaNaoConfiguradaError(
      "nenhum provedor de IA configurado — defina GROQ_API_KEY (grátis) ou ANTHROPIC_API_KEY",
    );
  }

  const requisicao = montarRequisicao(provedor, prompt, maxTokens);

  let resposta: Response;
  try {
    resposta = await fetch(requisicao.url, {
      method: "POST",
      headers: requisicao.headers,
      body: requisicao.body,
    });
  } catch {
    throw new IaIndisponivelError(`falha de rede ao chamar o provedor ${provedor.nome}`);
  }

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => "");
    throw new IaIndisponivelError(`provedor ${provedor.nome} respondeu ${resposta.status}: ${corpo}`);
  }

  const dados: unknown = await resposta.json();
  const texto = extrairTexto(provedor, dados);
  if (!texto) {
    throw new IaIndisponivelError(`provedor ${provedor.nome} não retornou texto na resposta`);
  }
  return texto;
}
