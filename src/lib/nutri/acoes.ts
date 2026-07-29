"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prismaNutri } from "@/lib/nutri/prisma";
import { Capacidade, exigirCapacidade } from "@/lib/profissional/auth";
import { obterDonoLegadoNutricao } from "@/lib/profissional/donos-legados";
import {
  StatusPaciente,
  criarPacienteSchema,
  atualizarMetasSchema,
  pacienteIdSchema,
  anotacaoSchema,
} from "@/lib/nutri/schemas";

export type ResultadoAcaoNutri = { sucesso: true } | { sucesso: false; erro: string };
export type ResultadoToken = { sucesso: true; token: string } | { sucesso: false; erro: string };

function gerarTokenAcesso(): string {
  return randomBytes(24).toString("hex");
}

/**
 * Confere que o paciente pertence ao profissional logado antes de deixar
 * mexer nele — sem isso, um profissional logado conseguiria editar/arquivar
 * paciente de outro só sabendo o id.
 */
async function buscarPacienteDoProfissional(pacienteId: string, profissionalId: string) {
  const paciente = await prismaNutri.paciente.findUnique({ where: { id: pacienteId } });
  if (!paciente || paciente.profissionalId !== profissionalId) {
    return null;
  }
  return paciente;
}

/**
 * Cria paciente + metas + token de acesso. Enforce aqui o limite do plano
 * demo (R$ 99,90/20 pacientes) — sem gateway de pagamento, só a contagem de
 * pacientes ATIVOs (um paciente ARQUIVADO não ocupa vaga).
 */
export async function criarPaciente(input: unknown): Promise<ResultadoAcaoNutri> {
  const parsed = criarPacienteSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "payload inválido" };
  }

  const profissional = await exigirCapacidade(Capacidade.NUTRICAO);

  const totalAtivos = await prismaNutri.paciente.count({
    where: { profissionalId: profissional.id, status: StatusPaciente.ATIVO },
  });
  if (totalAtivos >= profissional.limitePlano) {
    return {
      sucesso: false,
      erro: `limite de ${profissional.limitePlano} pacientes do plano atingido — arquive alguém antes de cadastrar outro`,
    };
  }

  await prismaNutri.paciente.create({
    data: {
      profissionalId: profissional.id,
      nutricionistaId: await obterDonoLegadoNutricao(),
      nome: parsed.data.nome,
      telefone: parsed.data.telefone || null,
      tokenAcesso: gerarTokenAcesso(),
      metaKcal: parsed.data.metaKcal,
      metaProteina: parsed.data.metaProteina,
      metaCarbo: parsed.data.metaCarbo,
      metaGordura: parsed.data.metaGordura,
    },
  });

  revalidatePath("/app");
  return { sucesso: true };
}

export async function atualizarMetas(input: unknown): Promise<ResultadoAcaoNutri> {
  const parsed = atualizarMetasSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "payload inválido" };
  }

  const profissional = await exigirCapacidade(Capacidade.NUTRICAO);
  const paciente = await buscarPacienteDoProfissional(parsed.data.pacienteId, profissional.id);
  if (!paciente) {
    return { sucesso: false, erro: "paciente não encontrado" };
  }

  await prismaNutri.paciente.update({
    where: { id: paciente.id },
    data: {
      metaKcal: parsed.data.metaKcal,
      metaProteina: parsed.data.metaProteina,
      metaCarbo: parsed.data.metaCarbo,
      metaGordura: parsed.data.metaGordura,
    },
  });

  revalidatePath(`/app/pacientes/${paciente.id}`);
  revalidatePath("/app");
  return { sucesso: true };
}

/** Revoga o link atual do paciente e gera um novo — usar se o link vazou. */
export async function regenerarTokenPaciente(input: unknown): Promise<ResultadoToken> {
  const parsed = pacienteIdSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "payload inválido" };
  }

  const profissional = await exigirCapacidade(Capacidade.NUTRICAO);
  const paciente = await buscarPacienteDoProfissional(parsed.data.pacienteId, profissional.id);
  if (!paciente) {
    return { sucesso: false, erro: "paciente não encontrado" };
  }

  const token = gerarTokenAcesso();
  await prismaNutri.paciente.update({ where: { id: paciente.id }, data: { tokenAcesso: token } });

  revalidatePath(`/app/pacientes/${paciente.id}`);
  return { sucesso: true, token };
}

/**
 * Arquiva o paciente (nunca exclusão física — ver CLAUDE.md). Um paciente
 * arquivado libera a vaga do plano mas continua com o link antigo
 * funcionando por padrão de segurança dos dados, não é o foco deste MVP
 * bloquear o acesso dele.
 */
export async function arquivarPaciente(input: unknown): Promise<ResultadoAcaoNutri> {
  const parsed = pacienteIdSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "payload inválido" };
  }

  const profissional = await exigirCapacidade(Capacidade.NUTRICAO);
  const paciente = await buscarPacienteDoProfissional(parsed.data.pacienteId, profissional.id);
  if (!paciente) {
    return { sucesso: false, erro: "paciente não encontrado" };
  }

  await prismaNutri.paciente.update({ where: { id: paciente.id }, data: { status: StatusPaciente.ARQUIVADO } });

  revalidatePath("/app");
  return { sucesso: true };
}

/**
 * Anotação privada do nutricionista sobre o paciente. Só-adição: não tem
 * editar nem apagar de propósito — observação de consulta é registro
 * histórico, mesmo espírito de auditoria do resto do domínio.
 */
export async function adicionarAnotacao(input: unknown): Promise<ResultadoAcaoNutri> {
  const parsed = anotacaoSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "payload inválido" };
  }

  const profissional = await exigirCapacidade(Capacidade.NUTRICAO);
  const paciente = await buscarPacienteDoProfissional(parsed.data.pacienteId, profissional.id);
  if (!paciente) {
    return { sucesso: false, erro: "paciente não encontrado" };
  }

  await prismaNutri.anotacaoPaciente.create({ data: { pacienteId: paciente.id, texto: parsed.data.texto } });

  revalidatePath(`/app/pacientes/${paciente.id}`);
  return { sucesso: true };
}
