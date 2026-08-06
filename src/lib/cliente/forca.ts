/**
 * Força — funções puras do treino estruturado: recorde de carga por
 * exercício, 1RM estimado e volume da sessão. Sem I/O, fácil de testar; a
 * consulta traz as séries do banco e chama isto.
 */

export interface SerieBruta {
  exercicio: string;
  cargaKg: number | null;
  reps: number | null;
}

export interface RecordeExercicio {
  exercicio: string;
  /** Maior carga já registrada nesse exercício. */
  melhorCargaKg: number;
  /** Maior 1RM estimado (Epley) — compara séries pesadas com muitas reps. */
  melhor1RM: number;
}

/**
 * 1RM estimado pela fórmula de Epley: carga × (1 + reps/30). Uma repetição
 * máxima (reps = 1) devolve a própria carga. É estimativa — serve pra
 * comparar séries entre si, não pra prescrever um teste de 1RM real.
 */
export function estimar1RM(cargaKg: number, reps: number): number {
  if (cargaKg <= 0 || reps <= 0) return 0;
  return cargaKg * (1 + reps / 30);
}

/**
 * Melhor carga e melhor 1RM por exercício, a partir de todas as séries do
 * cliente. Séries sem carga são ignoradas (não dá pra ter recorde sem peso).
 * Ordena por maior carga, pra a UI mostrar os campeões primeiro.
 */
export function recordesPorExercicio(series: readonly SerieBruta[]): RecordeExercicio[] {
  const mapa = new Map<string, RecordeExercicio>();

  for (const s of series) {
    const carga = s.cargaKg ?? 0;
    if (carga <= 0) continue;
    const reps = s.reps ?? 1;
    const umRM = estimar1RM(carga, reps);

    const atual = mapa.get(s.exercicio);
    if (!atual) {
      mapa.set(s.exercicio, { exercicio: s.exercicio, melhorCargaKg: carga, melhor1RM: umRM });
      continue;
    }
    if (carga > atual.melhorCargaKg) atual.melhorCargaKg = carga;
    if (umRM > atual.melhor1RM) atual.melhor1RM = umRM;
  }

  return Array.from(mapa.values()).sort((a, b) => b.melhorCargaKg - a.melhorCargaKg);
}

/** Volume total de uma sessão: soma de carga × reps de cada série. */
export function volumeDaSessao(series: readonly SerieBruta[]): number {
  let total = 0;
  for (const s of series) {
    if (s.cargaKg && s.reps && s.cargaKg > 0 && s.reps > 0) total += s.cargaKg * s.reps;
  }
  return Math.round(total);
}

/** Carga formatada — inteiro sem decimal, meio-quilo com uma casa. */
export function formatarCarga(kg: number): string {
  const arredondado = Math.round(kg * 10) / 10;
  return `${Number.isInteger(arredondado) ? arredondado : arredondado.toFixed(1)} kg`;
}
