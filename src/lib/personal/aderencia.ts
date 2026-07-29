// Reaproveita os limites de dia/semana em America/Sao_Paulo do módulo de
// nutrição — é lógica de calendário genérica, não específica de macro,
// então não faz sentido duplicar aqui.
export { limitesDoDiaEmSaoPaulo, limitesDaSemanaEmSaoPaulo } from "@/lib/nutri/aderencia";

export interface RegistroTreinoParaAderencia {
  realizadoEm: Date;
}

export interface AderenciaTreino {
  diasTreinados: number;
  diasPorSemana: number;
  percentual: number;
}

function diaChaveEmSaoPaulo(data: Date): string {
  // yyyy-mm-dd em America/Sao_Paulo — chave estável pra dedupe de "dias
  // distintos com treino", sem depender do fuso do servidor.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(data);
}

/**
 * Aderência de treino: quantos dias-calendário distintos (não quantos
 * registros — dois check-ins no mesmo dia contam como um só) tiveram
 * treino registrado, contra a meta de dias/semana do treino ativo.
 */
export function calcularAderenciaTreino(
  registros: RegistroTreinoParaAderencia[],
  diasPorSemana: number,
): AderenciaTreino {
  const diasUnicos = new Set(registros.map((registro) => diaChaveEmSaoPaulo(registro.realizadoEm)));
  const diasTreinados = diasUnicos.size;
  return {
    diasTreinados,
    diasPorSemana,
    percentual: diasPorSemana > 0 ? Math.round((diasTreinados / diasPorSemana) * 100) : 0,
  };
}

// Abaixo desse percentual da meta semanal de dias, o aluno aparece
// destacado como "fora" no painel do personal — mesmo espírito de
// FAIXA_ACEITAVEL_KCAL em src/lib/nutri/aderencia.ts, escolha de produto.
const LIMIAR_ADERENCIA_TREINO = 60;

export function estaForaDoTreino(percentual: number): boolean {
  return percentual < LIMIAR_ADERENCIA_TREINO;
}
