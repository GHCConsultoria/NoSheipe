"use server";

import { revalidatePath } from "next/cache";
import { prismaNutri } from "@/lib/nutri/prisma";
import {
  StatusCliente,
  favoritoSchema,
  registrarPesoSchema,
  registrarSchema,
  removerFavoritoSchema,
  tokenSchema,
} from "@/lib/cliente/schemas";

export type ResultadoAcaoPublica = { sucesso: true } | { sucesso: false; erro: string };

/**
 * Ações que o próprio CLIENTE dispara pela página /p/[token]. Sem login: o
 * token opaco é a única credencial, então toda função resolve o cliente a
 * partir dele e nunca aceita um id vindo de fora.
 */
async function clientePeloToken(token: string) {
  const cliente = await prismaNutri.cliente.findUnique({ where: { tokenAcesso: token } });
  if (!cliente || cliente.status !== StatusCliente.ATIVO) return null;
  return cliente;
}

export async function aceitarConsentimento(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = tokenSchema.safeParse(input);
  if (!parsed.success) return { sucesso: false, erro: "token inválido" };

  const cliente = await clientePeloToken(parsed.data.token);
  if (!cliente) return { sucesso: false, erro: "cliente não encontrado" };

  await prismaNutri.cliente.update({ where: { id: cliente.id }, data: { consentimentoEm: new Date() } });

  revalidatePath(`/p/${parsed.data.token}`);
  return { sucesso: true };
}

/** Peso auto-relatado — vira o gráfico de evolução na visão do profissional. */
export async function registrarPeso(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = registrarPesoSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "peso inválido" };
  }

  const cliente = await clientePeloToken(parsed.data.token);
  if (!cliente) return { sucesso: false, erro: "cliente não encontrado" };
  if (!cliente.consentimentoEm) return { sucesso: false, erro: "consentimento obrigatório antes de registrar" };

  await prismaNutri.medida.create({ data: { clienteId: cliente.id, pesoKg: parsed.data.pesoKg } });

  revalidatePath(`/p/${parsed.data.token}`);
  return { sucesso: true };
}

/**
 * Check-in de treino. Sem IA, ao contrário da refeição: é texto livre e o
 * que importa é a frequência. Idempotente por clientLogId.
 */
export async function registrarTreino(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = registrarSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "payload inválido" };
  }

  const cliente = await clientePeloToken(parsed.data.token);
  if (!cliente) return { sucesso: false, erro: "cliente não encontrado" };
  if (!cliente.consentimentoEm) return { sucesso: false, erro: "consentimento obrigatório antes de registrar" };

  const existente = await prismaNutri.sessaoTreino.findUnique({
    where: { clienteRegistroId: parsed.data.clientLogId },
  });
  if (existente) return { sucesso: true };

  try {
    await prismaNutri.sessaoTreino.create({
      data: {
        clienteId: cliente.id,
        clienteRegistroId: parsed.data.clientLogId,
        origem: parsed.data.origem,
        entradaBruta: parsed.data.rawText,
      },
    });
  } catch (erro) {
    // Corrida entre dois envios com o mesmo clientLogId (duplo clique):
    // a unique constraint pegou, então já está salvo.
    const jaSalvo = await prismaNutri.sessaoTreino.findUnique({
      where: { clienteRegistroId: parsed.data.clientLogId },
    });
    if (jaSalvo) return { sucesso: true };
    throw erro;
  }

  revalidatePath(`/p/${parsed.data.token}`);
  return { sucesso: true };
}

export async function salvarFavorito(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = favoritoSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "descrição inválida" };
  }

  const cliente = await clientePeloToken(parsed.data.token);
  if (!cliente) return { sucesso: false, erro: "cliente não encontrado" };

  const jaExiste = await prismaNutri.favorito.findFirst({
    where: { clienteId: cliente.id, descricao: parsed.data.descricao },
  });
  if (!jaExiste) {
    await prismaNutri.favorito.create({ data: { clienteId: cliente.id, descricao: parsed.data.descricao } });
  }

  revalidatePath(`/p/${parsed.data.token}`);
  return { sucesso: true };
}

/** Favorito é atalho de conveniência, não registro de negócio — pode sumir de verdade. */
export async function removerFavorito(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = removerFavoritoSchema.safeParse(input);
  if (!parsed.success) return { sucesso: false, erro: "payload inválido" };

  const cliente = await clientePeloToken(parsed.data.token);
  if (!cliente) return { sucesso: false, erro: "cliente não encontrado" };

  // deleteMany com clienteId no filtro: sem isso, saber um favoritoId de
  // outra pessoa bastaria pra apagá-lo.
  await prismaNutri.favorito.deleteMany({ where: { id: parsed.data.favoritoId, clienteId: cliente.id } });

  revalidatePath(`/p/${parsed.data.token}`);
  return { sucesso: true };
}
