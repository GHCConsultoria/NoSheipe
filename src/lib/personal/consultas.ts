import type { Aluno } from "../../../prisma/nutri/generated";
import { prismaNutri } from "@/lib/nutri/prisma";
import { StatusAluno } from "@/lib/personal/schemas";
import {
  calcularAderenciaTreino,
  estaForaDoTreino,
  limitesDaSemanaEmSaoPaulo,
  limitesDoDiaEmSaoPaulo,
  type AderenciaTreino,
} from "@/lib/personal/aderencia";

export async function buscarAlunosDoPersonalTrainer(personalTrainerId: string) {
  return prismaNutri.aluno.findMany({
    where: { personalTrainerId, status: StatusAluno.ATIVO },
    orderBy: { criadoEm: "desc" },
  });
}

export async function buscarAlunoPorId(alunoId: string, personalTrainerId: string) {
  const aluno = await prismaNutri.aluno.findUnique({ where: { id: alunoId } });
  if (!aluno || aluno.personalTrainerId !== personalTrainerId) {
    return null;
  }
  return aluno;
}

/** Busca pública por token — usada pela página /t/[token], sem checagem de personal trainer. */
export async function buscarAlunoPorToken(token: string) {
  const aluno = await prismaNutri.aluno.findUnique({ where: { tokenAcesso: token } });
  if (!aluno || aluno.status !== StatusAluno.ATIVO) {
    return null;
  }
  return aluno;
}

export async function buscarTreinoAtivo(alunoId: string) {
  return prismaNutri.treino.findFirst({ where: { alunoId, ativo: true }, orderBy: { criadoEm: "desc" } });
}

export async function buscarRegistrosDeHoje(alunoId: string) {
  const { inicio, fim } = limitesDoDiaEmSaoPaulo();
  return prismaNutri.registroTreino.findMany({
    where: { alunoId, realizadoEm: { gte: inicio, lt: fim } },
    orderBy: { realizadoEm: "asc" },
  });
}

export interface AlunoComAderencia {
  aluno: Aluno;
  treinoAtivo: { nome: string; diasPorSemana: number } | null;
  aderenciaSemana: AderenciaTreino | null;
  foraDoTreino: boolean;
  diasSemRegistro: number | null;
}

/** Painel de aderência do personal: cada aluno ativo com % de dias treinados na semana. */
export async function buscarAlunosComAderencia(personalTrainerId: string): Promise<AlunoComAderencia[]> {
  const alunos = await buscarAlunosDoPersonalTrainer(personalTrainerId);
  const { inicio: inicioSemana, fim: fimSemana } = limitesDaSemanaEmSaoPaulo();

  return Promise.all(
    alunos.map(async (aluno) => {
      const treinoAtivo = await buscarTreinoAtivo(aluno.id);
      const registrosSemana = await prismaNutri.registroTreino.findMany({
        where: { alunoId: aluno.id, realizadoEm: { gte: inicioSemana, lt: fimSemana } },
      });
      const ultimoRegistro = await prismaNutri.registroTreino.findFirst({
        where: { alunoId: aluno.id },
        orderBy: { realizadoEm: "desc" },
      });

      const aderenciaSemana = treinoAtivo ? calcularAderenciaTreino(registrosSemana, treinoAtivo.diasPorSemana) : null;
      const diasSemRegistro = ultimoRegistro
        ? Math.floor((Date.now() - ultimoRegistro.realizadoEm.getTime()) / (24 * 60 * 60 * 1000))
        : null;

      return {
        aluno,
        treinoAtivo: treinoAtivo ? { nome: treinoAtivo.nome, diasPorSemana: treinoAtivo.diasPorSemana } : null,
        aderenciaSemana,
        foraDoTreino: aderenciaSemana ? estaForaDoTreino(aderenciaSemana.percentual) : false,
        diasSemRegistro,
      };
    }),
  );
}
