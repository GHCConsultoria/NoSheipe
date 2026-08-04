import type { Cliente } from "../../../prisma/nutri/generated";
import { prismaNutri } from "@/lib/nutri/prisma";
import { StatusCliente, StatusVinculo, TipoVinculo } from "@/lib/cliente/schemas";
import {
  calcularSaldoDoDia,
  limitesDaSemanaEmSaoPaulo,
  limitesDoDiaEmSaoPaulo,
  type SaldoDoDia,
} from "@/lib/nutri/aderencia";
import { calcularAderenciaTreino, type AderenciaTreino } from "@/lib/personal/aderencia";
import { calcularHidratacao, type Hidratacao } from "@/lib/cliente/hidratacao";
import { calcularOfensiva, type Ofensiva } from "@/lib/cliente/ofensiva";
import { calcularRecordes, paceSegundosPorKm, type Recordes } from "@/lib/cliente/corrida";
import { ordenarRanking, type EntradaRanking } from "@/lib/cliente/ranking";

export async function buscarClientePorToken(token: string) {
  const cliente = await prismaNutri.cliente.findUnique({ where: { tokenAcesso: token } });
  if (!cliente || cliente.status !== StatusCliente.ATIVO) {
    return null;
  }
  return cliente;
}

/** Um vínculo como o cliente enxerga: quem é a pessoa e em quê. */
export interface VinculoDoCliente {
  id: string;
  tipo: TipoVinculo;
  profissionalNome: string;
}

/**
 * Vínculos vivos do cliente. PENDENTE e ATIVO vêm juntos numa consulta só
 * porque a home precisa dos dois: o que já vale e o que está esperando
 * resposta dele.
 */
async function vinculosVivos(clienteId: string) {
  const vinculos = await prismaNutri.vinculo.findMany({
    where: { clienteId, status: { not: StatusVinculo.ENCERRADO } },
    include: { profissional: { select: { nome: true } } },
    orderBy: { criadoEm: "asc" },
  });

  const mapear = (status: StatusVinculo): VinculoDoCliente[] =>
    vinculos
      .filter((v) => v.status === status)
      .map((v) => ({ id: v.id, tipo: v.tipo as TipoVinculo, profissionalNome: v.profissional.nome }));

  const ativos = mapear(StatusVinculo.ATIVO);
  return {
    ativos,
    pendentes: mapear(StatusVinculo.PENDENTE),
    temNutricao: ativos.some((v) => v.tipo === TipoVinculo.NUTRICAO),
    temTreino: ativos.some((v) => v.tipo === TipoVinculo.TREINO),
  };
}

export interface BlocoNutricao {
  saldo: SaldoDoDia;
  registrosHoje: {
    id: string;
    entradaBruta: string;
    kcal: number;
    proteina: number;
    carbo: number;
    gordura: number;
    confianca: number;
    macrosPendentes: boolean;
    ajustadoManualmente: boolean;
    horario: string;
  }[];
  favoritos: { id: string; descricao: string }[];
  ultimoPesoKg: number | null;
  /** Série de peso pro gráfico (cronológica); `iso` deixa a UI filtrar por período. */
  pesoSerie: { valor: number; rotulo: string; iso: string }[];
}

export interface BlocoTreino {
  treino: { nome: string; descricao: string; diasPorSemana: number } | null;
  aderenciaSemana: AderenciaTreino | null;
  sessoesHoje: { id: string; entradaBruta: string; horario: string }[];
}

export interface RecadoDoCliente {
  id: string;
  texto: string;
  profissionalNome: string;
  quando: string;
  lido: boolean;
}

export interface PainelDoCliente {
  cliente: Cliente;
  /** null quando o cliente não tem nutricionista — o bloco nem aparece. */
  nutricao: BlocoNutricao | null;
  /** null quando o cliente não tem personal. */
  treino: BlocoTreino | null;
  /** Hidratação do dia — independe de vínculo; todo mundo bebe água. */
  hidratacao: Hidratacao;
  /** Ofensiva: dias seguidos com registro — independe de vínculo. */
  ofensiva: Ofensiva;
  /** Semana atual: quais dias (seg..dom) tiveram registro, e qual é hoje. */
  semana: { dias: boolean[]; hoje: number };
  /** Recados que os profissionais mandaram — mais recentes primeiro. */
  recados: RecadoDoCliente[];
  /** Quem acompanha hoje — o cliente pode encerrar qualquer um. */
  vinculosAtivos: VinculoDoCliente[];
  /** Profissionais que pediram acesso e aguardam a resposta dele. */
  solicitacoes: VinculoDoCliente[];
}

const FORMATADOR_HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
});

/** Chave "yyyy-mm-dd" no fuso de SP — a mesma base da ofensiva e do histórico. */
const CHAVE_DIA_SP = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });

/** Rótulo curto dd/mm pro gráfico de peso. */
const FORMATADOR_DATA_CURTA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
});

/** Janela pra trás usada pra medir a ofensiva. Passado isto, não conta. */
const DIAS_JANELA_OFENSIVA = 400;

/**
 * Ofensiva do cliente: dias-calendário seguidos com QUALQUER registro
 * (refeição, treino ou água). Junta só os carimbos de data das três tabelas
 * numa janela larga e delega a contagem à função pura.
 */
export async function montarOfensiva(clienteId: string): Promise<Ofensiva> {
  const desde = new Date(Date.now() - DIAS_JANELA_OFENSIVA * 24 * 60 * 60 * 1000);

  const [refeicoes, sessoes, aguas] = await Promise.all([
    prismaNutri.refeicao.findMany({ where: { clienteId, registradoEm: { gte: desde } }, select: { registradoEm: true } }),
    prismaNutri.sessaoTreino.findMany({
      where: { clienteId, realizadoEm: { gte: desde } },
      select: { realizadoEm: true },
    }),
    prismaNutri.registroAgua.findMany({
      where: { clienteId, registradoEm: { gte: desde } },
      select: { registradoEm: true },
    }),
  ]);

  const dias = new Set<string>();
  for (const r of refeicoes) dias.add(CHAVE_DIA_SP.format(r.registradoEm));
  for (const s of sessoes) dias.add(CHAVE_DIA_SP.format(s.realizadoEm));
  for (const a of aguas) dias.add(CHAVE_DIA_SP.format(a.registradoEm));

  return calcularOfensiva(dias, CHAVE_DIA_SP.format(new Date()));
}

/** Índice do dia da semana em SP: segunda=0 .. domingo=6. */
function indiceDiaSemana(data: Date): number {
  const chave = CHAVE_DIA_SP.format(data); // yyyy-mm-dd em SP
  const dow = new Date(`${chave}T12:00:00.000Z`).getUTCDay(); // 0=domingo..6=sábado
  return (dow + 6) % 7;
}

/**
 * Dias da semana atual (segunda a domingo) com QUALQUER registro — vira a
 * fileira de chamas da "constância". `hoje` é o índice do dia corrente, pra
 * UI destacar a casa de hoje.
 */
async function montarSemana(clienteId: string): Promise<{ dias: boolean[]; hoje: number }> {
  const { inicio, fim } = limitesDaSemanaEmSaoPaulo();

  const [refeicoes, sessoes, aguas] = await Promise.all([
    prismaNutri.refeicao.findMany({
      where: { clienteId, registradoEm: { gte: inicio, lt: fim } },
      select: { registradoEm: true },
    }),
    prismaNutri.sessaoTreino.findMany({
      where: { clienteId, realizadoEm: { gte: inicio, lt: fim } },
      select: { realizadoEm: true },
    }),
    prismaNutri.registroAgua.findMany({
      where: { clienteId, registradoEm: { gte: inicio, lt: fim } },
      select: { registradoEm: true },
    }),
  ]);

  const dias = Array<boolean>(7).fill(false);
  const marcar = (d: Date) => {
    dias[indiceDiaSemana(d)] = true;
  };
  for (const r of refeicoes) marcar(r.registradoEm);
  for (const s of sessoes) marcar(s.realizadoEm);
  for (const a of aguas) marcar(a.registradoEm);

  return { dias, hoje: indiceDiaSemana(new Date()) };
}

/** Recados que os profissionais mandaram pro cliente, mais recentes primeiro. */
async function montarRecados(clienteId: string): Promise<RecadoDoCliente[]> {
  const recados = await prismaNutri.recado.findMany({
    where: { clienteId },
    include: { profissional: { select: { nome: true } } },
    orderBy: { criadoEm: "desc" },
    take: 20,
  });

  return recados.map((r) => ({
    id: r.id,
    texto: r.texto,
    profissionalNome: r.profissional.nome,
    quando: FORMATADOR_DATA_CURTA.format(r.criadoEm),
    lido: r.lidoEm !== null,
  }));
}

/**
 * Tudo que a home do cliente precisa, numa consulta só: o progresso do dia
 * em dieta e em treino lado a lado.
 *
 * Cada bloco só vem se existir vínculo ativo do tipo correspondente — é o
 * que faz a tela se ajustar sozinha a quem tem só nutricionista, só
 * personal, ou os dois.
 */
export async function buscarPainelDoCliente(cliente: Cliente): Promise<PainelDoCliente> {
  const { ativos, pendentes, temNutricao, temTreino } = await vinculosVivos(cliente.id);
  const { inicio: inicioHoje, fim: fimHoje } = limitesDoDiaEmSaoPaulo();

  const [nutricao, treino, aguaHoje, ofensiva, recados, semana] = await Promise.all([
    temNutricao ? montarBlocoNutricao(cliente.id, inicioHoje, fimHoje) : Promise.resolve(null),
    temTreino ? montarBlocoTreino(cliente.id, inicioHoje, fimHoje) : Promise.resolve(null),
    prismaNutri.registroAgua.findMany({
      where: { clienteId: cliente.id, registradoEm: { gte: inicioHoje, lt: fimHoje } },
      select: { ml: true },
    }),
    montarOfensiva(cliente.id),
    montarRecados(cliente.id),
    montarSemana(cliente.id),
  ]);

  const hidratacao = calcularHidratacao(aguaHoje, cliente.metaAguaMl);

  return {
    cliente,
    nutricao,
    treino,
    hidratacao,
    ofensiva,
    semana,
    recados,
    vinculosAtivos: ativos,
    solicitacoes: pendentes,
  };
}

async function montarBlocoNutricao(clienteId: string, inicioHoje: Date, fimHoje: Date): Promise<BlocoNutricao> {
  // Série de peso longa (até ~2 anos), cronológica — o gráfico filtra por
  // período no cliente (dia/semana/mês/6M/tudo) e daqui sai também a última
  // medida (o topo da série), sem uma segunda consulta só pro "último".
  const desdePeso = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000);

  const [plano, refeicoes, favoritos, medidas] = await Promise.all([
    prismaNutri.planoNutricional.findFirst({ where: { clienteId, ativo: true }, orderBy: { criadoEm: "desc" } }),
    prismaNutri.refeicao.findMany({
      where: { clienteId, registradoEm: { gte: inicioHoje, lt: fimHoje } },
      orderBy: { registradoEm: "asc" },
    }),
    prismaNutri.favorito.findMany({ where: { clienteId }, orderBy: { criadoEm: "desc" }, take: 6 }),
    prismaNutri.medida.findMany({
      where: { clienteId, registradoEm: { gte: desdePeso } },
      orderBy: { registradoEm: "asc" },
      take: 500,
    }),
  ]);

  const pesoSerie = medidas.map((m) => ({
    valor: m.pesoKg,
    rotulo: FORMATADOR_DATA_CURTA.format(m.registradoEm),
    iso: m.registradoEm.toISOString(),
  }));
  const ultimoPesoKg = medidas.length > 0 ? medidas[medidas.length - 1].pesoKg : null;

  // Sem plano ativo as metas ficam zeradas — calcularSaldoDoDia já devolve
  // 0% nesse caso, em vez de inventar um número.
  const metas = plano ?? { metaKcal: 0, metaProteina: 0, metaCarbo: 0, metaGordura: 0 };

  return {
    saldo: calcularSaldoDoDia(refeicoes, metas),
    registrosHoje: refeicoes.map((r) => ({
      id: r.id,
      entradaBruta: r.entradaBruta,
      kcal: r.kcal,
      proteina: r.proteina,
      carbo: r.carbo,
      gordura: r.gordura,
      confianca: r.confianca,
      macrosPendentes: r.macrosPendentes,
      ajustadoManualmente: r.ajustadoManualmente,
      horario: FORMATADOR_HORA.format(r.registradoEm),
    })),
    favoritos: favoritos.map((f) => ({ id: f.id, descricao: f.descricao })),
    ultimoPesoKg,
    pesoSerie,
  };
}

async function montarBlocoTreino(clienteId: string, inicioHoje: Date, fimHoje: Date): Promise<BlocoTreino> {
  const { inicio: inicioSemana, fim: fimSemana } = limitesDaSemanaEmSaoPaulo();

  const [treino, sessoesSemana, sessoesHoje] = await Promise.all([
    prismaNutri.treinoPrescrito.findFirst({ where: { clienteId, ativo: true }, orderBy: { criadoEm: "desc" } }),
    prismaNutri.sessaoTreino.findMany({
      where: { clienteId, realizadoEm: { gte: inicioSemana, lt: fimSemana } },
    }),
    prismaNutri.sessaoTreino.findMany({
      where: { clienteId, realizadoEm: { gte: inicioHoje, lt: fimHoje } },
      orderBy: { realizadoEm: "asc" },
    }),
  ]);

  return {
    treino: treino ? { nome: treino.nome, descricao: treino.descricao, diasPorSemana: treino.diasPorSemana } : null,
    aderenciaSemana: treino ? calcularAderenciaTreino(sessoesSemana, treino.diasPorSemana) : null,
    sessoesHoje: sessoesHoje.map((s) => ({
      id: s.id,
      entradaBruta: s.entradaBruta,
      horario: FORMATADOR_HORA.format(s.realizadoEm),
    })),
  };
}

/** Histórico dos últimos N dias, agrupado por dia-calendário em SP. */
export async function buscarHistoricoDeDias(clienteId: string, dias = 14) {
  const { inicio: inicioHoje, fim: fimHoje } = limitesDoDiaEmSaoPaulo();
  const inicio = new Date(inicioHoje.getTime() - (dias - 1) * 24 * 60 * 60 * 1000);

  const [plano, refeicoes] = await Promise.all([
    prismaNutri.planoNutricional.findFirst({ where: { clienteId, ativo: true }, orderBy: { criadoEm: "desc" } }),
    prismaNutri.refeicao.findMany({
      where: { clienteId, registradoEm: { gte: inicio, lt: fimHoje } },
      orderBy: { registradoEm: "desc" },
    }),
  ]);

  const metas = plano ?? { metaKcal: 0, metaProteina: 0, metaCarbo: 0, metaGordura: 0 };
  const chaveDoDia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });

  const porDia = new Map<string, typeof refeicoes>();
  for (const refeicao of refeicoes) {
    const chave = chaveDoDia.format(refeicao.registradoEm);
    const lista = porDia.get(chave);
    if (lista) lista.push(refeicao);
    else porDia.set(chave, [refeicao]);
  }

  // diaChave é yyyy-mm-dd em America/Sao_Paulo.
  return Array.from(porDia, ([diaChave, registros]) => ({
    diaChave,
    saldo: calcularSaldoDoDia(registros, metas),
    quantidade: registros.length,
  }));
}

/**
 * O que a barra de rodapé precisa saber, sem carregar o painel inteiro:
 * quantos pedidos esperam resposta (o distintivo) e quais vínculos ativos
 * existem — a barra mostra "Diário" e o "+" só com nutrição, e "Treino" só
 * com personal. Sem o vínculo do tipo, a aba nem aparece.
 */
export async function buscarResumoDaNavegacao(clienteId: string) {
  const [pendentes, nutricaoAtiva, treinoAtivo] = await Promise.all([
    prismaNutri.vinculo.count({ where: { clienteId, status: StatusVinculo.PENDENTE } }),
    prismaNutri.vinculo.findFirst({
      where: { clienteId, status: StatusVinculo.ATIVO, tipo: TipoVinculo.NUTRICAO },
      select: { id: true },
    }),
    prismaNutri.vinculo.findFirst({
      where: { clienteId, status: StatusVinculo.ATIVO, tipo: TipoVinculo.TREINO },
      select: { id: true },
    }),
  ]);
  return { pendentes, temNutricao: nutricaoAtiva !== null, temTreino: treinoAtivo !== null };
}

const FORMATADOR_DIA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});

export interface TreinoDoClienteDados {
  treino: { nome: string; descricao: string; diasPorSemana: number } | null;
  aderenciaSemana: AderenciaTreino | null;
  sessoes: { id: string; entradaBruta: string; dia: string; horario: string }[];
}

/**
 * Tudo que a aba Treino precisa: o treino prescrito ativo, a aderência da
 * semana (mesmo cálculo do anel da home) e as últimas sessões registradas —
 * histórico mais fundo que o "hoje" do painel.
 */
export async function buscarTreinoDoCliente(clienteId: string, dias = 14): Promise<TreinoDoClienteDados> {
  const { inicio: inicioSemana, fim: fimSemana } = limitesDaSemanaEmSaoPaulo();
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

  const [treino, sessoesSemana, sessoes] = await Promise.all([
    prismaNutri.treinoPrescrito.findFirst({ where: { clienteId, ativo: true }, orderBy: { criadoEm: "desc" } }),
    prismaNutri.sessaoTreino.findMany({ where: { clienteId, realizadoEm: { gte: inicioSemana, lt: fimSemana } } }),
    prismaNutri.sessaoTreino.findMany({
      where: { clienteId, realizadoEm: { gte: desde } },
      orderBy: { realizadoEm: "desc" },
      take: 30,
    }),
  ]);

  return {
    treino: treino ? { nome: treino.nome, descricao: treino.descricao, diasPorSemana: treino.diasPorSemana } : null,
    aderenciaSemana: treino ? calcularAderenciaTreino(sessoesSemana, treino.diasPorSemana) : null,
    sessoes: sessoes.map((s) => ({
      id: s.id,
      entradaBruta: s.entradaBruta,
      dia: FORMATADOR_DIA.format(s.realizadoEm),
      horario: FORMATADOR_HORA.format(s.realizadoEm),
    })),
  };
}

export interface CorridaDoCliente {
  id: string;
  distanciaMetros: number;
  duracaoSegundos: number;
  paceSegKm: number;
  dia: string;
  horario: string;
}

export interface CorridasDados {
  recordes: Recordes;
  corridas: CorridaDoCliente[];
}

/**
 * Corridas do cliente + recordes pessoais. Os recordes olham TODO o
 * histórico (take alto); a lista mostra só as mais recentes. Pace derivado
 * na hora a partir de metros/segundos.
 */
export async function buscarCorridasDoCliente(clienteId: string): Promise<CorridasDados> {
  const corridas = await prismaNutri.corrida.findMany({
    where: { clienteId },
    orderBy: { realizadoEm: "desc" },
    take: 200,
  });

  return {
    recordes: calcularRecordes(corridas),
    corridas: corridas.slice(0, 12).map((c) => ({
      id: c.id,
      distanciaMetros: c.distanciaMetros,
      duracaoSegundos: c.duracaoSegundos,
      paceSegKm: paceSegundosPorKm(c.distanciaMetros, c.duracaoSegundos),
      dia: FORMATADOR_DIA.format(c.realizadoEm),
      horario: FORMATADOR_HORA.format(c.realizadoEm),
    })),
  };
}

export interface RankingRBP {
  participa: boolean;
  apelido: string | null;
  /** Top 10 do mês. */
  top: EntradaRanking[];
  /** A entrada do próprio cliente (mesmo fora do top 10), ou null se não correu. */
  minhaEntrada: EntradaRanking | null;
  total: number;
}

/**
 * Ranking RBP do mês: soma de km por cliente que OPTOU por participar, no
 * mês-calendário em São Paulo. Só entra quem tem participaRanking, e aparece
 * pelo apelido — nunca o nome real. A agregação é em memória (cedo, o volume
 * é pequeno); depois vira uma soma no banco se precisar.
 */
export async function buscarRankingRBP(cliente: {
  id: string;
  participaRanking: boolean;
  apelidoRanking: string | null;
}): Promise<RankingRBP> {
  // Início do mês-calendário em SP (dia 01, 00:00 local), via o helper de dia.
  const chave = CHAVE_DIA_SP.format(new Date()); // yyyy-mm-dd
  const primeiroDoMes = new Date(`${chave.slice(0, 7)}-01T12:00:00.000Z`);
  const { inicio } = limitesDoDiaEmSaoPaulo(primeiroDoMes);

  const corridas = await prismaNutri.corrida.findMany({
    where: { realizadoEm: { gte: inicio }, cliente: { participaRanking: true } },
    select: { clienteId: true, distanciaMetros: true, cliente: { select: { apelidoRanking: true } } },
  });

  const porCliente = new Map<string, { apelido: string; metros: number }>();
  for (const c of corridas) {
    const apelido = c.cliente.apelidoRanking ?? "Anônimo";
    const atual = porCliente.get(c.clienteId);
    if (atual) atual.metros += c.distanciaMetros;
    else porCliente.set(c.clienteId, { apelido, metros: c.distanciaMetros });
  }

  const ordenado = ordenarRanking(
    Array.from(porCliente, ([clienteId, v]) => ({ clienteId, apelido: v.apelido, metros: v.metros })),
    cliente.id,
  );

  return {
    participa: cliente.participaRanking,
    apelido: cliente.apelidoRanking,
    top: ordenado.slice(0, 10),
    minhaEntrada: ordenado.find((e) => e.ehVoce) ?? null,
    total: ordenado.length,
  };
}

const FORMATADOR_PRECO = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export interface OfertaParaCliente {
  id: string;
  titulo: string;
  descricao: string;
  preco: string;
  profissionalNome: string;
}

/**
 * Ofertas do Marketplace que o cliente vê: as dos profissionais que o
 * acompanham (vínculo ativo). Nada de vitrine de estranho no v1 — o que
 * aparece é do time dele.
 */
export async function buscarOfertasParaCliente(clienteId: string): Promise<OfertaParaCliente[]> {
  const vinculos = await prismaNutri.vinculo.findMany({
    where: { clienteId, status: StatusVinculo.ATIVO },
    select: { profissionalId: true },
  });
  const profissionaisIds = Array.from(new Set(vinculos.map((v) => v.profissionalId)));
  if (profissionaisIds.length === 0) return [];

  const ofertas = await prismaNutri.oferta.findMany({
    where: { ativo: true, profissionalId: { in: profissionaisIds } },
    include: { profissional: { select: { nome: true } } },
    orderBy: { criadoEm: "desc" },
  });

  return ofertas.map((o) => ({
    id: o.id,
    titulo: o.titulo,
    descricao: o.descricao,
    preco: FORMATADOR_PRECO.format(o.precoCentavos / 100),
    profissionalNome: o.profissional.nome,
  }));
}

export async function buscarPesoDoCliente(clienteId: string, dias = 90) {
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  return prismaNutri.medida.findMany({
    where: { clienteId, registradoEm: { gte: desde } },
    orderBy: { registradoEm: "asc" },
  });
}
