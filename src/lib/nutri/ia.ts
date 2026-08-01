import { z } from "zod";
import { gerarTexto, IaNaoConfiguradaError, IaIndisponivelError, type ImagemIa } from "@/lib/ia/provedor";

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

function montarPrompt(textoRefeicao: string): string {
  return [
    "Você é um assistente que estima macronutrientes de uma refeição descrita em português.",
    "Nunca invente com confiança alta itens que não foram mencionados. Se a descrição for vaga (ex.: 'um prato de comida'), estime com cautela e reflita a incerteza no campo confidence, mais baixo.",
    "Responda SOMENTE com um JSON válido, sem markdown, sem texto antes ou depois, exatamente neste formato:",
    '{"items":[{"name":"peito de frango grelhado","grams":150,"kcal":248,"protein":46,"carbs":0,"fat":5}],"totals":{"kcal":248,"protein":46,"carbs":0,"fat":5},"confidence":0.72}',
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
        return parsed.data;
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
        return parsed.data;
      }
    } catch {
      // JSON malformado — tenta de novo na próxima iteração.
    }
  }

  throw new IaRespostaInvalidaError("não deu pra estimar os macros dessa foto — tente uma foto mais nítida ou descreva no texto");
}
