/**
 * Hidratação — lógica pura, sem I/O. O consumo do dia é sempre a soma dos
 * copos registrados; nunca um contador guardado, que dessincronizaria do
 * histórico ao desfazer um toque.
 */

/** Um copo padrão. O botão de 1 toque registra este volume. */
export const COPO_PADRAO_ML = 250;

/** Ponto de partida da meta diária, antes de o cliente ajustar. */
export const META_AGUA_PADRAO_ML = 2000;

export interface Hidratacao {
  consumidoMl: number;
  metaMl: number;
  /** 0..100+, arredondado. Passa de 100 quando bebeu além da meta. */
  percentual: number;
  copoMl: number;
}

export function calcularHidratacao(
  registros: { ml: number }[],
  metaMl: number,
  copoMl: number = COPO_PADRAO_ML,
): Hidratacao {
  const consumidoMl = registros.reduce((acc, r) => acc + r.ml, 0);
  const percentual = metaMl > 0 ? Math.round((consumidoMl / metaMl) * 100) : 0;
  return { consumidoMl, metaMl, percentual, copoMl };
}
