/**
 * Ranking RBP (Run Best Player) — ordenação pura, sem I/O. A consulta soma
 * os metros por cliente no mês; aqui só ordena, numera as posições e marca
 * quem é "você". km com uma casa, pra a UI não repetir a conta.
 */

export interface EntradaRankingBruta {
  clienteId: string;
  apelido: string;
  metros: number;
}

export interface EntradaRanking {
  posicao: number;
  apelido: string;
  km: number;
  ehVoce: boolean;
}

export function ordenarRanking(entradas: EntradaRankingBruta[], clienteIdVoce: string): EntradaRanking[] {
  return [...entradas]
    .sort((a, b) => b.metros - a.metros)
    .map((e, i) => ({
      posicao: i + 1,
      apelido: e.apelido,
      km: Math.round(e.metros / 100) / 10,
      ehVoce: e.clienteId === clienteIdVoce,
    }));
}
