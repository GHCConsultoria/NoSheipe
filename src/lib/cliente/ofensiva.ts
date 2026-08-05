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

/**
 * Nível visual da chama da constância. A chama nasce pequena e âmbar e vai
 * crescendo e esfriando de cor a cada marco — âmbar → laranja → azul (uma
 * semana, a "chama azul") → verde-água → verde (o hábito consolidado). O
 * verde é o ápice: constância virou rotina.
 *
 * É a fonte única de verdade do foguinho: tamanho, cor e rótulo saem daqui,
 * função pura, fácil de testar e de recalibrar os marcos sem tocar na UI.
 */
export interface NivelChama {
  /** Índice do nível, 0 (apagada) a 5 (verde). */
  nivel: number;
  rotulo: string;
  /** Cor da chama (hex) — vale pro preenchimento e pro brilho. */
  cor: string;
  /** Tamanho do ícone em px — cresce com a ofensiva. */
  tamanho: number;
  /** Dias que faltam pro próximo marco; null quando já está no ápice. */
  proximoEm: number | null;
}

const ESCADA_DA_CHAMA: { minimo: number; rotulo: string; cor: string; tamanho: number }[] = [
  { minimo: 0, rotulo: "Acenda hoje", cor: "#6b7280", tamanho: 26 },
  { minimo: 1, rotulo: "Faísca", cor: "#f59e0b", tamanho: 30 },
  { minimo: 3, rotulo: "Esquentando", cor: "#f97316", tamanho: 36 },
  { minimo: 7, rotulo: "Chama azul", cor: "#38bdf8", tamanho: 42 },
  { minimo: 14, rotulo: "Quase lá", cor: "#2dd4bf", tamanho: 48 },
  { minimo: 30, rotulo: "Impecável", cor: "#84cc16", tamanho: 56 },
];

export function nivelDaChama(dias: number): NivelChama {
  const d = Math.max(0, Math.floor(dias));
  let idx = 0;
  for (let i = 0; i < ESCADA_DA_CHAMA.length; i += 1) {
    if (d >= ESCADA_DA_CHAMA[i].minimo) idx = i;
  }
  const atual = ESCADA_DA_CHAMA[idx];
  const proximo = ESCADA_DA_CHAMA[idx + 1];
  return {
    nivel: idx,
    rotulo: atual.rotulo,
    cor: atual.cor,
    tamanho: atual.tamanho,
    proximoEm: proximo ? proximo.minimo - d : null,
  };
}
