import type { Cliente } from "../../../prisma/nutri/generated";
import { prismaNutri } from "@/lib/nutri/prisma";
import { StatusVinculo, TipoVinculo } from "@/lib/cliente/schemas";
import {
  calcularAderenciaSemana,
  calcularSaldoDoDia,
  estaForaDaMeta,
  estaSemRegistroHaMuitoTempo,
  limitesDaSemanaEmSaoPaulo,
  limitesDoDiaEmSaoPaulo,
  type SaldoDoDia,
} from "@/lib/nutri/aderencia";
import { calcularAderenciaTreino, estaForaDoTreino, type AderenciaTreino } from "@/lib/personal/aderencia";

function diasDesde(data: Date | null | undefined): number | null {
  if (!data) return null;
  return Math.floor((Date.now() - data.getTime()) / (24 * 60 * 60 * 1000));
}

export interface ResumoNutricao {
  saldoHoje: SaldoDoDia;
  saldoSemana: SaldoDoDia;
  foraDaMeta: boolean;
  diasSemRegistro: number | null;
  sumido: boolean;
}

export interface ResumoTreino {
  treino: { nome: string; diasPorSemana: number } | null;
  aderenciaSemana: AderenciaTreino | null;
  foraDoTreino: boolean;
  diasSemRegistro: number | null;
  sumido: boolean;
}

export interface ClienteNoPainel {
  cliente: Cliente;
  /** Preenchido só se este profissional acompanha a nutrição dele. */
  nutricao: ResumoNutricao | null;
  /** Preenchido só se este profissional acompanha o treino dele. */
  treino: ResumoTreino | null;
}

/**
 * Clientes que este profissional acompanha, com o resumo de cada lado que
 * ELE acompanha.
 *
 * O isolamento vive aqui: os blocos vêm dos vínculos ativos **deste**
 * profissional, então quem só cuida do treino nunca recebe dado de
 * refeição, mesmo que o cliente tenha um nutricionista.
 */
export async function buscarClientesDoProfissional(profissionalId: string): Promise<ClienteNoPainel[]> {
  const vinculos = await prismaNutri.vinculo.findMany({
    where: { profissionalId, status: StatusVinculo.ATIVO },
    include: { cliente: true },
    orderBy: { criadoEm: "desc" },
  });

  // Um cliente pode ter os dois vínculos com o mesmo profissional (híbrido)
  // — agrupa pra ele aparecer uma vez só, com os dois blocos.
  const porCliente = new Map<string, { cliente: Cliente; tipos: Set<string> }>();
  for (const vinculo of vinculos) {
    const atual = porCliente.get(vinculo.clienteId);
    if (atual) atual.tipos.add(vinculo.tipo);
    else porCliente.set(vinculo.clienteId, { cliente: vinculo.cliente, tipos: new Set([vinculo.tipo]) });
  }

  return Promise.all(
    Array.from(porCliente.values(), async ({ cliente, tipos }) => ({
      cliente,
      nutricao: tipos.has(TipoVinculo.NUTRICAO) ? await resumirNutricao(cliente.id) : null,
      treino: tipos.has(TipoVinculo.TREINO) ? await resumirTreino(cliente.id) : null,
    })),
  );
}

async function resumirNutricao(clienteId: string): Promise<ResumoNutricao> {
  const { inicio: inicioHoje, fim: fimHoje } = limitesDoDiaEmSaoPaulo();
  const { inicio: inicioSemana, diasDecorridos } = limitesDaSemanaEmSaoPaulo();

  const [plano, hoje, semana, ultimo] = await Promise.all([
    prismaNutri.planoNutricional.findFirst({ where: { clienteId, ativo: true }, orderBy: { criadoEm: "desc" } }),
    prismaNutri.refeicao.findMany({ where: { clienteId, registradoEm: { gte: inicioHoje, lt: fimHoje } } }),
    prismaNutri.refeicao.findMany({ where: { clienteId, registradoEm: { gte: inicioSemana, lt: fimHoje } } }),
    prismaNutri.refeicao.findFirst({ where: { clienteId }, orderBy: { registradoEm: "desc" } }),
  ]);

  const metas = plano ?? { metaKcal: 0, metaProteina: 0, metaCarbo: 0, metaGordura: 0 };
  const saldoHoje = calcularSaldoDoDia(hoje, metas);
  const diasSemRegistro = diasDesde(ultimo?.registradoEm);

  return {
    saldoHoje,
    saldoSemana: calcularAderenciaSemana(semana, metas, diasDecorridos),
    foraDaMeta: estaForaDaMeta(saldoHoje.kcal.percentual),
    diasSemRegistro,
    sumido: estaSemRegistroHaMuitoTempo(diasSemRegistro),
  };
}

async function resumirTreino(clienteId: string): Promise<ResumoTreino> {
  const { inicio: inicioSemana, fim: fimSemana } = limitesDaSemanaEmSaoPaulo();

  const [treino, semana, ultimo] = await Promise.all([
    prismaNutri.treinoPrescrito.findFirst({ where: { clienteId, ativo: true }, orderBy: { criadoEm: "desc" } }),
    prismaNutri.sessaoTreino.findMany({ where: { clienteId, realizadoEm: { gte: inicioSemana, lt: fimSemana } } }),
    prismaNutri.sessaoTreino.findFirst({ where: { clienteId }, orderBy: { realizadoEm: "desc" } }),
  ]);

  const aderenciaSemana = treino ? calcularAderenciaTreino(semana, treino.diasPorSemana) : null;
  const diasSemRegistro = diasDesde(ultimo?.realizadoEm);

  return {
    treino: treino ? { nome: treino.nome, diasPorSemana: treino.diasPorSemana } : null,
    aderenciaSemana,
    foraDoTreino: aderenciaSemana ? estaForaDoTreino(aderenciaSemana.percentual) : false,
    diasSemRegistro,
    sumido: estaSemRegistroHaMuitoTempo(diasSemRegistro),
  };
}

export interface FichaDoCliente {
  cliente: Cliente;
  acompanhaNutricao: boolean;
  acompanhaTreino: boolean;
  metas: { metaKcal: number; metaProteina: number; metaCarbo: number; metaGordura: number } | null;
  treino: { nome: string; descricao: string; diasPorSemana: number } | null;
  anamneseNutricional: Awaited<ReturnType<typeof prismaNutri.anamneseNutricional.findUnique>>;
  anamneseTreino: Awaited<ReturnType<typeof prismaNutri.anamneseTreino.findUnique>>;
  anotacoes: { id: string; texto: string; criadoEm: Date }[];
  pesos: { pesoKg: number; registradoEm: Date }[];
}

/**
 * Ficha do cliente para o profissional. Devolve null se ele não tem
 * vínculo ativo — é o que impede abrir a ficha de alguém só sabendo o id.
 * Cada bloco respeita o tipo de vínculo, e as anotações são só as dele.
 */
export async function buscarFichaDoCliente(clienteId: string, profissionalId: string): Promise<FichaDoCliente | null> {
  const vinculos = await prismaNutri.vinculo.findMany({
    where: { clienteId, profissionalId, status: StatusVinculo.ATIVO },
  });
  if (vinculos.length === 0) return null;

  const cliente = await prismaNutri.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) return null;

  const acompanhaNutricao = vinculos.some((v) => v.tipo === TipoVinculo.NUTRICAO);
  const acompanhaTreino = vinculos.some((v) => v.tipo === TipoVinculo.TREINO);

  const [plano, treino, anamneseNutricional, anamneseTreino, anotacoes, pesos] = await Promise.all([
    acompanhaNutricao
      ? prismaNutri.planoNutricional.findFirst({ where: { clienteId, ativo: true }, orderBy: { criadoEm: "desc" } })
      : null,
    acompanhaTreino
      ? prismaNutri.treinoPrescrito.findFirst({ where: { clienteId, ativo: true }, orderBy: { criadoEm: "desc" } })
      : null,
    acompanhaNutricao ? prismaNutri.anamneseNutricional.findUnique({ where: { clienteId } }) : null,
    acompanhaTreino ? prismaNutri.anamneseTreino.findUnique({ where: { clienteId } }) : null,
    // Só as anotações deste profissional: com cliente compartilhado, a
    // observação de um não aparece pro outro.
    prismaNutri.anotacao.findMany({ where: { clienteId, profissionalId }, orderBy: { criadoEm: "desc" } }),
    // Peso é medida objetiva e serve aos dois lados.
    prismaNutri.medida.findMany({ where: { clienteId }, orderBy: { registradoEm: "asc" }, take: 60 }),
  ]);

  return {
    cliente,
    acompanhaNutricao,
    acompanhaTreino,
    metas: plano
      ? {
          metaKcal: plano.metaKcal,
          metaProteina: plano.metaProteina,
          metaCarbo: plano.metaCarbo,
          metaGordura: plano.metaGordura,
        }
      : null,
    treino: treino ? { nome: treino.nome, descricao: treino.descricao, diasPorSemana: treino.diasPorSemana } : null,
    anamneseNutricional,
    anamneseTreino,
    anotacoes: anotacoes.map((a) => ({ id: a.id, texto: a.texto, criadoEm: a.criadoEm })),
    pesos: pesos.map((p) => ({ pesoKg: p.pesoKg, registradoEm: p.registradoEm })),
  };
}

/** Vínculos ativos contam a vaga do plano — pendentes ainda não. */
export async function contarVinculosAtivos(profissionalId: string): Promise<number> {
  return prismaNutri.vinculo.count({ where: { profissionalId, status: StatusVinculo.ATIVO } });
}

export interface SolicitacaoEnviada {
  id: string;
  clienteNome: string;
  tipo: TipoVinculo;
  criadoEm: Date;
}

/**
 * Pedidos que este profissional mandou e o cliente ainda não respondeu.
 *
 * Devolve só o nome: enquanto o cliente não aceita, não existe vínculo, e
 * portanto nada de dado de saúde dele pode aparecer aqui.
 */
export async function buscarSolicitacoesEnviadas(profissionalId: string): Promise<SolicitacaoEnviada[]> {
  const pendentes = await prismaNutri.vinculo.findMany({
    where: { profissionalId, status: StatusVinculo.PENDENTE },
    include: { cliente: { select: { nome: true } } },
    orderBy: { criadoEm: "desc" },
  });

  return pendentes.map((v) => ({
    id: v.id,
    clienteNome: v.cliente.nome,
    tipo: v.tipo as TipoVinculo,
    criadoEm: v.criadoEm,
  }));
}
