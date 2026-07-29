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

/**
 * Busca o paciente ATIVO e com consentimento dado a partir do token —
 * porta de entrada comum das ações abaixo, que o próprio paciente
 * dispara. Sem consentimento LGPD, nada é gravado.
 */
async function pacienteAutorizadoPorToken(token: string) {
  const paciente = await prismaNutri.paciente.findUnique({ where: { tokenAcesso: token } });
  if (!paciente || paciente.status !== StatusPaciente.ATIVO || !paciente.consentimentoEm) {
    return null;
  }
  return paciente;
}

const registrarPesoSchema = z.object({
  token: z.string().min(1),
  pesoKg: z.coerce.number().positive("peso deve ser positivo").max(500, "peso fora do intervalo esperado"),
});

/** Peso auto-relatado pelo paciente — vira gráfico de evolução pro nutricionista. */
export async function registrarPeso(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = registrarPesoSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "payload inválido" };
  }

  const paciente = await pacienteAutorizadoPorToken(parsed.data.token);
  if (!paciente) {
    return { sucesso: false, erro: "paciente não encontrado" };
  }

  await prismaNutri.registroMedida.create({ data: { pacienteId: paciente.id, pesoKg: parsed.data.pesoKg } });

  revalidatePath(`/p/${parsed.data.token}`);
  return { sucesso: true };
}

const favoritoSchema = z.object({
  token: z.string().min(1),
  descricao: z.string().trim().min(1, "descreva a refeição"),
});

/** Atalho de conveniência: guarda uma descrição de refeição pra reusar depois. */
export async function salvarFavorito(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = favoritoSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "payload inválido" };
  }

  const paciente = await pacienteAutorizadoPorToken(parsed.data.token);
  if (!paciente) {
    return { sucesso: false, erro: "paciente não encontrado" };
  }

  await prismaNutri.refeicaoFavorita.create({
    data: { pacienteId: paciente.id, descricao: parsed.data.descricao },
  });

  revalidatePath(`/p/${parsed.data.token}`);
  return { sucesso: true };
}

const removerFavoritoSchema = z.object({
  token: z.string().min(1),
  favoritoId: z.string().min(1),
});

/**
 * Favorito é atalho de conveniência, não registro de negócio/auditoria —
 * ao contrário de RegistroRefeicao, pode ser apagado de verdade.
 */
export async function removerFavorito(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = removerFavoritoSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "payload inválido" };
  }

  const paciente = await pacienteAutorizadoPorToken(parsed.data.token);
  if (!paciente) {
    return { sucesso: false, erro: "paciente não encontrado" };
  }

  // deleteMany com pacienteId no filtro: garante que um token não apaga
  // favorito de outro paciente mesmo se o id for adivinhado.
  await prismaNutri.refeicaoFavorita.deleteMany({
    where: { id: parsed.data.favoritoId, pacienteId: paciente.id },
  });

  revalidatePath(`/p/${parsed.data.token}`);
  return { sucesso: true };
}
