"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prismaNutri } from "@/lib/nutri/prisma";
import { Capacidade, exigirCapacidade, obterProfissionalAtual } from "@/lib/profissional/auth";
import { buscarComparacaoSemanas } from "@/lib/profissional/consultas";
import { pushConfigurado, enviarPush } from "@/lib/push/webpush";
import {
  gerarRelatorioEvolucao,
  IaNaoConfiguradaError,
  IaIndisponivelError,
  type DadosRelatorio,
} from "@/lib/profissional/relatorio";
import {
  StatusCliente,
  StatusVinculo,
  TipoVinculo,
  anotacaoSchema,
  atualizarMetasSchema,
  atualizarTreinoSchema,
  clienteIdSchema,
  criarClienteSchema,
  criarOfertaSchema,
  recadoSchema,
  removerOfertaSchema,
  removerTemplateSchema,
  salvarExerciciosSchema,
  solicitarVinculoSchema,
  templateNutricaoSchema,
  templateTreinoSchema,
} from "@/lib/cliente/schemas";

export type ResultadoAcao = { sucesso: true } | { sucesso: false; erro: string };
export type ResultadoToken = { sucesso: true; token: string } | { sucesso: false; erro: string };
export type ResultadoRelatorio = { sucesso: true; texto: string } | { sucesso: false; erro: string };
/** Devolve o nome pra quem pediu confirmar que digitou o código certo. */
export type ResultadoSolicitacao = { sucesso: true; nome: string } | { sucesso: false; erro: string };

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

/**
 * Um profissional pede pra acompanhar um cliente que já existe, usando o
 * código que o próprio cliente passou pra ele.
 *
 * O vínculo nasce PENDENTE: quem libera é o cliente, na página dele. Dado
 * de saúde é dele, então a decisão de compartilhar também — nenhum
 * profissional entra sozinho na ficha de ninguém.
 */
export async function solicitarVinculo(input: unknown): Promise<ResultadoSolicitacao> {
  const parsed = solicitarVinculoSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "payload inválido" };
  }
  const { codigoConvite, tipo } = parsed.data;

  // TipoVinculo e Capacidade compartilham os mesmos valores de propósito.
  const profissional = await exigirCapacidade(
    tipo === TipoVinculo.NUTRICAO ? Capacidade.NUTRICAO : Capacidade.TREINO,
  );

  const totalAtivos = await prismaNutri.vinculo.count({
    where: { profissionalId: profissional.id, status: StatusVinculo.ATIVO },
  });
  if (totalAtivos >= profissional.limitePlano) {
    return {
      sucesso: false,
      erro: `limite de ${profissional.limitePlano} do plano atingido — encerre um acompanhamento antes`,
    };
  }

  const cliente = await prismaNutri.cliente.findUnique({ where: { codigoConvite } });
  if (!cliente || cliente.status !== StatusCliente.ATIVO) {
    return { sucesso: false, erro: "código não encontrado — confira com o cliente" };
  }

  // Vínculo "vivo" é PENDENTE ou ATIVO. Encerrados não bloqueiam: são
  // histórico, e um cliente pode voltar a ter nutricionista depois.
  const vivo = await prismaNutri.vinculo.findFirst({
    where: { clienteId: cliente.id, tipo, status: { not: StatusVinculo.ENCERRADO } },
  });
  if (vivo) {
    if (vivo.profissionalId === profissional.id) {
      return {
        sucesso: false,
        erro:
          vivo.status === StatusVinculo.PENDENTE
            ? "você já pediu — falta o cliente aceitar"
            : "você já acompanha esse cliente",
      };
    }
    const lado = tipo === TipoVinculo.NUTRICAO ? "nutricionista" : "personal";
    return { sucesso: false, erro: `esse cliente já tem ${lado} — ele precisa encerrar o vínculo atual antes` };
  }

  await prismaNutri.vinculo.create({
    data: { clienteId: cliente.id, profissionalId: profissional.id, tipo, status: StatusVinculo.PENDENTE },
  });

  revalidatePath("/pro");
  revalidatePath(`/p/${cliente.tokenAcesso}`);
  return { sucesso: true, nome: cliente.nome };
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

/**
 * Salva as metas atuais como um template reusável do profissional. Exige a
 * capacidade de nutrição — só quem prescreve dieta guarda template de dieta.
 */
export async function salvarTemplateNutricao(input: unknown): Promise<ResultadoAcao> {
  const parsed = templateNutricaoSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "payload inválido" };
  }

  const profissional = await exigirCapacidade(Capacidade.NUTRICAO);
  await prismaNutri.template.create({
    data: {
      profissionalId: profissional.id,
      tipo: TipoVinculo.NUTRICAO,
      nome: parsed.data.nome,
      metaKcal: parsed.data.metas.metaKcal,
      metaProteina: parsed.data.metas.metaProteina,
      metaCarbo: parsed.data.metas.metaCarbo,
      metaGordura: parsed.data.metas.metaGordura,
    },
  });

  revalidatePath("/pro", "layout");
  return { sucesso: true };
}

/** Salva o treino atual como template reusável do profissional. */
export async function salvarTemplateTreino(input: unknown): Promise<ResultadoAcao> {
  const parsed = templateTreinoSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "payload inválido" };
  }

  const profissional = await exigirCapacidade(Capacidade.TREINO);
  await prismaNutri.template.create({
    data: {
      profissionalId: profissional.id,
      tipo: TipoVinculo.TREINO,
      nome: parsed.data.nome,
      descricao: parsed.data.treino.descricao,
      diasPorSemana: parsed.data.treino.diasPorSemana,
    },
  });

  revalidatePath("/pro", "layout");
  return { sucesso: true };
}

/** Publica uma oferta no Marketplace. Preço vem em reais e vira centavos. */
export async function criarOferta(input: unknown): Promise<ResultadoAcao> {
  const parsed = criarOfertaSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "payload inválido" };
  }

  const profissional = await obterProfissionalAtual();
  await prismaNutri.oferta.create({
    data: {
      profissionalId: profissional.id,
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao,
      precoCentavos: Math.round(parsed.data.precoReais * 100),
    },
  });

  revalidatePath("/pro/conta");
  return { sucesso: true };
}

/** Remove uma oferta — só as do próprio profissional (filtro por profissionalId). */
export async function removerOferta(input: unknown): Promise<ResultadoAcao> {
  const parsed = removerOfertaSchema.safeParse(input);
  if (!parsed.success) return { sucesso: false, erro: "payload inválido" };

  const profissional = await obterProfissionalAtual();
  await prismaNutri.oferta.deleteMany({ where: { id: parsed.data.ofertaId, profissionalId: profissional.id } });

  revalidatePath("/pro/conta");
  return { sucesso: true };
}

/**
 * Remove um template. Só toca nos do próprio profissional — o filtro por
 * profissionalId impede apagar template alheio sabendo o id. Template é
 * conveniência, não registro de negócio: aqui DELETE é de verdade.
 */
export async function removerTemplate(input: unknown): Promise<ResultadoAcao> {
  const parsed = removerTemplateSchema.safeParse(input);
  if (!parsed.success) return { sucesso: false, erro: "payload inválido" };

  const profissional = await obterProfissionalAtual();
  await prismaNutri.template.deleteMany({
    where: { id: parsed.data.templateId, profissionalId: profissional.id },
  });

  revalidatePath("/pro", "layout");
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

/**
 * Define a lista de exercícios do treino ativo do cliente (o lado "personal
 * prescreve" do treino estruturado). Substitui a lista inteira — exercício
 * prescrito é config, não registro de negócio, então DELETE aqui é de verdade.
 * Exige um treino ativo primeiro (o cabeçalho vem de atualizarTreino).
 */
export async function salvarExerciciosDoTreino(input: unknown): Promise<ResultadoAcao> {
  const parsed = salvarExerciciosSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "payload inválido" };
  }

  const profissional = await exigirCapacidade(Capacidade.TREINO);
  const cliente = await exigirVinculo(parsed.data.clienteId, profissional.id, TipoVinculo.TREINO);
  if (!cliente) return { sucesso: false, erro: "cliente não encontrado" };

  const treino = await prismaNutri.treinoPrescrito.findFirst({
    where: { clienteId: cliente.id, ativo: true },
    orderBy: { criadoEm: "desc" },
  });
  if (!treino) return { sucesso: false, erro: "prescreva um treino antes de detalhar os exercícios" };

  await prismaNutri.$transaction([
    prismaNutri.exercicioPrescrito.deleteMany({ where: { treinoId: treino.id } }),
    ...parsed.data.exercicios.map((e, i) =>
      prismaNutri.exercicioPrescrito.create({
        data: {
          treinoId: treino.id,
          nome: e.nome,
          ordem: i,
          seriesAlvo: e.seriesAlvo,
          repsAlvo: e.repsAlvo,
          cargaAlvoKg: e.cargaAlvoKg,
          descansoSeg: e.descansoSeg,
        },
      }),
    ),
  ]);

  revalidatePath(`/pro/clientes/${cliente.id}`);
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

/**
 * Recado do profissional PARA o cliente — aparece na home dele. Exige
 * vínculo ativo (qualquer tipo): sem acompanhar, não há a quem mandar
 * recado. Guarda profissionalId pro cliente ver quem falou e pro
 * profissional acompanhar se foi lido.
 */
export async function enviarRecado(input: unknown): Promise<ResultadoAcao> {
  const parsed = recadoSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "payload inválido" };
  }

  const profissional = await obterProfissionalAtual();
  const vinculo = await prismaNutri.vinculo.findFirst({
    where: { clienteId: parsed.data.clienteId, profissionalId: profissional.id, status: StatusVinculo.ATIVO },
  });
  if (!vinculo) return { sucesso: false, erro: "cliente não encontrado" };

  const cliente = await prismaNutri.cliente.findUnique({ where: { id: parsed.data.clienteId } });

  await prismaNutri.recado.create({
    data: { clienteId: parsed.data.clienteId, profissionalId: profissional.id, texto: parsed.data.texto },
  });

  revalidatePath(`/pro/clientes/${parsed.data.clienteId}`);
  if (cliente) revalidatePath(`/p/${cliente.tokenAcesso}`);
  return { sucesso: true };
}

/**
 * "Cutucar": manda um lembrete push pro cliente sumido. Exige vínculo ativo.
 * Envia pra todos os aparelhos dele e limpa as inscrições que o navegador
 * reportar mortas. Degrada com mensagem clara quando o push não está
 * configurado (faltam chaves VAPID) ou quando o cliente não ativou lembretes.
 */
export async function cutucarCliente(input: unknown): Promise<ResultadoAcao> {
  const parsed = clienteIdSchema.safeParse(input);
  if (!parsed.success) return { sucesso: false, erro: "payload inválido" };

  const profissional = await obterProfissionalAtual();
  const vinculo = await prismaNutri.vinculo.findFirst({
    where: { clienteId: parsed.data.clienteId, profissionalId: profissional.id, status: StatusVinculo.ATIVO },
  });
  if (!vinculo) return { sucesso: false, erro: "cliente não encontrado" };

  if (!pushConfigurado()) {
    return { sucesso: false, erro: "lembretes push não configurados no servidor (faltam as chaves VAPID)" };
  }

  const cliente = await prismaNutri.cliente.findUnique({ where: { id: parsed.data.clienteId } });
  if (!cliente) return { sucesso: false, erro: "cliente não encontrado" };

  const inscricoes = await prismaNutri.pushSubscription.findMany({ where: { clienteId: cliente.id } });
  if (inscricoes.length === 0) {
    return { sucesso: false, erro: "esse cliente ainda não ativou os lembretes no aparelho dele" };
  }

  const payload = {
    titulo: "Lembrete do seu profissional",
    corpo: `${profissional.nome} passou pra lembrar: que tal registrar hoje?`,
    url: `/p/${cliente.tokenAcesso}`,
  };

  const resultados = await Promise.all(inscricoes.map((i) => enviarPush(i, payload)));

  // Limpa as que morreram (aparelho desinstalou o PWA) — não é dado de negócio.
  const expiradas = inscricoes.filter((_, idx) => resultados[idx] === "expirado").map((i) => i.id);
  if (expiradas.length > 0) {
    await prismaNutri.pushSubscription.deleteMany({ where: { id: { in: expiradas } } });
  }

  if (!resultados.includes("ok")) {
    return { sucesso: false, erro: "não consegui entregar o lembrete agora — tente de novo em instantes" };
  }

  return { sucesso: true };
}

/**
 * Resumo de evolução gerado por IA a partir dos números do cliente (peso e
 * comparativo de semanas). Não persiste nada: é uma ajuda de redação pro
 * profissional, que lê e decide. Só usa os lados que ele acompanha, e a IA
 * é instruída a não inventar — se a IA está fora, devolve erro tratado.
 */
export async function gerarRelatorio(input: unknown): Promise<ResultadoRelatorio> {
  const parsed = clienteIdSchema.safeParse(input);
  if (!parsed.success) return { sucesso: false, erro: "payload inválido" };

  const profissional = await obterProfissionalAtual();
  const vinculos = await prismaNutri.vinculo.findMany({
    where: { clienteId: parsed.data.clienteId, profissionalId: profissional.id, status: StatusVinculo.ATIVO },
  });
  if (vinculos.length === 0) return { sucesso: false, erro: "cliente não encontrado" };

  const acompanhaNutricao = vinculos.some((v) => v.tipo === TipoVinculo.NUTRICAO);
  const acompanhaTreino = vinculos.some((v) => v.tipo === TipoVinculo.TREINO);

  const cliente = await prismaNutri.cliente.findUnique({ where: { id: parsed.data.clienteId } });
  if (!cliente) return { sucesso: false, erro: "cliente não encontrado" };

  const [medidas, comparacao] = await Promise.all([
    prismaNutri.medida.findMany({ where: { clienteId: cliente.id }, orderBy: { registradoEm: "asc" } }),
    buscarComparacaoSemanas(cliente.id, acompanhaNutricao, acompanhaTreino),
  ]);

  const peso =
    medidas.length >= 2
      ? {
          primeiro: medidas[0].pesoKg,
          ultimo: medidas[medidas.length - 1].pesoKg,
          dias: Math.max(
            1,
            Math.round((medidas[medidas.length - 1].registradoEm.getTime() - medidas[0].registradoEm.getTime()) / 86_400_000),
          ),
        }
      : null;

  const dados: DadosRelatorio = { nome: cliente.nome, objetivo: cliente.objetivo, peso, comparacao };

  try {
    const texto = await gerarRelatorioEvolucao(dados);
    return { sucesso: true, texto };
  } catch (erro) {
    if (erro instanceof IaNaoConfiguradaError) {
      return { sucesso: false, erro: "a IA de relatório não está configurada — configure a chave nas variáveis de ambiente" };
    }
    if (erro instanceof IaIndisponivelError) {
      return { sucesso: false, erro: "a IA está indisponível agora — tente de novo em instantes" };
    }
    return { sucesso: false, erro: "não deu pra gerar o relatório agora" };
  }
}
