import type { Paciente } from "../../../prisma/nutri/generated";
import { prismaNutri } from "@/lib/nutri/prisma";
import { StatusPaciente } from "@/lib/nutri/schemas";
import {
  calcularAderenciaSemana,
  calcularSaldoDoDia,
  estaForaDaMeta,
  limitesDaSemanaEmSaoPaulo,
  limitesDoDiaEmSaoPaulo,
  type SaldoDoDia,
} from "@/lib/nutri/aderencia";

export async function buscarPacientesDoNutricionista(nutricionistaId: string) {
  return prismaNutri.paciente.findMany({
    where: { nutricionistaId, status: StatusPaciente.ATIVO },
    orderBy: { criadoEm: "desc" },
  });
}

export async function buscarPacientePorId(pacienteId: string, nutricionistaId: string) {
  const paciente = await prismaNutri.paciente.findUnique({ where: { id: pacienteId } });
  if (!paciente || paciente.nutricionistaId !== nutricionistaId) {
    return null;
  }
  return paciente;
}

/** Busca pública por token — usada pela página /p/[token], sem checagem de nutricionista. */
export async function buscarPacientePorToken(token: string) {
  const paciente = await prismaNutri.paciente.findUnique({ where: { tokenAcesso: token } });
  if (!paciente || paciente.status !== StatusPaciente.ATIVO) {
    return null;
  }
  return paciente;
}

export async function buscarRegistrosDeHoje(pacienteId: string) {
  const { inicio, fim } = limitesDoDiaEmSaoPaulo();
  return prismaNutri.registroRefeicao.findMany({
    where: { pacienteId, registradoEm: { gte: inicio, lt: fim } },
    orderBy: { registradoEm: "asc" },
  });
}

export async function buscarHistoricoDePeso(pacienteId: string, dias = 90) {
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  return prismaNutri.registroMedida.findMany({
    where: { pacienteId, registradoEm: { gte: desde } },
    orderBy: { registradoEm: "asc" },
  });
}

export async function buscarAnotacoes(pacienteId: string) {
  return prismaNutri.anotacaoPaciente.findMany({ where: { pacienteId }, orderBy: { criadoEm: "desc" } });
}

export async function buscarFavoritos(pacienteId: string) {
  return prismaNutri.refeicaoFavorita.findMany({ where: { pacienteId }, orderBy: { criadoEm: "desc" } });
}

export interface DiaDoHistorico {
  diaChave: string;
  saldo: SaldoDoDia;
  totalRegistros: number;
}

const CHAVE_DIA_SAO_PAULO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });

/**
 * Últimos N dias-calendário (em America/Sao_Paulo) com registro, cada um
 * com o saldo daquele dia contra as metas atuais do paciente. Agrupa em
 * memória em vez de no banco porque SQLite não tem conversão de fuso — e o
 * volume por paciente aqui é pequeno (algumas dezenas de registros).
 */
export async function buscarHistoricoDeDias(pacienteId: string, dias = 14): Promise<DiaDoHistorico[]> {
  const paciente = await prismaNutri.paciente.findUnique({ where: { id: pacienteId } });
  if (!paciente) {
    return [];
  }

  const { inicio: inicioHoje } = limitesDoDiaEmSaoPaulo();
  const desde = new Date(inicioHoje.getTime() - (dias - 1) * 24 * 60 * 60 * 1000);
  const registros = await prismaNutri.registroRefeicao.findMany({
    where: { pacienteId, registradoEm: { gte: desde } },
    orderBy: { registradoEm: "desc" },
  });

  const porDia = new Map<string, typeof registros>();
  for (const registro of registros) {
    const chave = CHAVE_DIA_SAO_PAULO.format(registro.registradoEm);
    const lista = porDia.get(chave);
    if (lista) {
      lista.push(registro);
    } else {
      porDia.set(chave, [registro]);
    }
  }

  return Array.from(porDia.entries()).map(([diaChave, registrosDoDia]) => ({
    diaChave,
    saldo: calcularSaldoDoDia(registrosDoDia, paciente),
    totalRegistros: registrosDoDia.length,
  }));
}

export interface PacienteComAderencia {
  paciente: Paciente;
  saldoHoje: SaldoDoDia;
  saldoSemana: SaldoDoDia;
  foraDaMeta: boolean;
  diasSemRegistro: number | null;
}

/** Painel de aderência do nutricionista: cada paciente ativo com % da meta batida hoje/semana. */
export async function buscarPacientesComAderencia(nutricionistaId: string): Promise<PacienteComAderencia[]> {
  const pacientes = await buscarPacientesDoNutricionista(nutricionistaId);
  const { inicio: inicioHoje, fim: fimHoje } = limitesDoDiaEmSaoPaulo();
  const { inicio: inicioSemana, diasDecorridos } = limitesDaSemanaEmSaoPaulo();

  return Promise.all(
    pacientes.map(async (paciente) => {
      const [registrosHoje, registrosSemana, ultimoRegistro] = await Promise.all([
        prismaNutri.registroRefeicao.findMany({
          where: { pacienteId: paciente.id, registradoEm: { gte: inicioHoje, lt: fimHoje } },
        }),
        prismaNutri.registroRefeicao.findMany({
          where: { pacienteId: paciente.id, registradoEm: { gte: inicioSemana, lt: fimHoje } },
        }),
        prismaNutri.registroRefeicao.findFirst({
          where: { pacienteId: paciente.id },
          orderBy: { registradoEm: "desc" },
        }),
      ]);

      const saldoHoje = calcularSaldoDoDia(registrosHoje, paciente);
      const saldoSemana = calcularAderenciaSemana(registrosSemana, paciente, diasDecorridos);
      const diasSemRegistro = ultimoRegistro
        ? Math.floor((Date.now() - ultimoRegistro.registradoEm.getTime()) / (24 * 60 * 60 * 1000))
        : null;

      return {
        paciente,
        saldoHoje,
        saldoSemana,
        foraDaMeta: estaForaDaMeta(saldoHoje.kcal.percentual),
        diasSemRegistro,
      };
    }),
  );
}
