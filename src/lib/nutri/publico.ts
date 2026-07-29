"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prismaNutri } from "@/lib/nutri/prisma";
import { StatusPaciente } from "@/lib/nutri/schemas";

export type ResultadoAcaoPublica = { sucesso: true } | { sucesso: false; erro: string };

const tokenSchema = z.object({ token: z.string().min(1) });

/**
 * Ações que o próprio PACIENTE dispara pela página pública /p/[token] — sem
 * login, o token opaco é a única credencial. Nunca confiar em nada além do
 * token pra identificar de quem é o paciente.
 */
export async function aceitarConsentimentoPaciente(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = tokenSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: "token inválido" };
  }

  const paciente = await prismaNutri.paciente.findUnique({ where: { tokenAcesso: parsed.data.token } });
  if (!paciente || paciente.status !== StatusPaciente.ATIVO) {
    return { sucesso: false, erro: "paciente não encontrado" };
  }

  await prismaNutri.paciente.update({ where: { id: paciente.id }, data: { consentimentoEm: new Date() } });

  revalidatePath(`/p/${parsed.data.token}`);
  return { sucesso: true };
}
