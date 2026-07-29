import { prismaNutri } from "@/lib/nutri/prisma";
import { StatusAluno } from "@/lib/personal/schemas";
import { limitesDoDiaEmSaoPaulo } from "@/lib/personal/aderencia";

export async function buscarAlunoPorId(alunoId: string, profissionalId: string) {
  const aluno = await prismaNutri.aluno.findUnique({ where: { id: alunoId } });
  if (!aluno || aluno.profissionalId !== profissionalId) {
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
