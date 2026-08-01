/**
 * Comparação entre dois números — a semana de agora contra a anterior.
 * Função pura: a consulta calcula os totais, isto só deriva a diferença e o
 * sentido, pra UI não repetir essa conta em cada métrica.
 */

export type Direcao = "subiu" | "desceu" | "igual";

export interface Comparacao {
  atual: number;
  anterior: number;
  delta: number;
  direcao: Direcao;
}

export function comparar(atual: number, anterior: number): Comparacao {
  const delta = atual - anterior;
  const direcao: Direcao = delta > 0 ? "subiu" : delta < 0 ? "desceu" : "igual";
  return { atual, anterior, delta, direcao };
}
