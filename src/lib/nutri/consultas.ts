import { prismaNutri } from "@/lib/nutri/prisma";
import { StatusPaciente } from "@/lib/nutri/schemas";
import { calcularSaldoDoDia, limitesDoDiaEmSaoPaulo, type SaldoDoDia } from "@/lib/nutri/aderencia";

export async function buscarPacientePorId(pacienteId: string, profissionalId: string) {
  const paciente = await prismaNutri.paciente.findUnique({ where: { id: pacienteId } });
  if (!paciente || paciente.profissionalId !== profissionalId) {
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
