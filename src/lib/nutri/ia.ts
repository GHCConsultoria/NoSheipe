import { z } from "zod";
import { gerarTexto, IaNaoConfiguradaError, IaIndisponivelError, type ImagemIa } from "@/lib/ia/provedor";
import { calibrarPlausibilidade } from "./plausibilidade";

export { IaNaoConfiguradaError, IaIndisponivelError };
export class IaRespostaInvalidaError extends Error {}

const itemSchema = z.object({
  name: z.string(),
  grams: z.number(),
  kcal: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
});

/** Contrato rígido da resposta da IA — nomes em inglês de propósito, é o formato acordado no brief. */
export const respostaIaSchema = z.object({
  items: z.array(itemSchema),
  totals: z.object({
    kcal: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
  }),
  confidence: z.number().min(0).max(1),
});

export type RespostaIa = z.infer<typeof respostaIaSchema>;

/**
 * Regras de calibração compartilhadas pelos dois prompts (texto e foto).
 *
 * O modelo puxa toda carne pra densidade de proteína de carne magra e
 * superestima cortes gordos (a costela vira "peito de frango"). A tabela de
 * referência e as regras abaixo são a correção principal desse viés — a guarda
 * de plausibilidade em plausibilidade.ts é só a rede de segurança física.
 */
const REGRAS_CALIBRACAO = [
  "REGRAS DE CALIBRAÇÃO (siga à risca):",
  "- Proteína por 100g varia MUITO com a gordura do corte. Cortes gordos têm MENOS proteína por 100g que cortes magros, porque a gordura ocupa massa. Referência (aproximada, cozido):",
  "  • Peito de frango, patinho, coxão (magros): ~31g de proteína/100g",
  "  • Costela bovina, cupim, picanha, asa de frango (gordos): ~22 a 26g/100g",
  "  • Panceta, bacon, linguiça (muito gordos): ~13 a 16g/100g",
  "  • Peixe branco (tilápia): ~22g/100g · Salmão: ~22g/100g",
  "  • Ovo: ~13g/100g · Queijo muçarela: ~22g/100g",
  "  • Arroz cozido: ~2,5g/100g · Feijão cozido: ~5g/100g · Batata cozida: ~2g/100g",
  "- Na dúvida sobre o corte, ERRE A PROTEÍNA PRA BAIXO. É melhor subestimar do que estourar.",
  "- Restrições físicas: a soma de proteína + carboidrato + gordura em gramas NUNCA passa do peso do alimento em gramas. E kcal ≈ 4·proteína + 4·carboidrato + 9·gordura — confira antes de responder.",
].join("\n");

function montarPrompt(textoRefeicao: string): string {
  return [
    "Você é um assistente que estima macronutrientes de uma refeição descrita em português.",
    "Nunca invente com confiança alta itens que não foram mencionados. Se a descrição for vaga (ex.: 'um prato de comida'), estime com cautela e reflita a incerteza no campo confidence, mais baixo.",
    REGRAS_CALIBRACAO,
    "Responda SOMENTE com um JSON válido, sem markdown, sem texto antes ou depois, exatamente neste formato:",
    '{"items":[{"name":"costela bovina assada","grams":150,"kcal":360,"protein":37,"carbs":0,"fat":24}],"totals":{"kcal":360,"protein":37,"carbs":0,"fat":24},"confidence":0.6}',
    "",
    `Descrição da refeição: "${textoRefeicao}"`,
  ].join("\n");
}

function extrairJson(textoResposta: string): unknown {
  // A IA às vezes envolve a resposta em ```json apesar da instrução — limpa
  // isso antes do parse em vez de falhar por causa de markdown incidental.
  const limpo = textoResposta
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  return JSON.parse(limpo);
}

/**
 * Passa a resposta pela guarda de plausibilidade antes de devolver. Corrige o
 * fisicamente impossível, sinaliza incoerência e (quando mexe) derruba a
 * confiança. Os alertas viram log de servidor — sinal pra calibrar o prompt
 * com o tempo, sem poluir a UI, que já mostra a confiança baixa.
 */
function calibrar(resposta: RespostaIa): RespostaIa {
  const { resposta: calibrada, alertas } = calibrarPlausibilidade(resposta);
  if (alertas.length > 0) {
    console.warn("[ia] macros ajustados pela guarda de plausibilidade:", alertas.join(" | "));
  }
  return calibrada;
}

/**
 * Extrai itens e macros de um relato de refeição via IA. Tenta uma vez,
 * falhou o parse (JSON inválido ou fora do contrato) → tenta mais uma vez
 * (a IA é não-determinística, um retry costuma resolver); falhou de novo →
 * lança IaRespostaInvalidaError, que quem chama traduz num erro tratado sem
 * quebrar a UI. Nunca inventa macro fora do que a IA devolveu.
 */
export async function extrairMacros(textoRefeicao: string): Promise<RespostaIa> {
  const prompt = montarPrompt(textoRefeicao);

  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const textoResposta = await gerarTexto({ prompt, maxTokens: 800 });
    try {
      const json = extrairJson(textoResposta);
      const parsed = respostaIaSchema.safeParse(json);
      if (parsed.success) {
        return calibrar(parsed.data);
      }
    } catch {
      // JSON malformado — tenta de nova na próxima iteração do loop.
    }
  }

  throw new IaRespostaInvalidaError(
    "não foi possível estimar os macros dessa descrição — tente descrever de outro jeito",
  );
}

function montarPromptFoto(): string {
  return [
    "Você é um assistente que estima macronutrientes de uma refeição a partir de uma FOTO.",
    "Identifique os alimentos visíveis e estime porções pela imagem. Não invente itens que não dá pra ver; se a foto estiver escura, ambígua ou não for comida, reflita isso no campo confidence, bem mais baixo.",
    "Preencha 'name' de cada item com o alimento em português (ex.: 'arroz branco', 'filé de frango').",
    "Repare no corte e no preparo: uma costela ou uma carne com gordura aparente rende MENOS proteína por 100g que um corte magro. Não trate toda carne como peito de frango.",
    REGRAS_CALIBRACAO,
    "Responda SOMENTE com um JSON válido, sem markdown, sem texto antes ou depois, exatamente neste formato:",
    '{"items":[{"name":"arroz branco","grams":150,"kcal":193,"protein":4,"carbs":42,"fat":0}],"totals":{"kcal":193,"protein":4,"carbs":42,"fat":0},"confidence":0.55}',
  ].join("\n");
}

/**
 * Estima itens e macros a partir de uma FOTO da refeição, via modelo de
 * visão. Mesmo contrato e mesma tolerância a retry do extrairMacros de
 * texto — e a mesma regra: nunca inventa macro fora do que a IA devolveu.
 * Requer um provedor/modelo com visão (Anthropic Haiku, Gemini, gpt-4o-mini);
 * modelos só-texto vão falhar na chamada, tratado como IA indisponível.
 */
export async function extrairMacrosDeFoto(imagem: ImagemIa): Promise<RespostaIa> {
  const prompt = montarPromptFoto();

  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const textoResposta = await gerarTexto({ prompt, maxTokens: 800, imagem });
    try {
      const json = extrairJson(textoResposta);
      const parsed = respostaIaSchema.safeParse(json);
      if (parsed.success) {
        return calibrar(parsed.data);
      }
    } catch {
      // JSON malformado — tenta de novo na próxima iteração.
    }
  }

  throw new IaRespostaInvalidaError("não deu pra estimar os macros dessa foto — tente uma foto mais nítida ou descreva no texto");
}
