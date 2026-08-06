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

/** Distâncias-marco pra recordes e conquistas (metros). */
const DISTANCIAS_PADRAO: { metros: number; rotulo: string }[] = [
  { metros: 5000, rotulo: "5 km" },
  { metros: 10000, rotulo: "10 km" },
  { metros: 21097, rotulo: "21 km" },
];

export interface RecordePorDistancia {
  metros: number;
  rotulo: string;
  /** Melhor pace (mais rápido) entre corridas de pelo menos essa distância. */
  melhorPaceSegKm: number;
}

/**
 * Melhor pace por distância-marco: pra cada 5/10/21 km, o pace mais rápido
 * entre as corridas que alcançaram ao menos aquela distância. Só entram as
 * distâncias que a pessoa já correu — nada de marco vazio.
 */
export function recordesPorDistancia(corridas: CorridaBruta[]): RecordePorDistancia[] {
  const saida: RecordePorDistancia[] = [];
  for (const d of DISTANCIAS_PADRAO) {
    let melhor: number | null = null;
    for (const c of corridas) {
      if (c.distanciaMetros < d.metros) continue;
      const pace = paceSegundosPorKm(c.distanciaMetros, c.duracaoSegundos);
      if (pace > 0 && (melhor === null || pace < melhor)) melhor = pace;
    }
    if (melhor !== null) saida.push({ metros: d.metros, rotulo: d.rotulo, melhorPaceSegKm: melhor });
  }
  return saida;
}

export interface Conquista {
  id: string;
  rotulo: string;
  alcancada: boolean;
}

/**
 * Conquistas de corrida — marcos de distância numa única corrida e de volume
 * acumulado. São calculadas do histórico, não guardadas: o passado sempre
 * conta, mesmo sem ter comemorado na hora.
 */
export function conquistasDeCorrida(corridas: CorridaBruta[]): Conquista[] {
  let maiorDistancia = 0;
  let totalMetros = 0;
  for (const c of corridas) {
    if (c.distanciaMetros > maiorDistancia) maiorDistancia = c.distanciaMetros;
    totalMetros += c.distanciaMetros;
  }
  const totalKm = totalMetros / 1000;
  return [
    { id: "d5", rotulo: "Primeiros 5 km", alcancada: maiorDistancia >= 5000 },
    { id: "d10", rotulo: "Primeiros 10 km", alcancada: maiorDistancia >= 10000 },
    { id: "d21", rotulo: "Meia maratona", alcancada: maiorDistancia >= 21097 },
    { id: "v50", rotulo: "50 km somados", alcancada: totalKm >= 50 },
    { id: "v100", rotulo: "100 km somados", alcancada: totalKm >= 100 },
    { id: "v250", rotulo: "250 km somados", alcancada: totalKm >= 250 },
  ];
}
