import { describe, expect, it } from "vitest";
import {
  calibrarPlausibilidade,
  CONFIANCA_MAXIMA_IMPLAUSIVEL,
  type ResultadoPlausibilidade,
} from "./plausibilidade";
import type { RespostaIa } from "./ia";

/**
 * Guarda de plausibilidade — função pura, sem I/O. Os casos cobrem a divisão
 * de trabalho: ela pega o impossível (massa e Atwater), preserva o plausível
 * (inclusive densidade proteica alta e legítima, como whey) e nunca inventa —
 * quando corrige, derruba a confiança pra UI pedir conferência.
 */

function resposta(parcial: Partial<RespostaIa> & { items: RespostaIa["items"] }): RespostaIa {
  const totals = parcial.totals ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  return { confidence: 0.8, totals, ...parcial };
}

const somaMacros = (r: ResultadoPlausibilidade) => {
  const i = r.resposta.items[0];
  return i.protein + i.carbs + i.fat;
};

describe("calibrarPlausibilidade", () => {
  it("deixa passar uma estimativa plausível, sem alertas nem mexer na confiança", () => {
    const entrada = resposta({
      items: [{ name: "peito de frango grelhado", grams: 150, kcal: 248, protein: 46, carbs: 0, fat: 5 }],
      totals: { kcal: 248, protein: 46, carbs: 0, fat: 5 },
      confidence: 0.72,
    });

    const { resposta: saida, alertas } = calibrarPlausibilidade(entrada);

    expect(alertas).toHaveLength(0);
    expect(saida.confidence).toBe(0.72);
    expect(saida.totals.protein).toBe(46);
  });

  it("não penaliza densidade proteica alta e legítima (whey cabe no peso)", () => {
    // 30g de whey com 24g de proteína = 0,8 g/g. Densidade altíssima, mas a
    // soma dos macros (27g) cabe nos 30g — é possível, não deve ser mexido.
    const entrada = resposta({
      items: [{ name: "whey protein", grams: 30, kcal: 120, protein: 24, carbs: 2, fat: 1 }],
      totals: { kcal: 120, protein: 24, carbs: 2, fat: 1 },
      confidence: 0.9,
    });

    const { resposta: saida, alertas } = calibrarPlausibilidade(entrada);

    expect(alertas).toHaveLength(0);
    expect(saida.confidence).toBe(0.9);
    expect(saida.totals.protein).toBe(24);
  });

  it("reduz proporcionalmente quando os macros pesam mais que o alimento", () => {
    // 100g de comida com 80+50+30 = 160g de macros é fisicamente impossível.
    const entrada = resposta({
      items: [{ name: "algo improvável", grams: 100, kcal: 900, protein: 80, carbs: 50, fat: 30 }],
      totals: { kcal: 900, protein: 80, carbs: 50, fat: 30 },
      confidence: 0.85,
    });

    const resultado = calibrarPlausibilidade(entrada);

    // Soma dos macros passa a caber no peso do alimento (~100g).
    expect(somaMacros(resultado)).toBeLessThanOrEqual(101);
    // Proporção original preservada: proteína continua sendo metade dos macros.
    expect(resultado.resposta.items[0].protein).toBeCloseTo(50, 0);
    expect(resultado.alertas.some((a) => a.includes("impossível"))).toBe(true);
    expect(resultado.resposta.confidence).toBeLessThanOrEqual(CONFIANCA_MAXIMA_IMPLAUSIVEL);
  });

  it("sinaliza quando o kcal não fecha com os macros, sem reescrever o kcal", () => {
    // Macros implicam ~4·10 + 4·10 + 9·5 = 125 kcal, mas declara 500.
    const entrada = resposta({
      items: [{ name: "salada", grams: 200, kcal: 500, protein: 10, carbs: 10, fat: 5 }],
      totals: { kcal: 500, protein: 10, carbs: 10, fat: 5 },
      confidence: 0.8,
    });

    const { resposta: saida, alertas } = calibrarPlausibilidade(entrada);

    expect(saida.totals.kcal).toBe(500); // não reescreve
    expect(alertas.some((a) => a.includes("não bate"))).toBe(true);
    expect(saida.confidence).toBeLessThanOrEqual(CONFIANCA_MAXIMA_IMPLAUSIVEL);
  });

  it("recalcula os totais como a soma dos itens, ignorando totais tortos da IA", () => {
    const entrada = resposta({
      items: [
        { name: "arroz", grams: 150, kcal: 193, protein: 4, carbs: 42, fat: 0 },
        { name: "feijão", grams: 100, kcal: 76, protein: 5, carbs: 14, fat: 0 },
      ],
      totals: { kcal: 9999, protein: 999, carbs: 999, fat: 999 }, // absurdo de propósito
      confidence: 0.7,
    });

    const { resposta: saida } = calibrarPlausibilidade(entrada);

    expect(saida.totals.protein).toBe(9);
    expect(saida.totals.carbs).toBe(56);
    expect(saida.totals.kcal).toBe(269);
  });

  it("zera valores negativos que a IA por acaso devolva", () => {
    const entrada = resposta({
      items: [{ name: "estranho", grams: 100, kcal: -50, protein: -3, carbs: 20, fat: 2 }],
      totals: { kcal: -50, protein: -3, carbs: 20, fat: 2 },
      confidence: 0.6,
    });

    const { resposta: saida } = calibrarPlausibilidade(entrada);

    expect(saida.items[0].protein).toBe(0);
    expect(saida.items[0].kcal).toBe(0);
    expect(saida.totals.carbs).toBe(20);
  });
});
