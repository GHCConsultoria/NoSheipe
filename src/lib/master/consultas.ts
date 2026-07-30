import { prismaNutri } from "@/lib/nutri/prisma";
import { StatusCliente, StatusVinculo, TipoVinculo } from "@/lib/cliente/schemas";

/**
 * Consultas da interface administrativa.
 *
 * Regra que vale pra este arquivo inteiro: **nada de dado de saúde**.
 * Refeição, peso, medida e anotação são dado sensível de terceiro, e o
 * Master é operacional, não clínico. Contagem agregada de registros pode —
 * serve pra saber se o produto está sendo usado —, o conteúdo não.
 */

function diasAtras(dias: number): Date {
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
}

export interface MetricasGerais {
  profissionais: number;
  profissionaisNutricionistas: number;
  profissionaisPersonais: number;
  clientesAtivos: number;
  clientesArquivados: number;
  vinculosAtivos: number;
  vinculosPendentes: number;
  vinculosNutricao: number;
  vinculosTreino: number;
  /** Clientes atendidos por mais de um profissional — o caso da Fase 3. */
  clientesCompartilhados: number;
  registros7dias: number;
  registros30dias: number;
}

export async function buscarMetricasGerais(): Promise<MetricasGerais> {
  const seteDias = diasAtras(7);
  const trintaDias = diasAtras(30);

  const [
    profissionais,
    profissionaisNutricionistas,
    profissionaisPersonais,
    clientesAtivos,
    clientesArquivados,
    vinculosAtivos,
    vinculosPendentes,
    vinculosNutricao,
    vinculosTreino,
    refeicoes7,
    sessoes7,
    refeicoes30,
    sessoes30,
    compartilhados,
  ] = await Promise.all([
    prismaNutri.profissional.count(),
    prismaNutri.profissional.count({ where: { ehNutricionista: true } }),
    prismaNutri.profissional.count({ where: { ehPersonal: true } }),
    prismaNutri.cliente.count({ where: { status: StatusCliente.ATIVO } }),
    prismaNutri.cliente.count({ where: { status: StatusCliente.ARQUIVADO } }),
    prismaNutri.vinculo.count({ where: { status: StatusVinculo.ATIVO } }),
    prismaNutri.vinculo.count({ where: { status: StatusVinculo.PENDENTE } }),
    prismaNutri.vinculo.count({ where: { status: StatusVinculo.ATIVO, tipo: TipoVinculo.NUTRICAO } }),
    prismaNutri.vinculo.count({ where: { status: StatusVinculo.ATIVO, tipo: TipoVinculo.TREINO } }),
    prismaNutri.refeicao.count({ where: { registradoEm: { gte: seteDias } } }),
    prismaNutri.sessaoTreino.count({ where: { realizadoEm: { gte: seteDias } } }),
    prismaNutri.refeicao.count({ where: { registradoEm: { gte: trintaDias } } }),
    prismaNutri.sessaoTreino.count({ where: { realizadoEm: { gte: trintaDias } } }),
    // Cliente com dois vínculos ativos é, por definição, atendido por dois
    // profissionais: o índice parcial garante no máximo um vivo por tipo.
    prismaNutri.vinculo.groupBy({
      by: ["clienteId"],
      where: { status: StatusVinculo.ATIVO },
      having: { clienteId: { _count: { gt: 1 } } },
    }),
  ]);

  return {
    profissionais,
    profissionaisNutricionistas,
    profissionaisPersonais,
    clientesAtivos,
    clientesArquivados,
    vinculosAtivos,
    vinculosPendentes,
    vinculosNutricao,
    vinculosTreino,
    clientesCompartilhados: compartilhados.length,
    registros7dias: refeicoes7 + sessoes7,
    registros30dias: refeicoes30 + sessoes30,
  };
}

export interface LinhaProfissional {
  id: string;
  nome: string;
  email: string;
  ehNutricionista: boolean;
  ehPersonal: boolean;
  ehMaster: boolean;
  limitePlano: number;
  clientesAtivos: number;
  pendentes: number;
  criadoEm: Date;
}

/**
 * Listagem operacional dos profissionais: quem são e quanto do plano
 * usam. Nenhum nome de cliente aparece aqui — só a contagem.
 */
export async function buscarProfissionais(): Promise<LinhaProfissional[]> {
  const profissionais = await prismaNutri.profissional.findMany({
    orderBy: { criadoEm: "desc" },
    include: {
      _count: {
        select: {
          vinculos: { where: { status: StatusVinculo.ATIVO } },
        },
      },
    },
  });

  // Pendentes numa consulta agregada só, em vez de N+1 por profissional.
  const pendentesPorProfissional = await prismaNutri.vinculo.groupBy({
    by: ["profissionalId"],
    where: { status: StatusVinculo.PENDENTE },
    _count: { _all: true },
  });
  const pendentes = new Map(pendentesPorProfissional.map((p) => [p.profissionalId, p._count._all]));

  return profissionais.map((p) => ({
    id: p.id,
    nome: p.nome,
    email: p.email,
    ehNutricionista: p.ehNutricionista,
    ehPersonal: p.ehPersonal,
    ehMaster: p.ehMaster,
    limitePlano: p.limitePlano,
    clientesAtivos: p._count.vinculos,
    pendentes: pendentes.get(p.id) ?? 0,
    criadoEm: p.criadoEm,
  }));
}
