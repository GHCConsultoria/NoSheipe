import type { Cliente } from "../../../prisma/nutri/generated";
import { prismaNutri } from "@/lib/nutri/prisma";
import { StatusVinculo, TipoVinculo } from "@/lib/cliente/schemas";
import type { ExercicioPrescritoDado } from "@/lib/cliente/consultas";
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
import { comparar, type Comparacao } from "@/lib/profissional/comparacao";
import { montarOfensiva } from "@/lib/cliente/consultas";
import { calcularRecordes } from "@/lib/cliente/corrida";

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
  treino: { id: string; nome: string; descricao: string; diasPorSemana: number; exercicios: ExercicioPrescritoDado[] } | null;
  anamneseNutricional: Awaited<ReturnType<typeof prismaNutri.anamneseNutricional.findUnique>>;
  anamneseTreino: Awaited<ReturnType<typeof prismaNutri.anamneseTreino.findUnique>>;
  anotacoes: { id: string; texto: string; criadoEm: Date }[];
  /** Engajamento do cliente com o app — respeitando o isolamento por vínculo. */
  engajamento: {
    ofensivaDias: number;
    /** Só pra quem acompanha o treino. */
    corrida: { km: number; melhorPaceSegKm: number | null; quantidade: number } | null;
    /** Só pra quem acompanha a nutrição: copos d'água nos últimos 7 dias. */
    coposAgua7d: number | null;
  };
  recados: { id: string; texto: string; criadoEm: Date; lido: boolean }[];
  pesos: { pesoKg: number; registradoEm: Date }[];
  templatesNutricao: { id: string; nome: string; metaKcal: number; metaProteina: number; metaCarbo: number; metaGordura: number }[];
  templatesTreino: { id: string; nome: string; descricao: string; diasPorSemana: number }[];
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
  const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    plano,
    treino,
    anamneseNutricional,
    anamneseTreino,
    anotacoes,
    recados,
    pesos,
    templatesNutricao,
    templatesTreino,
    ofensiva,
    corridasRaw,
    aguaSemana,
  ] = await Promise.all([
    acompanhaNutricao
      ? prismaNutri.planoNutricional.findFirst({ where: { clienteId, ativo: true }, orderBy: { criadoEm: "desc" } })
      : null,
    acompanhaTreino
      ? prismaNutri.treinoPrescrito.findFirst({
          where: { clienteId, ativo: true },
          orderBy: { criadoEm: "desc" },
          include: { exercicios: { orderBy: { ordem: "asc" } } },
        })
      : null,
    acompanhaNutricao ? prismaNutri.anamneseNutricional.findUnique({ where: { clienteId } }) : null,
    acompanhaTreino ? prismaNutri.anamneseTreino.findUnique({ where: { clienteId } }) : null,
    // Só as anotações deste profissional: com cliente compartilhado, a
    // observação de um não aparece pro outro.
    prismaNutri.anotacao.findMany({ where: { clienteId, profissionalId }, orderBy: { criadoEm: "desc" } }),
    // Só os recados que ESTE profissional mandou — o histórico do que ele
    // enviou, com o status de leitura.
    prismaNutri.recado.findMany({ where: { clienteId, profissionalId }, orderBy: { criadoEm: "desc" }, take: 20 }),
    // Peso é medida objetiva e serve aos dois lados.
    prismaNutri.medida.findMany({ where: { clienteId }, orderBy: { registradoEm: "asc" }, take: 60 }),
    // Templates do profissional — só do lado que ele acompanha neste cliente.
    acompanhaNutricao
      ? prismaNutri.template.findMany({
          where: { profissionalId, tipo: TipoVinculo.NUTRICAO },
          orderBy: { criadoEm: "desc" },
        })
      : [],
    acompanhaTreino
      ? prismaNutri.template.findMany({
          where: { profissionalId, tipo: TipoVinculo.TREINO },
          orderBy: { criadoEm: "desc" },
        })
      : [],
    // Ofensiva é sinal geral de engajamento — vale pros dois lados.
    montarOfensiva(clienteId),
    // Corrida só pra quem acompanha o treino (isolamento).
    acompanhaTreino ? prismaNutri.corrida.findMany({ where: { clienteId }, take: 200 }) : [],
    // Água só pra quem acompanha a nutrição.
    acompanhaNutricao
      ? prismaNutri.registroAgua.findMany({
          where: { clienteId, registradoEm: { gte: seteDiasAtras } },
          select: { id: true },
        })
      : [],
  ]);

  const recordesCorrida = calcularRecordes(corridasRaw);

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
    treino: treino
      ? {
          id: treino.id,
          nome: treino.nome,
          descricao: treino.descricao,
          diasPorSemana: treino.diasPorSemana,
          exercicios: treino.exercicios.map((e) => ({
            id: e.id,
            nome: e.nome,
            ordem: e.ordem,
            seriesAlvo: e.seriesAlvo,
            repsAlvo: e.repsAlvo,
            cargaAlvoKg: e.cargaAlvoKg,
            descansoSeg: e.descansoSeg,
          })),
        }
      : null,
    anamneseNutricional,
    anamneseTreino,
    anotacoes: anotacoes.map((a) => ({ id: a.id, texto: a.texto, criadoEm: a.criadoEm })),
    engajamento: {
      ofensivaDias: ofensiva.dias,
      corrida: acompanhaTreino
        ? {
            km: Math.round(recordesCorrida.totalMetros / 100) / 10,
            melhorPaceSegKm: recordesCorrida.melhorPaceSegKm,
            quantidade: recordesCorrida.quantidade,
          }
        : null,
      coposAgua7d: acompanhaNutricao ? aguaSemana.length : null,
    },
    recados: recados.map((r) => ({ id: r.id, texto: r.texto, criadoEm: r.criadoEm, lido: r.lidoEm !== null })),
    pesos: pesos.map((p) => ({ pesoKg: p.pesoKg, registradoEm: p.registradoEm })),
    templatesNutricao: templatesNutricao.map((t) => ({
      id: t.id,
      nome: t.nome,
      metaKcal: t.metaKcal ?? 0,
      metaProteina: t.metaProteina ?? 0,
      metaCarbo: t.metaCarbo ?? 0,
      metaGordura: t.metaGordura ?? 0,
    })),
    templatesTreino: templatesTreino.map((t) => ({
      id: t.id,
      nome: t.nome,
      descricao: t.descricao ?? "",
      diasPorSemana: t.diasPorSemana ?? 3,
    })),
  };
}

export interface ComparacaoSemanas {
  /** Comparações de nutrição — null se o profissional não acompanha a dieta. */
  nutricao: { dias: Comparacao; refeicoes: Comparacao; kcalMedia: Comparacao } | null;
  /** Comparações de treino — null se ele não acompanha o treino. */
  treino: { sessoes: Comparacao; dias: Comparacao } | null;
}

const UMA_SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

/** Chave yyyy-mm-dd em SP — pra contar dias distintos com registro. */
const CHAVE_DIA_SP = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });

function diasDistintos(datas: Date[]): number {
  const dias = new Set<string>();
  for (const d of datas) dias.add(CHAVE_DIA_SP.format(d));
  return dias.size;
}

/**
 * Compara os últimos 7 dias com os 7 anteriores — janelas móveis, e não
 * semana-calendário, pra não comparar uma segunda-feira recém-começada
 * contra uma semana inteira. Só devolve o lado que o profissional acompanha.
 */
export async function buscarComparacaoSemanas(
  clienteId: string,
  acompanhaNutricao: boolean,
  acompanhaTreino: boolean,
): Promise<ComparacaoSemanas> {
  const agora = Date.now();
  const inicioAtual = new Date(agora - UMA_SEMANA_MS);
  const inicioAnterior = new Date(agora - 2 * UMA_SEMANA_MS);

  const [nutricao, treino] = await Promise.all([
    acompanhaNutricao ? compararNutricao(clienteId, inicioAnterior, inicioAtual) : Promise.resolve(null),
    acompanhaTreino ? compararTreino(clienteId, inicioAnterior, inicioAtual) : Promise.resolve(null),
  ]);

  return { nutricao, treino };
}

async function compararNutricao(clienteId: string, inicioAnterior: Date, inicioAtual: Date) {
  const [anterior, atual] = await Promise.all([
    prismaNutri.refeicao.findMany({
      where: { clienteId, registradoEm: { gte: inicioAnterior, lt: inicioAtual } },
      select: { registradoEm: true, kcal: true },
    }),
    prismaNutri.refeicao.findMany({
      where: { clienteId, registradoEm: { gte: inicioAtual } },
      select: { registradoEm: true, kcal: true },
    }),
  ]);

  const mediaKcal = (rs: { kcal: number }[]) => (rs.length > 0 ? Math.round(rs.reduce((s, r) => s + r.kcal, 0) / rs.length) : 0);

  return {
    dias: comparar(diasDistintos(atual.map((r) => r.registradoEm)), diasDistintos(anterior.map((r) => r.registradoEm))),
    refeicoes: comparar(atual.length, anterior.length),
    kcalMedia: comparar(mediaKcal(atual), mediaKcal(anterior)),
  };
}

async function compararTreino(clienteId: string, inicioAnterior: Date, inicioAtual: Date) {
  const [anterior, atual] = await Promise.all([
    prismaNutri.sessaoTreino.findMany({
      where: { clienteId, realizadoEm: { gte: inicioAnterior, lt: inicioAtual } },
      select: { realizadoEm: true },
    }),
    prismaNutri.sessaoTreino.findMany({
      where: { clienteId, realizadoEm: { gte: inicioAtual } },
      select: { realizadoEm: true },
    }),
  ]);

  return {
    sessoes: comparar(atual.length, anterior.length),
    dias: comparar(diasDistintos(atual.map((s) => s.realizadoEm)), diasDistintos(anterior.map((s) => s.realizadoEm))),
  };
}

const FORMATADOR_PRECO = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export interface OfertaDoProfissional {
  id: string;
  titulo: string;
  descricao: string;
  preco: string;
}

/** Ofertas ativas do profissional, pra ele gerenciar no /pro/conta. */
export async function buscarOfertasDoProfissional(profissionalId: string): Promise<OfertaDoProfissional[]> {
  const ofertas = await prismaNutri.oferta.findMany({
    where: { profissionalId, ativo: true },
    orderBy: { criadoEm: "desc" },
  });
  return ofertas.map((o) => ({
    id: o.id,
    titulo: o.titulo,
    descricao: o.descricao,
    preco: FORMATADOR_PRECO.format(o.precoCentavos / 100),
  }));
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
