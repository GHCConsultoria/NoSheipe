import type { RespostaIa } from "./ia";

/**
 * Guarda de plausibilidade dos macros estimados pela IA.
 *
 * A IA de visão tende a superestimar — a costela vira "carne magra" e a
 * proteína estoura. Esta função é a rede de segurança física, não a
 * calibração fina (essa mora no prompt, com a tabela de referência). Ela pega
 * o que é *impossível*, não o que é *incerto*:
 *
 *  1. Massa — a soma de proteína + carbo + gordura em gramas não pode passar
 *     do peso do alimento (o resto é água, fibra, cinzas). Passou → reduz os
 *     três proporcionalmente até caber. Isso é respeitar a física, não
 *     inventar dado.
 *  2. Calorias (Atwater) — o kcal declarado tem que bater com 4·P + 4·C + 9·G.
 *     Desvio grande é sinal de estimativa ruim; a gente sinaliza (não reescreve
 *     o kcal) e deixa o humano conferir.
 *  3. Totais — sempre a soma dos itens já corrigidos.
 *
 * Quando corrige ou sinaliza, derruba a confiança pra no máximo
 * CONFIANCA_MAXIMA_IMPLAUSIVEL, e a UI passa a mostrar "estimativa (X%)" baixo
 * — o empurrão pro cliente ajustar na mão. Função pura: sem I/O, fácil de testar.
 */

/** Folga de arredondamento antes de considerar a massa impossível. */
export const FATOR_TOLERANCIA_MASSA = 1.05;
/** Desvio aceitável entre kcal declarado e kcal implícito nos macros. */
export const TOLERANCIA_KCAL = 0.2;
/** Teto de confiança que uma estimativa sinalizada pode manter. */
export const CONFIANCA_MAXIMA_IMPLAUSIVEL = 0.4;

const KCAL_POR_GRAMA = { proteina: 4, carbo: 4, gordura: 9 } as const;

export interface ResultadoPlausibilidade {
  resposta: RespostaIa;
  alertas: string[];
}

const naoNegativo = (n: number): number => (n > 0 ? n : 0);

function somarItens(items: RespostaIa["items"]): RespostaIa["totals"] {
  return items.reduce(
    (acc, i) => ({
      kcal: acc.kcal + i.kcal,
      protein: acc.protein + i.protein,
      carbs: acc.carbs + i.carbs,
      fat: acc.fat + i.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function calibrarPlausibilidade(resposta: RespostaIa): ResultadoPlausibilidade {
  const alertas: string[] = [];
  let houveCorrecao = false;

  const items = resposta.items.map((item) => {
    const grams = naoNegativo(item.grams);
    let protein = naoNegativo(item.protein);
    let carbs = naoNegativo(item.carbs);
    let fat = naoNegativo(item.fat);

    const somaMacros = protein + carbs + fat;
    if (grams > 0 && somaMacros > grams * FATOR_TOLERANCIA_MASSA) {
      // Mais gramas de macro do que de comida — impossível. Reduz proporcional
      // até caber no peso; sinaliza pra conferência.
      const escala = grams / somaMacros;
      protein *= escala;
      carbs *= escala;
      fat *= escala;
      houveCorrecao = true;
      alertas.push(
        `${item.name}: ${Math.round(somaMacros)}g de macros em ${Math.round(grams)}g de comida é impossível — reduzido proporcionalmente`,
      );
    }

    return {
      ...item,
      kcal: Math.round(naoNegativo(item.kcal)),
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fat: Math.round(fat),
    };
  });

  const totals = somarItens(items);

  // Consistência calórica — não reescreve o kcal, só sinaliza um desvio grande
  // (a estimativa ficou internamente incoerente e o humano deve olhar).
  const kcalAtwater =
    totals.protein * KCAL_POR_GRAMA.proteina +
    totals.carbs * KCAL_POR_GRAMA.carbo +
    totals.fat * KCAL_POR_GRAMA.gordura;
  if (kcalAtwater > 0) {
    const desvio = Math.abs(totals.kcal - kcalAtwater) / kcalAtwater;
    if (desvio > TOLERANCIA_KCAL) {
      houveCorrecao = true;
      alertas.push(
        `kcal declarado (${Math.round(totals.kcal)}) não bate com os macros (~${Math.round(kcalAtwater)} kcal) — confira`,
      );
    }
  }

  const confidence = houveCorrecao
    ? Math.min(resposta.confidence, CONFIANCA_MAXIMA_IMPLAUSIVEL)
    : resposta.confidence;

  return { resposta: { items, totals, confidence }, alertas };
}
