"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "../../../prisma/nutri/generated";
import { prismaNutri } from "@/lib/nutri/prisma";
import { extrairMacros, IaRespostaInvalidaError } from "@/lib/nutri/ia";
import {
  StatusCliente,
  StatusVinculo,
  ajustarMacrosSchema,
  definirMetaAguaSchema,
  definirMetaCorridaSchema,
  definirUsuarioSchema,
  entrarRankingSchema,
  favoritoSchema,
  fotoPerfilSchema,
  inscricaoPushSchema,
  registrarAguaSchema,
  registrarCorridaSchema,
  registrarPesoSchema,
  registrarSchema,
  registrarTreinoEstruturadoSchema,
  removerFavoritoSchema,
  removerInscricaoPushSchema,
  removerRegistroSchema,
  tokenSchema,
  vinculoDoClienteSchema,
} from "@/lib/cliente/schemas";
import { COPO_PADRAO_ML } from "@/lib/cliente/hidratacao";
import { limitesDoDiaEmSaoPaulo } from "@/lib/nutri/aderencia";

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

/**
 * Resolve um vínculo a partir do token do cliente. O vinculoId sozinho
 * nunca basta: o filtro por clienteId é o que impede alguém responder por
 * um vínculo que não é dele.
 */
async function vinculoDoCliente(input: unknown, statusEsperado: StatusVinculo) {
  const parsed = vinculoDoClienteSchema.safeParse(input);
  if (!parsed.success) return null;

  const cliente = await clientePeloToken(parsed.data.token);
  if (!cliente) return null;

  const vinculo = await prismaNutri.vinculo.findFirst({
    where: { id: parsed.data.vinculoId, clienteId: cliente.id, status: statusEsperado },
  });
  if (!vinculo) return null;

  return { cliente, vinculo, token: parsed.data.token };
}

/**
 * O cliente libera o acompanhamento. É aqui que o dado dele passa a ser
 * visível pra esse profissional — por isso a ação é dele, e não de quem
 * pediu.
 */
export async function aceitarVinculo(input: unknown): Promise<ResultadoAcaoPublica> {
  const alvo = await vinculoDoCliente(input, StatusVinculo.PENDENTE);
  if (!alvo) return { sucesso: false, erro: "solicitação não encontrada" };

  // O limite do plano foi conferido quando o profissional pediu, mas pode
  // ter estourado desde então — quem paga é ele, então a vaga é conferida
  // de novo na hora que o vínculo de fato passa a valer.
  const profissional = await prismaNutri.profissional.findUnique({ where: { id: alvo.vinculo.profissionalId } });
  if (!profissional) return { sucesso: false, erro: "profissional não encontrado" };

  const ativos = await prismaNutri.vinculo.count({
    where: { profissionalId: profissional.id, status: StatusVinculo.ATIVO },
  });
  if (ativos >= profissional.limitePlano) {
    return { sucesso: false, erro: "o plano desse profissional está cheio — peça pra ele liberar uma vaga" };
  }

  await prismaNutri.vinculo.update({
    where: { id: alvo.vinculo.id },
    data: { status: StatusVinculo.ATIVO, aceitoEm: new Date() },
  });

  revalidatePath(`/p/${alvo.token}`);
  revalidatePath("/pro");
  return { sucesso: true };
}

/** Recusar é encerrar antes de começar — a linha fica como registro. */
export async function recusarVinculo(input: unknown): Promise<ResultadoAcaoPublica> {
  const alvo = await vinculoDoCliente(input, StatusVinculo.PENDENTE);
  if (!alvo) return { sucesso: false, erro: "solicitação não encontrada" };

  await prismaNutri.vinculo.update({
    where: { id: alvo.vinculo.id },
    data: { status: StatusVinculo.ENCERRADO },
  });

  revalidatePath(`/p/${alvo.token}`);
  revalidatePath("/pro");
  return { sucesso: true };
}

/**
 * O cliente encerra um acompanhamento em andamento. Nunca arquiva a
 * pessoa, mesmo se não sobrar nenhum vínculo: arquivar tiraria dele o
 * acesso à própria página — o oposto do que ele pediu. Os registros ficam;
 * o profissional é que perde o acesso.
 */
export async function encerrarVinculo(input: unknown): Promise<ResultadoAcaoPublica> {
  const alvo = await vinculoDoCliente(input, StatusVinculo.ATIVO);
  if (!alvo) return { sucesso: false, erro: "acompanhamento não encontrado" };

  await prismaNutri.vinculo.update({
    where: { id: alvo.vinculo.id },
    data: { status: StatusVinculo.ENCERRADO },
  });

  revalidatePath(`/p/${alvo.token}`);
  revalidatePath("/pro");
  return { sucesso: true };
}

/**
 * O cliente abriu a home e viu os recados: marca os não-lidos como lidos,
 * pro profissional saber que chegou. Idempotente — updateMany só toca nos
 * que ainda têm lidoEm null.
 */
export async function marcarRecadosLidos(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = tokenSchema.safeParse(input);
  if (!parsed.success) return { sucesso: false, erro: "token inválido" };

  const cliente = await clientePeloToken(parsed.data.token);
  if (!cliente) return { sucesso: false, erro: "cliente não encontrado" };

  await prismaNutri.recado.updateMany({
    where: { clienteId: cliente.id, lidoEm: null },
    data: { lidoEm: new Date() },
  });

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
 * Um copo d'água. 1 toque = 1 linha; o total do dia é a soma delas. Sem
 * dedupe idempotente de propósito: dois toques são dois copos, não um
 * registro repetido.
 */
export async function registrarAgua(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = registrarAguaSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "volume inválido" };
  }

  const cliente = await clientePeloToken(parsed.data.token);
  if (!cliente) return { sucesso: false, erro: "cliente não encontrado" };
  if (!cliente.consentimentoEm) return { sucesso: false, erro: "consentimento obrigatório antes de registrar" };

  await prismaNutri.registroAgua.create({
    data: { clienteId: cliente.id, ml: parsed.data.ml ?? COPO_PADRAO_ML },
  });

  revalidatePath(`/p/${parsed.data.token}`);
  return { sucesso: true };
}

/**
 * Desfaz o último copo de hoje — para o toque errado. Água é métrica
 * efêmera auto-relatada, não registro clínico, então aqui DELETE é de
 * verdade (ao contrário de refeição/peso); some da soma e do histórico. O
 * filtro por clienteId impede apagar o copo de outra pessoa sabendo o id.
 */
export async function removerUltimaAgua(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = tokenSchema.safeParse(input);
  if (!parsed.success) return { sucesso: false, erro: "token inválido" };

  const cliente = await clientePeloToken(parsed.data.token);
  if (!cliente) return { sucesso: false, erro: "cliente não encontrado" };

  const { inicio, fim } = limitesDoDiaEmSaoPaulo();
  const ultimo = await prismaNutri.registroAgua.findFirst({
    where: { clienteId: cliente.id, registradoEm: { gte: inicio, lt: fim } },
    orderBy: { registradoEm: "desc" },
  });
  if (!ultimo) return { sucesso: false, erro: "nada para desfazer hoje" };

  await prismaNutri.registroAgua.delete({ where: { id: ultimo.id } });

  revalidatePath(`/p/${parsed.data.token}`);
  return { sucesso: true };
}

/** O cliente escolhe/troca o próprio @usuário. Único: se já existir, avisa. */
export async function definirUsuario(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = definirUsuarioSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "@usuário inválido" };
  }

  const cliente = await clientePeloToken(parsed.data.token);
  if (!cliente) return { sucesso: false, erro: "cliente não encontrado" };

  try {
    await prismaNutri.cliente.update({ where: { id: cliente.id }, data: { usuario: parsed.data.usuario } });
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      return { sucesso: false, erro: "esse @usuário já está em uso — escolha outro" };
    }
    throw erro;
  }

  revalidatePath(`/p/${parsed.data.token}/perfil`);
  return { sucesso: true };
}

/** O cliente define a própria foto de perfil (já reduzida no aparelho). */
export async function salvarFotoPerfil(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = fotoPerfilSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "foto inválida" };
  }

  const cliente = await clientePeloToken(parsed.data.token);
  if (!cliente) return { sucesso: false, erro: "cliente não encontrado" };

  await prismaNutri.cliente.update({ where: { id: cliente.id }, data: { fotoBase64: parsed.data.fotoBase64 } });

  revalidatePath(`/p/${parsed.data.token}`, "layout");
  return { sucesso: true };
}

/** Remove a foto — volta pra inicial do nome. */
export async function removerFotoPerfil(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = tokenSchema.safeParse(input);
  if (!parsed.success) return { sucesso: false, erro: "token inválido" };

  const cliente = await clientePeloToken(parsed.data.token);
  if (!cliente) return { sucesso: false, erro: "cliente não encontrado" };

  await prismaNutri.cliente.update({ where: { id: cliente.id }, data: { fotoBase64: null } });

  revalidatePath(`/p/${parsed.data.token}`, "layout");
  return { sucesso: true };
}

/** Cliente ajusta a própria meta diária de água. */
export async function definirMetaAgua(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = definirMetaAguaSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "meta inválida" };
  }

  const cliente = await clientePeloToken(parsed.data.token);
  if (!cliente) return { sucesso: false, erro: "cliente não encontrado" };

  await prismaNutri.cliente.update({
    where: { id: cliente.id },
    data: { metaAguaMl: parsed.data.metaMl },
  });

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

/**
 * Treino estruturado: uma sessão com várias séries (exercício + carga + reps).
 * Convive com o check-in de texto — as duas geram uma SessaoTreino, então a
 * aderência da semana e a ofensiva contam igual. Só séries com carga ou reps
 * preenchidos viram linha. Idempotente por clientLogId.
 */
export async function registrarTreinoEstruturado(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = registrarTreinoEstruturadoSchema.safeParse(input);
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

  const series = parsed.data.series.filter((s) => (s.cargaKg ?? 0) > 0 || (s.reps ?? 0) > 0);
  if (series.length === 0) return { sucesso: false, erro: "preencha carga ou reps de ao menos uma série" };

  try {
    await prismaNutri.sessaoTreino.create({
      data: {
        clienteId: cliente.id,
        clienteRegistroId: parsed.data.clientLogId,
        origem: "TEXTO",
        entradaBruta: parsed.data.nomeTreino,
        series: {
          create: series.map((s, i) => ({ exercicio: s.exercicio, ordem: i, cargaKg: s.cargaKg, reps: s.reps })),
        },
      },
    });
  } catch (erro) {
    const jaSalvo = await prismaNutri.sessaoTreino.findUnique({
      where: { clienteRegistroId: parsed.data.clientLogId },
    });
    if (jaSalvo) return { sucesso: true };
    throw erro;
  }

  revalidatePath(`/p/${parsed.data.token}`);
  return { sucesso: true };
}

/**
 * Remove uma refeição registrada errada — a IA estimou mal, ou o cliente
 * descreveu outra coisa. Nunca DELETE: marca removidoEm, e a extensão do
 * client some com ela de toda leitura (o anel volta ao número certo).
 *
 * O findFirst já não enxerga removidas, então remover de novo devolve "não
 * encontrado" em vez de mexer na linha duas vezes; e o filtro por clienteId
 * é o que impede remover a refeição de outra pessoa sabendo só o id.
 */
export async function removerRefeicao(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = removerRegistroSchema.safeParse(input);
  if (!parsed.success) return { sucesso: false, erro: "payload inválido" };

  const cliente = await clientePeloToken(parsed.data.token);
  if (!cliente) return { sucesso: false, erro: "cliente não encontrado" };

  const refeicao = await prismaNutri.refeicao.findFirst({
    where: { id: parsed.data.registroId, clienteId: cliente.id },
  });
  if (!refeicao) return { sucesso: false, erro: "registro não encontrado" };

  await prismaNutri.refeicao.update({ where: { id: refeicao.id }, data: { removidoEm: new Date() } });

  revalidatePath(`/p/${parsed.data.token}`);
  return { sucesso: true };
}

/**
 * Estima os macros de uma refeição que entrou "a estimar" — registrada
 * enquanto a IA estava fora do ar. Chama a IA de novo com o mesmo texto; se
 * agora responde, preenche os macros e tira a flag. Se ainda está fora,
 * devolve erro e a refeição continua pendente (nunca inventa número).
 */
export async function estimarRefeicao(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = removerRegistroSchema.safeParse(input);
  if (!parsed.success) return { sucesso: false, erro: "payload inválido" };

  const cliente = await clientePeloToken(parsed.data.token);
  if (!cliente) return { sucesso: false, erro: "cliente não encontrado" };

  const refeicao = await prismaNutri.refeicao.findFirst({
    where: { id: parsed.data.registroId, clienteId: cliente.id },
  });
  if (!refeicao) return { sucesso: false, erro: "registro não encontrado" };
  // Já estimada (ou estimada em paralelo): nada a fazer, e não gasta a IA à toa.
  if (!refeicao.macrosPendentes) return { sucesso: true };

  let macros;
  try {
    macros = await extrairMacros(refeicao.entradaBruta);
  } catch (erro) {
    if (erro instanceof IaRespostaInvalidaError) return { sucesso: false, erro: erro.message };
    return { sucesso: false, erro: "a estimativa automática ainda está indisponível — tente de novo em instantes" };
  }

  await prismaNutri.refeicao.update({
    where: { id: refeicao.id },
    data: {
      itens: JSON.stringify(macros.items),
      kcal: Math.round(macros.totals.kcal),
      proteina: Math.round(macros.totals.protein),
      carbo: Math.round(macros.totals.carbs),
      gordura: Math.round(macros.totals.fat),
      confianca: macros.confidence,
      macrosPendentes: false,
    },
  });

  revalidatePath(`/p/${parsed.data.token}`);
  return { sucesso: true };
}

/**
 * Ajuste manual dos macros de uma refeição. A IA propõe, a pessoa corrige: os
 * números passam a ser dela (ajustadoManualmente), e a refeição deixa de estar
 * "a estimar" se estava — corrigir na mão é uma forma de resolver a pendência.
 * O filtro por clienteId impede editar a refeição de outra pessoa sabendo o id.
 */
export async function ajustarRefeicao(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = ajustarMacrosSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "valores inválidos" };
  }

  const cliente = await clientePeloToken(parsed.data.token);
  if (!cliente) return { sucesso: false, erro: "cliente não encontrado" };

  const refeicao = await prismaNutri.refeicao.findFirst({
    where: { id: parsed.data.registroId, clienteId: cliente.id },
  });
  if (!refeicao) return { sucesso: false, erro: "registro não encontrado" };

  await prismaNutri.refeicao.update({
    where: { id: refeicao.id },
    data: {
      kcal: parsed.data.kcal,
      proteina: parsed.data.proteina,
      carbo: parsed.data.carbo,
      gordura: parsed.data.gordura,
      // Número confirmado pela pessoa: confiança total, não é mais estimativa
      // nem pendência.
      confianca: 1,
      ajustadoManualmente: true,
      macrosPendentes: false,
    },
  });

  revalidatePath(`/p/${parsed.data.token}`);
  return { sucesso: true };
}

/**
 * Registra uma corrida (distância + tempo). Guarda em metros e segundos —
 * o pace e os recordes derivam disso, nunca de um número já calculado.
 */
export async function registrarCorrida(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = registrarCorridaSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "valores inválidos" };
  }

  const cliente = await clientePeloToken(parsed.data.token);
  if (!cliente) return { sucesso: false, erro: "cliente não encontrado" };
  if (!cliente.consentimentoEm) return { sucesso: false, erro: "consentimento obrigatório antes de registrar" };

  await prismaNutri.corrida.create({
    data: {
      clienteId: cliente.id,
      distanciaMetros: Math.round(parsed.data.distanciaKm * 1000),
      duracaoSegundos: Math.round(parsed.data.duracaoMin * 60),
    },
  });

  revalidatePath(`/p/${parsed.data.token}/treino`);
  revalidatePath(`/p/${parsed.data.token}`);
  return { sucesso: true };
}

/** Define (ou limpa, com 0) a meta de km de corrida do mês. */
export async function definirMetaCorrida(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = definirMetaCorridaSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "meta inválida" };
  }

  const cliente = await clientePeloToken(parsed.data.token);
  if (!cliente) return { sucesso: false, erro: "cliente não encontrado" };

  await prismaNutri.cliente.update({
    where: { id: cliente.id },
    data: { metaCorridaKmMes: parsed.data.metaKm > 0 ? parsed.data.metaKm : null },
  });

  revalidatePath(`/p/${parsed.data.token}/treino`);
  return { sucesso: true };
}

/**
 * Entra no ranking RBP escolhendo um apelido público. Opt-in explícito:
 * antes disso o cliente não é listado nem contado. O apelido é o que
 * aparece pros outros — nunca o nome real.
 */
export async function entrarNoRanking(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = entrarRankingSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "apelido inválido" };
  }

  const cliente = await clientePeloToken(parsed.data.token);
  if (!cliente) return { sucesso: false, erro: "cliente não encontrado" };

  await prismaNutri.cliente.update({
    where: { id: cliente.id },
    data: { participaRanking: true, apelidoRanking: parsed.data.apelido },
  });

  revalidatePath(`/p/${parsed.data.token}/treino`);
  return { sucesso: true };
}

/** Sai do ranking — para de ser listado/contado. Mantém o apelido pra voltar fácil. */
export async function sairDoRanking(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = tokenSchema.safeParse(input);
  if (!parsed.success) return { sucesso: false, erro: "token inválido" };

  const cliente = await clientePeloToken(parsed.data.token);
  if (!cliente) return { sucesso: false, erro: "cliente não encontrado" };

  await prismaNutri.cliente.update({ where: { id: cliente.id }, data: { participaRanking: false } });

  revalidatePath(`/p/${parsed.data.token}/treino`);
  return { sucesso: true };
}

/** Remove uma corrida registrada errada — remoção lógica, como refeição/treino. */
export async function removerCorrida(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = removerRegistroSchema.safeParse(input);
  if (!parsed.success) return { sucesso: false, erro: "payload inválido" };

  const cliente = await clientePeloToken(parsed.data.token);
  if (!cliente) return { sucesso: false, erro: "cliente não encontrado" };

  const corrida = await prismaNutri.corrida.findFirst({
    where: { id: parsed.data.registroId, clienteId: cliente.id },
  });
  if (!corrida) return { sucesso: false, erro: "registro não encontrado" };

  await prismaNutri.corrida.update({ where: { id: corrida.id }, data: { removidoEm: new Date() } });

  revalidatePath(`/p/${parsed.data.token}/treino`);
  return { sucesso: true };
}

/** Simétrico a removerRefeicao — um treino que o cliente marcou mas não fez. */
export async function removerSessaoTreino(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = removerRegistroSchema.safeParse(input);
  if (!parsed.success) return { sucesso: false, erro: "payload inválido" };

  const cliente = await clientePeloToken(parsed.data.token);
  if (!cliente) return { sucesso: false, erro: "cliente não encontrado" };

  const sessao = await prismaNutri.sessaoTreino.findFirst({
    where: { id: parsed.data.registroId, clienteId: cliente.id },
  });
  if (!sessao) return { sucesso: false, erro: "registro não encontrado" };

  await prismaNutri.sessaoTreino.update({ where: { id: sessao.id }, data: { removidoEm: new Date() } });

  revalidatePath(`/p/${parsed.data.token}`);
  return { sucesso: true };
}

/**
 * Exclusão LGPD dos próprios dados, por anonimização: some o que liga os
 * registros a uma pessoa identificável (nome, telefone, anamnese, texto livre
 * das refeições/treinos) e encerra os acompanhamentos. Os números
 * de-identificados (macros, peso) e o registro clínico do profissional
 * (Anotacao) ficam — é decisão de política que o dono do app revê com o
 * jurídico. status ARQUIVADO mata o link na hora: clientePeloToken e
 * buscarClientePorToken já recusam quem não está ATIVO.
 */
export async function apagarMeusDados(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = tokenSchema.safeParse(input);
  if (!parsed.success) return { sucesso: false, erro: "token inválido" };

  const cliente = await clientePeloToken(parsed.data.token);
  if (!cliente) return { sucesso: false, erro: "cliente não encontrado" };

  await prismaNutri.$transaction([
    prismaNutri.cliente.update({
      where: { id: cliente.id },
      data: {
        nome: "Cliente removido",
        telefone: null,
        dataNascimento: null,
        sexo: null,
        alturaCm: null,
        objetivo: null,
        status: StatusCliente.ARQUIVADO,
      },
    }),
    prismaNutri.anamneseNutricional.updateMany({
      where: { clienteId: cliente.id },
      data: { restricoesAlimentares: null, observacoes: null },
    }),
    prismaNutri.anamneseTreino.updateMany({
      where: { clienteId: cliente.id },
      data: { lesoesLimitacoes: null, praticaOutroEsporte: null, observacoes: null },
    }),
    prismaNutri.refeicao.updateMany({
      where: { clienteId: cliente.id },
      data: { entradaBruta: "[removido]", itens: "[]" },
    }),
    prismaNutri.sessaoTreino.updateMany({
      where: { clienteId: cliente.id },
      data: { entradaBruta: "[removido]" },
    }),
    prismaNutri.favorito.deleteMany({ where: { clienteId: cliente.id } }),
    prismaNutri.vinculo.updateMany({
      where: { clienteId: cliente.id, status: { not: StatusVinculo.ENCERRADO } },
      data: { status: StatusVinculo.ENCERRADO },
    }),
  ]);

  revalidatePath(`/p/${parsed.data.token}`);
  revalidatePath("/pro");
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

/**
 * Registra a inscrição de Web Push de um aparelho do cliente. Chave natural
 * é o endpoint (o navegador dá um por aparelho): upsert por ele evita
 * duplicar quando o mesmo aparelho reinscreve, e reaponta pro cliente certo
 * caso o aparelho troque de dono.
 */
export async function salvarInscricaoPush(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = inscricaoPushSchema.safeParse(input);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "inscrição inválida" };
  }

  const cliente = await clientePeloToken(parsed.data.token);
  if (!cliente) return { sucesso: false, erro: "cliente não encontrado" };

  await prismaNutri.pushSubscription.upsert({
    where: { endpoint: parsed.data.endpoint },
    update: { clienteId: cliente.id, p256dh: parsed.data.p256dh, auth: parsed.data.auth },
    create: {
      clienteId: cliente.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
    },
  });

  return { sucesso: true };
}

/** Desliga os lembretes neste aparelho — apaga a inscrição pelo endpoint. */
export async function removerInscricaoPush(input: unknown): Promise<ResultadoAcaoPublica> {
  const parsed = removerInscricaoPushSchema.safeParse(input);
  if (!parsed.success) return { sucesso: false, erro: "payload inválido" };

  const cliente = await clientePeloToken(parsed.data.token);
  if (!cliente) return { sucesso: false, erro: "cliente não encontrado" };

  // Filtro por clienteId: saber o endpoint de outra pessoa não basta pra
  // apagar a inscrição dela.
  await prismaNutri.pushSubscription.deleteMany({
    where: { endpoint: parsed.data.endpoint, clienteId: cliente.id },
  });

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
