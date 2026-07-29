"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prismaNutri } from "@/lib/nutri/prisma";
import { StatusAluno, OrigemRegistroTreino } from "@/lib/personal/schemas";

export type ResultadoAcaoPublica = { sucesso: true } | { sucesso: false; erro: string };

const tokenSchema = z.object({ token: z.string().min(1) });

const registrarTreinoSchema = z.object({
  token: z.string().min(1),
  clientLogId: z.string().uuid("clientLogId deve ser um UUID"),
  rawText: z.string().trim().min(1, "descreva o treino"),
  origem: z.nativeEnum(OrigemRegistroTreino).default(OrigemRegistroTreino.TEXTO),
});

/**
 * Ações que o próprio ALUNO dispara pela página pública /t/[token] — sem
 * login, o token opaco é a única credencial. Mesmo padrão de
 * src/lib/nutri/publico.ts.
 */
export async function aceitarConsentimentoAluno(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = tokenSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: "token inválido" };
  }

  const aluno = await prismaNutri.aluno.findUnique({ where: { tokenAcesso: parsed.data.token } });
  if (!aluno || aluno.status !== StatusAluno.ATIVO) {
    return { sucesso: false, erro: "aluno não encontrado" };
  }

  await prismaNutri.aluno.update({ where: { id: aluno.id }, data: { consentimentoEm: new Date() } });

  revalidatePath(`/t/${parsed.data.token}`);
  return { sucesso: true };
}

/**
 * Registra um treino feito — sem IA (ao contrário do registro de
 * refeição): é só um check-in de texto/áudio livre, idempotente por
 * clientLogId igual ao padrão de src/app/api/nutri/registros/route.ts.
 */
export async function registrarTreino(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = registrarTreinoSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "payload inválido" };
  }

  const aluno = await prismaNutri.aluno.findUnique({ where: { tokenAcesso: parsed.data.token } });
  if (!aluno || aluno.status !== StatusAluno.ATIVO) {
    return { sucesso: false, erro: "aluno não encontrado" };
  }
  if (!aluno.consentimentoEm) {
    return { sucesso: false, erro: "consentimento obrigatório antes de registrar" };
  }

  const existente = await prismaNutri.registroTreino.findUnique({
    where: { clienteRegistroId: parsed.data.clientLogId },
  });
  if (existente) {
    return { sucesso: true };
  }

  try {
    await prismaNutri.registroTreino.create({
      data: {
        alunoId: aluno.id,
        clienteRegistroId: parsed.data.clientLogId,
        origem: parsed.data.origem,
        entradaBruta: parsed.data.rawText,
      },
    });
  } catch (erro) {
    // Corrida entre duas requisições com o mesmo clientLogId — a unique
    // constraint pegou, o registro já existe, não é erro de verdade.
    const jaSalvo = await prismaNutri.registroTreino.findUnique({
      where: { clienteRegistroId: parsed.data.clientLogId },
    });
    if (jaSalvo) {
      return { sucesso: true };
    }
    throw erro;
  }

  revalidatePath(`/t/${parsed.data.token}`);
  return { sucesso: true };
}
