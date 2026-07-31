import { prismaNutri } from "@/lib/nutri/prisma";

/**
 * Reúne TODOS os dados pessoais do cliente num objeto só — o direito de
 * acesso/portabilidade da LGPD. É o que a rota /api/cliente/dados serializa
 * pra download. Registros removidos (com removidoEm) ficam de fora: a
 * extensão do client já os esconde de toda leitura, e eles são justamente o
 * que a pessoa apagou.
 */
export async function montarExportacao(clienteId: string) {
  const [cliente, anamneseNutricional, anamneseTreino, refeicoes, sessoes, medidas, favoritos, vinculos, planos, treinos] =
    await Promise.all([
      prismaNutri.cliente.findUniqueOrThrow({ where: { id: clienteId } }),
      prismaNutri.anamneseNutricional.findUnique({ where: { clienteId } }),
      prismaNutri.anamneseTreino.findUnique({ where: { clienteId } }),
      prismaNutri.refeicao.findMany({ where: { clienteId }, orderBy: { registradoEm: "asc" } }),
      prismaNutri.sessaoTreino.findMany({ where: { clienteId }, orderBy: { realizadoEm: "asc" } }),
      prismaNutri.medida.findMany({ where: { clienteId }, orderBy: { registradoEm: "asc" } }),
      prismaNutri.favorito.findMany({ where: { clienteId }, orderBy: { criadoEm: "asc" } }),
      prismaNutri.vinculo.findMany({ where: { clienteId }, include: { profissional: { select: { nome: true } } } }),
      prismaNutri.planoNutricional.findMany({ where: { clienteId }, orderBy: { criadoEm: "asc" } }),
      prismaNutri.treinoPrescrito.findMany({ where: { clienteId }, orderBy: { criadoEm: "asc" } }),
    ]);

  return {
    exportadoEm: new Date().toISOString(),
    perfil: {
      nome: cliente.nome,
      telefone: cliente.telefone,
      dataNascimento: cliente.dataNascimento,
      sexo: cliente.sexo,
      alturaCm: cliente.alturaCm,
      objetivo: cliente.objetivo,
      consentimentoEm: cliente.consentimentoEm,
      criadoEm: cliente.criadoEm,
    },
    anamneseNutricional,
    anamneseTreino,
    refeicoes: refeicoes.map((r) => ({
      descricao: r.entradaBruta,
      kcal: r.kcal,
      proteina: r.proteina,
      carbo: r.carbo,
      gordura: r.gordura,
      confianca: r.confianca,
      ajustadoManualmente: r.ajustadoManualmente,
      registradoEm: r.registradoEm,
    })),
    treinos: sessoes.map((s) => ({ descricao: s.entradaBruta, realizadoEm: s.realizadoEm })),
    pesos: medidas.map((m) => ({ pesoKg: m.pesoKg, registradoEm: m.registradoEm })),
    favoritos: favoritos.map((f) => f.descricao),
    acompanhamentos: vinculos.map((v) => ({ profissional: v.profissional.nome, tipo: v.tipo, status: v.status })),
    planosNutricionais: planos.map((p) => ({
      metaKcal: p.metaKcal,
      metaProteina: p.metaProteina,
      metaCarbo: p.metaCarbo,
      metaGordura: p.metaGordura,
      ativo: p.ativo,
      criadoEm: p.criadoEm,
    })),
    treinosPrescritos: treinos.map((t) => ({
      nome: t.nome,
      descricao: t.descricao,
      diasPorSemana: t.diasPorSemana,
      ativo: t.ativo,
      criadoEm: t.criadoEm,
    })),
  };
}
