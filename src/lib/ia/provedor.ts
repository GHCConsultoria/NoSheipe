/**
 * Provedor de IA pra estimar macros. Suporta GitHub Models (GPT-4o-mini de
 * graça, autenticando com um token do GitHub), Gemini e Groq (tiers
 * gratuitos) e Anthropic (pago, de reserva). A chamada é um fetch simples,
 * sem SDK: cada provedor expõe uma API de chat por HTTP e o formato de cada um
 * mora nas funções puras abaixo (montarRequisicao/extrairTexto), fáceis de
 * testar sem rede.
 *
 * Trocar de provedor é só uma variável de ambiente: sem nenhuma chave,
 * gerarTexto lança IaNaoConfiguradaError; quando o provedor responde erro
 * (sem crédito, limite, fora do ar), lança IaIndisponivelError — quem chama
 * traduz os dois em mensagem tratada, nunca inventa um rascunho.
 */

/** Nenhuma chave de provedor configurada. */
export class IaNaoConfiguradaError extends Error {}

/** O provedor existe mas recusou/falhou agora (crédito, limite, rede, 5xx). */
export class IaIndisponivelError extends Error {}

export type NomeProvedor = "github" | "gemini" | "groq" | "anthropic";

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

// Modelos padrão. GitHub Models, Gemini e Groq: modelos de tier gratuito.
// GitHub Models serve o gpt-4o-mini da OpenAI de graça (o nome vem prefixado
// pelo publicador). Anthropic: Haiku, o mais barato — dá conta do JSON de
// macros e custa uma fração do Sonnet (troque pra "claude-sonnet-5" via
// ANTHROPIC_MODEL se a estimativa apertar).
const MODELO_GITHUB_PADRAO = "openai/gpt-4o-mini";
const MODELO_GEMINI_PADRAO = "gemini-2.0-flash";
const MODELO_GROQ_PADRAO = "llama-3.3-70b-versatile";
const MODELO_ANTHROPIC_PADRAO = "claude-haiku-4-5";

interface EnvIa {
  // Índice pra aceitar process.env direto (todas as chaves são opcionais, o
  // que sem isto dispara a checagem de "weak type" do TS).
  [chave: string]: string | undefined;
  IA_PROVEDOR?: string;
  GITHUB_MODELS_TOKEN?: string;
  GITHUB_MODELS_MODEL?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
}

/**
 * Escolhe o provedor a partir das variáveis de ambiente. Sem preferência
 * explícita (IA_PROVEDOR), os gratuitos vêm primeiro — GitHub Models (grátis,
 * sem cartão) na frente, depois Gemini e Groq; Anthropic entra só como
 * reserva. Devolve null quando nenhuma chave existe — aí quem chama lança
 * IaNaoConfiguradaError.
 */
export function selecionarProvedor(env: EnvIa): Provedor | null {
  const preferido = env.IA_PROVEDOR?.trim().toLowerCase();

  const github: Provedor | null = env.GITHUB_MODELS_TOKEN
    ? { nome: "github", apiKey: env.GITHUB_MODELS_TOKEN, modelo: env.GITHUB_MODELS_MODEL || MODELO_GITHUB_PADRAO }
    : null;
  const gemini: Provedor | null = env.GEMINI_API_KEY
    ? { nome: "gemini", apiKey: env.GEMINI_API_KEY, modelo: env.GEMINI_MODEL || MODELO_GEMINI_PADRAO }
    : null;
  const groq: Provedor | null = env.GROQ_API_KEY
    ? { nome: "groq", apiKey: env.GROQ_API_KEY, modelo: env.GROQ_MODEL || MODELO_GROQ_PADRAO }
    : null;
  const anthropic: Provedor | null = env.ANTHROPIC_API_KEY
    ? { nome: "anthropic", apiKey: env.ANTHROPIC_API_KEY, modelo: env.ANTHROPIC_MODEL || MODELO_ANTHROPIC_PADRAO }
    : null;

  if (preferido === "github" && github) return github;
  if (preferido === "gemini" && gemini) return gemini;
  if (preferido === "groq" && groq) return groq;
  if (preferido === "anthropic" && anthropic) return anthropic;

  return github ?? gemini ?? groq ?? anthropic;
}

/** Monta URL, headers e corpo no formato do provedor escolhido. */
export function montarRequisicao(provedor: Provedor, prompt: string, maxTokens: number): RequisicaoIa {
  const mensagens = [{ role: "user", content: prompt }];

  if (provedor.nome === "gemini") {
    // Gemini (Generative Language API). A chave vai no header x-goog-api-key,
    // não na URL, pra não vazar em log de requisição. responseMimeType força
    // JSON puro, o que casa com o que extrairMacros espera.
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${provedor.modelo}:generateContent`,
      headers: {
        "x-goog-api-key": provedor.apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, responseMimeType: "application/json" },
      }),
    };
  }

  if (provedor.nome === "groq" || provedor.nome === "github") {
    // Groq e GitHub Models falam o mesmo dialeto OpenAI (chat/completions);
    // muda só a URL base e o Bearer. GitHub Models autentica com um token do
    // GitHub (permissão models:read) e serve modelos da OpenAI de graça.
    const url =
      provedor.nome === "groq"
        ? "https://api.groq.com/openai/v1/chat/completions"
        : "https://models.github.ai/inference/chat/completions";
    return {
      url,
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

interface RespostaGemini {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}
// Formato OpenAI de chat — serve Groq e GitHub Models.
interface RespostaChatOpenAi {
  choices?: Array<{ message?: { content?: string } }>;
}
interface RespostaAnthropic {
  content?: Array<{ type: string; text?: string }>;
}

/** Extrai o texto da resposta, cada provedor no seu formato. Null se não veio. */
export function extrairTexto(provedor: Provedor, dados: unknown): string | null {
  if (provedor.nome === "gemini") {
    const gemini = dados as RespostaGemini;
    const partes = gemini.candidates?.[0]?.content?.parts;
    if (!partes) return null;
    // A resposta pode vir fatiada em vários parts — junta tudo.
    const texto = partes.map((parte) => parte.text ?? "").join("").trim();
    return texto || null;
  }
  if (provedor.nome === "groq" || provedor.nome === "github") {
    const openai = dados as RespostaChatOpenAi;
    return openai.choices?.[0]?.message?.content ?? null;
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
      "nenhum provedor de IA configurado — defina GITHUB_MODELS_TOKEN (grátis) ou ANTHROPIC_API_KEY",
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
