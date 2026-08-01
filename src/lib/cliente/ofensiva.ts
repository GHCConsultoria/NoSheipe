/**
 * Ofensiva (streak) — dias-calendário seguidos com algum registro. Lógica
 * pura sobre chaves "yyyy-mm-dd" já no fuso de São Paulo; quem monta as
 * chaves (a consulta) é dona do fuso, aqui só se compara texto de data.
 */

export interface Ofensiva {
  /** Dias seguidos com registro, contando de trás pra frente. */
  dias: number;
  /** Já registrou algo hoje. Falso = a ofensiva de ontem ainda está de pé, mas pendente. */
  ativaHoje: boolean;
}

/** Dia anterior a uma chave "yyyy-mm-dd", sem drift de fuso (ancora ao meio-dia UTC). */
function diaAnterior(chave: string): string {
  const d = new Date(`${chave}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Conta a sequência de dias seguidos com registro que termina hoje — ou
 * ontem, se hoje ainda não teve nada: a ofensiva construída até ontem
 * continua valendo, só entra como "pendente" (ativaHoje = false). Um buraco
 * de um dia zera a contagem.
 */
export function calcularOfensiva(diasComRegistro: Iterable<string>, hoje: string): Ofensiva {
  const set = diasComRegistro instanceof Set ? diasComRegistro : new Set(diasComRegistro);
  const ativaHoje = set.has(hoje);

  let cursor = ativaHoje ? hoje : diaAnterior(hoje);
  let dias = 0;
  while (set.has(cursor)) {
    dias += 1;
    cursor = diaAnterior(cursor);
  }

  return { dias, ativaHoje };
}
