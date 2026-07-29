"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prismaNutri } from "@/lib/nutri/prisma";
import { Capacidade, exigirCapacidade, obterProfissionalAtual } from "@/lib/profissional/auth";
import {
  StatusCliente,
  StatusVinculo,
  TipoVinculo,
  anotacaoSchema,
  atualizarMetasSchema,
  atualizarTreinoSchema,
  clienteIdSchema,
  criarClienteSchema,
} from "@/lib/cliente/schemas";

export type ResultadoAcao = { sucesso: true } | { sucesso: false; erro: string };
export type ResultadoToken = { sucesso: true; token: string } | { sucesso: false; erro: string };

function gerarTokenAcesso(): string {
  return randomBytes(24).toString("hex");
}

/**
 * Código curto que o cliente dita pra um profissional novo. Sem 0/O e 1/I
 * de propósito: ele vai ser lido em voz alta ou copiado à mão.
 */
function gerarCodigoConvite(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alfabeto[Math.floor(Math.random() * alfabeto.length)]).join("");
}

function dataOuNull(texto: string | undefined): Date | null {
  if (!texto) return null;
  const data = new Date(texto);
  return Number.isNaN(data.getTime()) ? null : data;
}

/**
 * Confere que o profissional tem vínculo ativo do tipo pedido com esse
 * cliente. É a regra de isolamento central: com clientes compartilhados,
 * o personal não pode ler nem escrever o lado da nutrição, e vice-versa.
 */
async function exigirVinculo(clienteId: string, profissionalId: string, tipo: TipoVinculo) {
  const vinculo = await prismaNutri.vinculo.findFirst({
    where: { clienteId, profissionalId, tipo, status: StatusVinculo.ATIVO },
  });
  if (!vinculo) return null;
  return prismaNutri.cliente.findUnique({ where: { id: clienteId } });
}

/**
 * Cria o cliente, os vínculos escolhidos e a prescrição inicial de cada
 * lado, numa transação — um cliente sem vínculo nenhum seria invisível
 * para todo mundo, inclusive para quem acabou de criá-lo.
 */
export async function criarCliente(input: unknown): Promise<ResultadoAcao> {
  const parsed = criarClienteSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "payload inválido" };
  }
  const dados = parsed.data;

  const profissional = await obterProfissionalAtual();

  // Só dá pra acompanhar o que se está habilitado a prescrever.
  if (dados.acompanhaNutricao && !profissional.ehNutricionista) {
    return { sucesso: false, erro: "sua conta não está marcada como nutricionista" };
  }
  if (dados.acompanhaTreino && !profissional.ehPersonal) {
    return { sucesso: false, erro: "sua conta não está marcada como personal trainer" };
  }

  const totalAtivos = await prismaNutri.vinculo.count({
    where: { profissionalId: profissional.id, status: StatusVinculo.ATIVO },
  });
  if (totalAtivos >= profissional.limitePlano) {
    return {
      sucesso: false,
      erro: `limite de ${profissional.limitePlano} do plano atingido — arquive alguém antes de cadastrar outro`,
    };
  }

  await prismaNutri.$transaction(async (tx) => {
    const cliente = await tx.cliente.create({
      data: {
        nome: dados.nome,
        telefone: dados.telefone ?? null,
        tokenAcesso: gerarTokenAcesso(),
        codigoConvite: gerarCodigoConvite(),
        dataNascimento: dataOuNull(dados.dataNascimento),
        sexo: dados.sexo ?? null,
        alturaCm: dados.alturaCm ?? null,
        objetivo: dados.objetivo ?? null,
      },
    });

    if (dados.acompanhaNutricao && dados.metas) {
      await tx.vinculo.create({
        data: {
          clienteId: cliente.id,
          profissionalId: profissional.id,
          tipo: TipoVinculo.NUTRICAO,
          status: StatusVinculo.ATIVO,
          aceitoEm: new Date(),
        },
      });
      await tx.planoNutricional.create({ data: { clienteId: cliente.id, ...dados.metas } });
      if (dados.anamneseNutricional) {
        await tx.anamneseNutricional.create({
          data: { clienteId: cliente.id, ...dados.anamneseNutricional },
        });
      }
    }

    if (dados.acompanhaTreino && dados.treino) {
      await tx.vinculo.create({
        data: {
          clienteId: cliente.id,
          profissionalId: profissional.id,
          tipo: TipoVinculo.TREINO,
          status: StatusVinculo.ATIVO,
          aceitoEm: new Date(),
        },
      });
      await tx.treinoPrescrito.create({ data: { clienteId: cliente.id, ...dados.treino } });
      if (dados.anamneseTreino) {
        await tx.anamneseTreino.create({ data: { clienteId: cliente.id, ...dados.anamneseTreino } });
      }
    }
  });

  revalidatePath("/pro");
  return { sucesso: true };
}

/** Nova versão do plano nutricional; a anterior fica como histórico. */
export async function atualizarMetas(input: unknown): Promise<ResultadoAcao> {
  const parsed = atualizarMetasSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "payload inválido" };
  }

  const profissional = await exigirCapacidade(Capacidade.NUTRICAO);
  const cliente = await exigirVinculo(parsed.data.clienteId, profissional.id, TipoVinculo.NUTRICAO);
  if (!cliente) return { sucesso: false, erro: "cliente não encontrado" };

  await prismaNutri.$transaction([
    prismaNutri.planoNutricional.updateMany({ where: { clienteId: cliente.id, ativo: true }, data: { ativo: false } }),
    prismaNutri.planoNutricional.create({
      data: {
        clienteId: cliente.id,
        metaKcal: parsed.data.metaKcal,
        metaProteina: parsed.data.metaProteina,
        metaCarbo: parsed.data.metaCarbo,
        metaGordura: parsed.data.metaGordura,
      },
    }),
  ]);

  revalidatePath(`/pro/clientes/${cliente.id}`);
  revalidatePath("/pro");
  return { sucesso: true };
}

/** Novo treino ativo; o anterior fica como histórico. */
export async function atualizarTreino(input: unknown): Promise<ResultadoAcao> {
  const parsed = atualizarTreinoSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "payload inválido" };
  }

  const profissional = await exigirCapacidade(Capacidade.TREINO);
  const cliente = await exigirVinculo(parsed.data.clienteId, profissional.id, TipoVinculo.TREINO);
  if (!cliente) return { sucesso: false, erro: "cliente não encontrado" };

  await prismaNutri.$transaction([
    prismaNutri.treinoPrescrito.updateMany({ where: { clienteId: cliente.id, ativo: true }, data: { ativo: false } }),
    prismaNutri.treinoPrescrito.create({
      data: {
        clienteId: cliente.id,
        nome: parsed.data.nome,
        descricao: parsed.data.descricao,
        diasPorSemana: parsed.data.diasPorSemana,
      },
    }),
  ]);

  revalidatePath(`/pro/clientes/${cliente.id}`);
  revalidatePath("/pro");
  return { sucesso: true };
}

/** Revoga o link atual do cliente e gera outro — usar se o link vazou. */
export async function regenerarToken(input: unknown): Promise<ResultadoToken> {
  const parsed = clienteIdSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "payload inválido" };
  }

  const profissional = await obterProfissionalAtual();
  const vinculo = await prismaNutri.vinculo.findFirst({
    where: { clienteId: parsed.data.clienteId, profissionalId: profissional.id, status: StatusVinculo.ATIVO },
  });
  if (!vinculo) return { sucesso: false, erro: "cliente não encontrado" };

  const token = gerarTokenAcesso();
  await prismaNutri.cliente.update({ where: { id: parsed.data.clienteId }, data: { tokenAcesso: token } });

  revalidatePath(`/pro/clientes/${parsed.data.clienteId}`);
  return { sucesso: true, token };
}

/**
 * Encerra o vínculo deste profissional com o cliente — não apaga o
 * cliente, que pode continuar com outro profissional. Só arquiva a pessoa
 * quando não sobrou nenhum vínculo ativo.
 */
export async function arquivarCliente(input: unknown): Promise<ResultadoAcao> {
  const parsed = clienteIdSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "payload inválido" };
  }

  const profissional = await obterProfissionalAtual();
  const meus = await prismaNutri.vinculo.findMany({
    where: { clienteId: parsed.data.clienteId, profissionalId: profissional.id, status: StatusVinculo.ATIVO },
  });
  if (meus.length === 0) return { sucesso: false, erro: "cliente não encontrado" };

  await prismaNutri.vinculo.updateMany({
    where: { id: { in: meus.map((v) => v.id) } },
    data: { status: StatusVinculo.ENCERRADO },
  });

  const restantes = await prismaNutri.vinculo.count({
    where: { clienteId: parsed.data.clienteId, status: StatusVinculo.ATIVO },
  });
  if (restantes === 0) {
    await prismaNutri.cliente.update({
      where: { id: parsed.data.clienteId },
      data: { status: StatusCliente.ARQUIVADO },
    });
  }

  revalidatePath("/pro");
  return { sucesso: true };
}

/**
 * Anotação privada. Guarda profissionalId porque, com cliente
 * compartilhado, a anotação de um não pode aparecer pro outro.
 */
export async function adicionarAnotacao(input: unknown): Promise<ResultadoAcao> {
  const parsed = anotacaoSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "payload inválido" };
  }

  const profissional = await obterProfissionalAtual();
  const vinculo = await prismaNutri.vinculo.findFirst({
    where: { clienteId: parsed.data.clienteId, profissionalId: profissional.id, status: StatusVinculo.ATIVO },
  });
  if (!vinculo) return { sucesso: false, erro: "cliente não encontrado" };

  await prismaNutri.anotacao.create({
    data: { clienteId: parsed.data.clienteId, profissionalId: profissional.id, texto: parsed.data.texto },
  });

  revalidatePath(`/pro/clientes/${parsed.data.clienteId}`);
  return { sucesso: true };
}
