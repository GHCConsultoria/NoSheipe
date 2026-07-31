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
    horario: string;
  }[];
  favoritos: { id: string; descricao: string }[];
  ultimoPesoKg: number | null;
}

export interface BlocoTreino {
  treino: { nome: string; descricao: string; diasPorSemana: number } | null;
  aderenciaSemana: AderenciaTreino | null;
  sessoesHoje: { id: string; entradaBruta: string; horario: string }[];
}

export interface PainelDoCliente {
  cliente: Cliente;
  /** null quando o cliente não tem nutricionista — o bloco nem aparece. */
  nutricao: BlocoNutricao | null;
  /** null quando o cliente não tem personal. */
  treino: BlocoTreino | null;
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

  const [nutricao, treino] = await Promise.all([
    temNutricao ? montarBlocoNutricao(cliente.id, inicioHoje, fimHoje) : Promise.resolve(null),
    temTreino ? montarBlocoTreino(cliente.id, inicioHoje, fimHoje) : Promise.resolve(null),
  ]);

  return { cliente, nutricao, treino, vinculosAtivos: ativos, solicitacoes: pendentes };
}

async function montarBlocoNutricao(clienteId: string, inicioHoje: Date, fimHoje: Date): Promise<BlocoNutricao> {
  const [plano, refeicoes, favoritos, ultimaMedida] = await Promise.all([
    prismaNutri.planoNutricional.findFirst({ where: { clienteId, ativo: true }, orderBy: { criadoEm: "desc" } }),
    prismaNutri.refeicao.findMany({
      where: { clienteId, registradoEm: { gte: inicioHoje, lt: fimHoje } },
      orderBy: { registradoEm: "asc" },
    }),
    prismaNutri.favorito.findMany({ where: { clienteId }, orderBy: { criadoEm: "desc" }, take: 6 }),
    prismaNutri.medida.findFirst({ where: { clienteId }, orderBy: { registradoEm: "desc" } }),
  ]);

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
      horario: FORMATADOR_HORA.format(r.registradoEm),
    })),
    favoritos: favoritos.map((f) => ({ id: f.id, descricao: f.descricao })),
    ultimoPesoKg: ultimaMedida?.pesoKg ?? null,
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
 * quantos pedidos esperam resposta (o distintivo) e se existe nutrição
 * ativa (sem ela não há histórico de dieta pra mostrar).
 */
export async function buscarResumoDaNavegacao(clienteId: string) {
  const [pendentes, nutricaoAtiva] = await Promise.all([
    prismaNutri.vinculo.count({ where: { clienteId, status: StatusVinculo.PENDENTE } }),
    prismaNutri.vinculo.findFirst({
      where: { clienteId, status: StatusVinculo.ATIVO, tipo: TipoVinculo.NUTRICAO },
      select: { id: true },
    }),
  ]);
  return { pendentes, temNutricao: nutricaoAtiva !== null };
}

export async function buscarPesoDoCliente(clienteId: string, dias = 90) {
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  return prismaNutri.medida.findMany({
    where: { clienteId, registradoEm: { gte: desde } },
    orderBy: { registradoEm: "asc" },
  });
}
