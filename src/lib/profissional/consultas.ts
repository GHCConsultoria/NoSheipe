import type { Paciente, Aluno } from "../../../prisma/nutri/generated";
import { prismaNutri } from "@/lib/nutri/prisma";
import { StatusPaciente } from "@/lib/nutri/schemas";
import { StatusAluno } from "@/lib/personal/schemas";
import {
  calcularAderenciaSemana,
  calcularSaldoDoDia,
  estaForaDaMeta,
  estaSemRegistroHaMuitoTempo,
  limitesDaSemanaEmSaoPaulo,
  limitesDoDiaEmSaoPaulo,
  type SaldoDoDia,
} from "@/lib/nutri/aderencia";
import { calcularAderenciaTreino, estaForaDoTreino, type AderenciaTreino } from "@/lib/personal/aderencia";

function diasDesde(data: Date | null | undefined): number | null {
  if (!data) return null;
  return Math.floor((Date.now() - data.getTime()) / (24 * 60 * 60 * 1000));
}

export interface PacienteComAderencia {
  paciente: Paciente;
  saldoHoje: SaldoDoDia;
  saldoSemana: SaldoDoDia;
  foraDaMeta: boolean;
  diasSemRegistro: number | null;
  sumido: boolean;
}

export interface AlunoComAderencia {
  aluno: Aluno;
  treinoAtivo: { nome: string; diasPorSemana: number } | null;
  aderenciaSemana: AderenciaTreino | null;
  foraDoTreino: boolean;
  diasSemRegistro: number | null;
  sumido: boolean;
}

/**
 * Pacientes do profissional com a aderência nutricional — mesma lógica que
 * vivia em src/lib/nutri/consultas.ts, agora filtrando por `profissionalId`
 * (o dono unificado) em vez de `nutricionistaId`.
 */
export async function buscarPacientesComAderencia(profissionalId: string): Promise<PacienteComAderencia[]> {
  const pacientes = await prismaNutri.paciente.findMany({
    where: { profissionalId, status: StatusPaciente.ATIVO },
    orderBy: { criadoEm: "desc" },
  });

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
      const diasSemRegistro = diasDesde(ultimoRegistro?.registradoEm);

      return {
        paciente,
        saldoHoje,
        saldoSemana,
        foraDaMeta: estaForaDaMeta(saldoHoje.kcal.percentual),
        diasSemRegistro,
        sumido: estaSemRegistroHaMuitoTempo(diasSemRegistro),
      };
    }),
  );
}

/**
 * Alunos do profissional com a aderência de treino — mesma lógica que vivia
 * em src/lib/personal/consultas.ts, filtrando por `profissionalId`.
 */
export async function buscarAlunosComAderencia(profissionalId: string): Promise<AlunoComAderencia[]> {
  const alunos = await prismaNutri.aluno.findMany({
    where: { profissionalId, status: StatusAluno.ATIVO },
    orderBy: { criadoEm: "desc" },
  });

  const { inicio: inicioSemana, fim: fimSemana } = limitesDaSemanaEmSaoPaulo();

  return Promise.all(
    alunos.map(async (aluno) => {
      const [treinoAtivo, registrosSemana, ultimoRegistro] = await Promise.all([
        prismaNutri.treino.findFirst({ where: { alunoId: aluno.id, ativo: true }, orderBy: { criadoEm: "desc" } }),
        prismaNutri.registroTreino.findMany({
          where: { alunoId: aluno.id, realizadoEm: { gte: inicioSemana, lt: fimSemana } },
        }),
        prismaNutri.registroTreino.findFirst({
          where: { alunoId: aluno.id },
          orderBy: { realizadoEm: "desc" },
        }),
      ]);

      const aderenciaSemana = treinoAtivo ? calcularAderenciaTreino(registrosSemana, treinoAtivo.diasPorSemana) : null;
      const diasSemRegistro = diasDesde(ultimoRegistro?.realizadoEm);

      return {
        aluno,
        treinoAtivo: treinoAtivo ? { nome: treinoAtivo.nome, diasPorSemana: treinoAtivo.diasPorSemana } : null,
        aderenciaSemana,
        foraDoTreino: aderenciaSemana ? estaForaDoTreino(aderenciaSemana.percentual) : false,
        diasSemRegistro,
        sumido: estaSemRegistroHaMuitoTempo(diasSemRegistro),
      };
    }),
  );
}

/** Quantos pacientes/alunos ativos o profissional tem, pra trava do plano. */
export async function contarClientesAtivos(profissionalId: string): Promise<number> {
  const [pacientes, alunos] = await Promise.all([
    prismaNutri.paciente.count({ where: { profissionalId, status: StatusPaciente.ATIVO } }),
    prismaNutri.aluno.count({ where: { profissionalId, status: StatusAluno.ATIVO } }),
  ]);
  return pacientes + alunos;
}
