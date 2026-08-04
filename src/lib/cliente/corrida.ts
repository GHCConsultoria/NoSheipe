/**
 * Corrida — lógica pura, sem I/O. Pace e recordes saem de metros + segundos
 * (inteiros), pra a conta ser exata e testável fora do banco.
 */

/** Distância mínima pra um pace entrar no recorde: tiros curtos distorcem. */
export const DISTANCIA_MINIMA_RECORDE_METROS = 1000;

export interface CorridaBruta {
  distanciaMetros: number;
  duracaoSegundos: number;
}

/** Pace em segundos por km. 0 de distância devolve 0 (não divide por zero). */
export function paceSegundosPorKm(distanciaMetros: number, duracaoSegundos: number): number {
  if (distanciaMetros <= 0) return 0;
  return Math.round(duracaoSegundos / (distanciaMetros / 1000));
}

/** "5:30 /km" a partir de segundos por km. */
export function formatarPace(segPorKm: number): string {
  if (segPorKm <= 0) return "—";
  const minutos = Math.floor(segPorKm / 60);
  const segundos = segPorKm % 60;
  return `${minutos}:${String(segundos).padStart(2, "0")} /km`;
}

/** "1h05" ou "42 min" a partir de segundos. */
export function formatarDuracao(segundos: number): string {
  const totalMin = Math.round(segundos / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export interface Recordes {
  /** Menor pace (mais rápido) entre corridas com distância suficiente; null se não há. */
  melhorPaceSegKm: number | null;
  /** Maior distância já corrida, em metros. */
  maiorDistanciaMetros: number;
  /** Soma de todas as distâncias, em metros. */
  totalMetros: number;
  quantidade: number;
}

/**
 * Recordes pessoais a partir do histórico. O melhor pace só considera
 * corridas a partir da distância mínima — senão um tiro de 100m viraria o
 * "recorde" e mataria a graça.
 */
export function calcularRecordes(corridas: CorridaBruta[]): Recordes {
  let melhorPaceSegKm: number | null = null;
  let maiorDistanciaMetros = 0;
  let totalMetros = 0;

  for (const c of corridas) {
    totalMetros += c.distanciaMetros;
    if (c.distanciaMetros > maiorDistanciaMetros) maiorDistanciaMetros = c.distanciaMetros;

    if (c.distanciaMetros >= DISTANCIA_MINIMA_RECORDE_METROS) {
      const pace = paceSegundosPorKm(c.distanciaMetros, c.duracaoSegundos);
      if (pace > 0 && (melhorPaceSegKm === null || pace < melhorPaceSegKm)) melhorPaceSegKm = pace;
    }
  }

  return { melhorPaceSegKm, maiorDistanciaMetros, totalMetros, quantidade: corridas.length };
}
