import { prismaNutri } from "@/lib/nutri/prisma";
import { StatusCliente, StatusVinculo, TipoVinculo } from "@/lib/cliente/schemas";

/**
 * Consultas da interface administrativa.
 *
 * O painel tem dois níveis, e a diferença entre eles é deliberada:
 *
 * 1. Visão operacional — buscarMetricasGerais e buscarProfissionais. Só
 *    agregado: quantos profissionais, quantos clientes, quanto registro
 *    entrando. Nenhum nome de cliente, nenhum dado clínico. Um teste
 *    semeia dado de saúde de propósito e afirma que estas duas não o
 *    devolvem.
 *
 * 2. Visão clínica — buscarClientes e buscarClienteCompleto. Devolvem
 *    refeição, peso e anotação. Existem porque a operação do produto pediu
 *    acesso total, e quem opera o sistema é o controlador desses dados.
 *    Ficam atrás de ehMaster e da checagem dentro da própria página, e a
 *    tela avisa em texto que ali tem dado de saúde de terceiro.
 *
 * A separação importa: mantém a visão do dia a dia limpa de dado sensível,
 * e deixa o acesso clínico ser uma escolha explícita, não um acidente.
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

// ---------------------------------------------------------------------------
// Visão clínica. Daqui pra baixo as consultas devolvem dado de saúde.
// ---------------------------------------------------------------------------

export interface LinhaCliente {
  id: string;
  nome: string;
  status: string;
  criadoEm: Date;
  /** Nome de cada profissional ativo, com o tipo de vínculo. */
  acompanhantes: { nome: string; tipo: TipoVinculo }[];
  refeicoes: number;
  sessoes: number;
  ultimoRegistroEm: Date | null;
}

/** Listagem de clientes com quem os acompanha e quanto registram. */
export async function buscarClientes(): Promise<LinhaCliente[]> {
  const clientes = await prismaNutri.cliente.findMany({
    orderBy: { criadoEm: "desc" },
    include: {
      vinculos: {
        where: { status: StatusVinculo.ATIVO },
        include: { profissional: { select: { nome: true } } },
      },
      _count: { select: { refeicoes: true, sessoesTreino: true } },
    },
  });

  // Última atividade de cada cliente em duas consultas agregadas, em vez de
  // duas por cliente.
  const [ultimaRefeicao, ultimaSessao] = await Promise.all([
    prismaNutri.refeicao.groupBy({ by: ["clienteId"], _max: { registradoEm: true } }),
    prismaNutri.sessaoTreino.groupBy({ by: ["clienteId"], _max: { realizadoEm: true } }),
  ]);
  const porCliente = new Map<string, Date>();
  for (const r of ultimaRefeicao) {
    if (r._max.registradoEm) porCliente.set(r.clienteId, r._max.registradoEm);
  }
  for (const s of ultimaSessao) {
    const atual = porCliente.get(s.clienteId);
    const data = s._max.realizadoEm;
    if (data && (!atual || data > atual)) porCliente.set(s.clienteId, data);
  }

  return clientes.map((c) => ({
    id: c.id,
    nome: c.nome,
    status: c.status,
    criadoEm: c.criadoEm,
    acompanhantes: c.vinculos.map((v) => ({ nome: v.profissional.nome, tipo: v.tipo as TipoVinculo })),
    refeicoes: c._count.refeicoes,
    sessoes: c._count.sessoesTreino,
    ultimoRegistroEm: porCliente.get(c.id) ?? null,
  }));
}

export interface ClienteCompleto {
  cliente: NonNullable<Awaited<ReturnType<typeof prismaNutri.cliente.findUnique>>>;
  vinculos: {
    id: string;
    tipo: string;
    status: string;
    profissionalNome: string;
    criadoEm: Date;
    aceitoEm: Date | null;
  }[];
  planos: { metaKcal: number; metaProteina: number; metaCarbo: number; metaGordura: number; ativo: boolean; criadoEm: Date }[];
  treinos: { nome: string; descricao: string; diasPorSemana: number; ativo: boolean; criadoEm: Date }[];
  anamneseNutricional: Awaited<ReturnType<typeof prismaNutri.anamneseNutricional.findUnique>>;
  anamneseTreino: Awaited<ReturnType<typeof prismaNutri.anamneseTreino.findUnique>>;
  refeicoes: { id: string; entradaBruta: string; kcal: number; confianca: number; registradoEm: Date }[];
  sessoes: { id: string; entradaBruta: string; realizadoEm: Date }[];
  medidas: { pesoKg: number; registradoEm: Date }[];
  /** Anotações de TODOS os profissionais — diferente da ficha, que só mostra as de quem abriu. */
  anotacoes: { id: string; texto: string; criadoEm: Date; profissionalNome: string }[];
}

/**
 * Tudo que existe sobre um cliente, sem filtro por profissional.
 *
 * É o ponto em que o Master vê mais do que qualquer profissional vê: as
 * anotações vêm de todo mundo, inclusive as que um nutricionista escreveu
 * e o personal do mesmo cliente nunca poderia ler. Só faz sentido pra
 * operação e suporte — daí ficar atrás de ehMaster.
 */
export async function buscarClienteCompleto(clienteId: string): Promise<ClienteCompleto | null> {
  const cliente = await prismaNutri.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) return null;

  const [vinculos, planos, treinos, anamneseNutricional, anamneseTreino, refeicoes, sessoes, medidas, anotacoes] =
    await Promise.all([
      prismaNutri.vinculo.findMany({
        where: { clienteId },
        include: { profissional: { select: { nome: true } } },
        orderBy: { criadoEm: "desc" },
      }),
      prismaNutri.planoNutricional.findMany({ where: { clienteId }, orderBy: { criadoEm: "desc" } }),
      prismaNutri.treinoPrescrito.findMany({ where: { clienteId }, orderBy: { criadoEm: "desc" } }),
      prismaNutri.anamneseNutricional.findUnique({ where: { clienteId } }),
      prismaNutri.anamneseTreino.findUnique({ where: { clienteId } }),
      prismaNutri.refeicao.findMany({ where: { clienteId }, orderBy: { registradoEm: "desc" }, take: 50 }),
      prismaNutri.sessaoTreino.findMany({ where: { clienteId }, orderBy: { realizadoEm: "desc" }, take: 50 }),
      prismaNutri.medida.findMany({ where: { clienteId }, orderBy: { registradoEm: "desc" }, take: 50 }),
      prismaNutri.anotacao.findMany({
        where: { clienteId },
        include: { profissional: { select: { nome: true } } },
        orderBy: { criadoEm: "desc" },
      }),
    ]);

  return {
    cliente,
    vinculos: vinculos.map((v) => ({
      id: v.id,
      tipo: v.tipo,
      status: v.status,
      profissionalNome: v.profissional.nome,
      criadoEm: v.criadoEm,
      aceitoEm: v.aceitoEm,
    })),
    planos: planos.map((p) => ({
      metaKcal: p.metaKcal,
      metaProteina: p.metaProteina,
      metaCarbo: p.metaCarbo,
      metaGordura: p.metaGordura,
      ativo: p.ativo,
      criadoEm: p.criadoEm,
    })),
    treinos: treinos.map((t) => ({
      nome: t.nome,
      descricao: t.descricao,
      diasPorSemana: t.diasPorSemana,
      ativo: t.ativo,
      criadoEm: t.criadoEm,
    })),
    anamneseNutricional,
    anamneseTreino,
    refeicoes: refeicoes.map((r) => ({
      id: r.id,
      entradaBruta: r.entradaBruta,
      kcal: r.kcal,
      confianca: r.confianca,
      registradoEm: r.registradoEm,
    })),
    sessoes: sessoes.map((s) => ({ id: s.id, entradaBruta: s.entradaBruta, realizadoEm: s.realizadoEm })),
    medidas: medidas.map((m) => ({ pesoKg: m.pesoKg, registradoEm: m.registradoEm })),
    anotacoes: anotacoes.map((a) => ({
      id: a.id,
      texto: a.texto,
      criadoEm: a.criadoEm,
      profissionalNome: a.profissional.nome,
    })),
  };
}
