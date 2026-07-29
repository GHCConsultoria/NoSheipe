"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prismaNutri } from "@/lib/nutri/prisma";
import { Capacidade, exigirCapacidade } from "@/lib/profissional/auth";
import { obterDonoLegadoTreino } from "@/lib/profissional/donos-legados";
import { StatusAluno, criarAlunoSchema, treinoSchema, alunoIdSchema } from "@/lib/personal/schemas";

export type ResultadoAcaoPersonal = { sucesso: true } | { sucesso: false; erro: string };
export type ResultadoToken = { sucesso: true; token: string } | { sucesso: false; erro: string };

function gerarTokenAcesso(): string {
  return randomBytes(24).toString("hex");
}

/**
 * Confere que o aluno pertence ao profissional logado antes de deixar mexer
 * nele — mesmo cuidado de buscarPacienteDoProfissional em
 * src/lib/nutri/acoes.ts.
 */
async function buscarAlunoDoProfissional(alunoId: string, profissionalId: string) {
  const aluno = await prismaNutri.aluno.findUnique({ where: { id: alunoId } });
  if (!aluno || aluno.profissionalId !== profissionalId) {
    return null;
  }
  return aluno;
}

/** Cria aluno + token de acesso. Enforce o limite do plano demo, mesmo padrão de criarPaciente. */
export async function criarAluno(input: unknown): Promise<ResultadoAcaoPersonal> {
  const parsed = criarAlunoSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "payload inválido" };
  }

  const profissional = await exigirCapacidade(Capacidade.TREINO);

  const totalAtivos = await prismaNutri.aluno.count({
    where: { profissionalId: profissional.id, status: StatusAluno.ATIVO },
  });
  if (totalAtivos >= profissional.limitePlano) {
    return {
      sucesso: false,
      erro: `limite de ${profissional.limitePlano} alunos do plano atingido — arquive alguém antes de cadastrar outro`,
    };
  }

  await prismaNutri.aluno.create({
    data: {
      profissionalId: profissional.id,
      personalTrainerId: await obterDonoLegadoTreino(),
      nome: parsed.data.nome,
      telefone: parsed.data.telefone || null,
      tokenAcesso: gerarTokenAcesso(),
    },
  });

  revalidatePath("/app");
  return { sucesso: true };
}

/**
 * Cria um novo treino ativo pro aluno e desativa o anterior (histórico
 * fica preservado, nunca exclusão física — mesmo princípio do resto do
 * domínio).
 */
export async function atualizarTreino(input: unknown): Promise<ResultadoAcaoPersonal> {
  const parsed = treinoSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "payload inválido" };
  }

  const profissional = await exigirCapacidade(Capacidade.TREINO);
  const aluno = await buscarAlunoDoProfissional(parsed.data.alunoId, profissional.id);
  if (!aluno) {
    return { sucesso: false, erro: "aluno não encontrado" };
  }

  await prismaNutri.$transaction([
    prismaNutri.treino.updateMany({ where: { alunoId: aluno.id, ativo: true }, data: { ativo: false } }),
    prismaNutri.treino.create({
      data: {
        alunoId: aluno.id,
        nome: parsed.data.nome,
        descricao: parsed.data.descricao,
        diasPorSemana: parsed.data.diasPorSemana,
      },
    }),
  ]);

  revalidatePath(`/app/alunos/${aluno.id}`);
  revalidatePath("/app");
  return { sucesso: true };
}

/** Revoga o link atual do aluno e gera um novo — usar se o link vazou. */
export async function regenerarTokenAluno(input: unknown): Promise<ResultadoToken> {
  const parsed = alunoIdSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "payload inválido" };
  }

  const profissional = await exigirCapacidade(Capacidade.TREINO);
  const aluno = await buscarAlunoDoProfissional(parsed.data.alunoId, profissional.id);
  if (!aluno) {
    return { sucesso: false, erro: "aluno não encontrado" };
  }

  const token = gerarTokenAcesso();
  await prismaNutri.aluno.update({ where: { id: aluno.id }, data: { tokenAcesso: token } });

  revalidatePath(`/app/alunos/${aluno.id}`);
  return { sucesso: true, token };
}

/** Arquiva o aluno (nunca exclusão física). Libera a vaga do plano. */
export async function arquivarAluno(input: unknown): Promise<ResultadoAcaoPersonal> {
  const parsed = alunoIdSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "payload inválido" };
  }

  const profissional = await exigirCapacidade(Capacidade.TREINO);
  const aluno = await buscarAlunoDoProfissional(parsed.data.alunoId, profissional.id);
  if (!aluno) {
    return { sucesso: false, erro: "aluno não encontrado" };
  }

  await prismaNutri.aluno.update({ where: { id: aluno.id }, data: { status: StatusAluno.ARQUIVADO } });

  revalidatePath("/app");
  return { sucesso: true };
}
