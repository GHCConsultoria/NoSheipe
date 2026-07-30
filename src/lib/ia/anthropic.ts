const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODELO_PADRAO = "claude-sonnet-5";

export class IaNaoConfiguradaError extends Error {}

export interface GerarTextoParams {
  prompt: string;
  maxTokens?: number;
}

interface RespostaAnthropic {
  content: Array<{ type: string; text?: string }>;
}

/**
 * Chama a Anthropic Messages API direto via fetch, sem instalar o SDK —
 * este ambiente não tem Node local pra atualizar o lockfile com segurança,
 * e um fetch simples é o mesmo padrão já usado pra Resend/WhatsApp aqui.
 * Lança IaNaoConfiguradaError sem ANTHROPIC_API_KEY configurada; quem chama
 * decide como comunicar isso ao usuário — nunca inventamos um rascunho.
 */
export async function gerarTexto({ prompt, maxTokens = 1600 }: GerarTextoParams): Promise<string> {
  // Resposta fixa pra teste de ponta a ponta, no mesmo espírito do
  // SEED_POPULACAO_DEMO: opt-in por variável que ninguém define em produção.
  // Existe porque a IA é o único ponto do fluxo que sai pra rede, e o E2E
  // precisa exercitar o registro de refeição sem depender da Anthropic nem
  // gastar tokens. O valor é o texto cru que extrairMacros vai parsear.
  const respostaFixa = process.env.IA_STUB_JSON;
  if (respostaFixa) {
    return respostaFixa;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new IaNaoConfiguradaError(
      "ANTHROPIC_API_KEY não configurada — configure essa variável de ambiente pra habilitar rascunhos com IA",
    );
  }

  const resposta = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || MODELO_PADRAO,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resposta.ok) {
    const corpo = await resposta.text();
    throw new Error(`Anthropic API respondeu ${resposta.status}: ${corpo}`);
  }

  const dados = (await resposta.json()) as RespostaAnthropic;
  const texto = dados.content.find((bloco) => bloco.type === "text")?.text;
  if (!texto) {
    throw new Error("Anthropic API não retornou texto no conteúdo da resposta");
  }
  return texto;
}
