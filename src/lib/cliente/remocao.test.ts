import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Remoção lógica de refeição, e a garantia de que ela some de toda leitura.
 *
 * O teste chama as funções de verdade contra um SQLite de verdade — é o
 * único jeito de exercitar a extensão do client (prisma.ts), que é o que
 * de fato esconde o registro removido do saldo do dia, do anel e do resto.
 * Um Prisma mockado testaria o mock, não a extensão.
 */
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const CAMINHO_INIT_SQL = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../prisma/nutri/init.sql");

const diretorio = mkdtempSync(path.join(tmpdir(), "nosheipe-remocao-"));
const arquivoBanco = path.join(diretorio, "teste.db");
process.env.TURSO_DATABASE_URL = `file:${arquivoBanco}`;
delete process.env.TURSO_AUTH_TOKEN;

type ModuloPublico = typeof import("./publico");
type ModuloConsultas = typeof import("./consultas");
type ModuloPrisma = typeof import("@/lib/nutri/prisma");

let removerRefeicao: ModuloPublico["removerRefeicao"];
let buscarPainelDoCliente: ModuloConsultas["buscarPainelDoCliente"];
let prismaNutri: ModuloPrisma["prismaNutri"];

const TOKEN = "tok-cliente";
const TOKEN_OUTRO = "tok-outro";
let clienteId = "";

/** Meio-dia em SP (15:00 UTC) — longe das bordas do dia local. */
function hojeAoMeioDia(): Date {
  const chave = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  return new Date(`${chave}T15:00:00.000Z`);
}

beforeAll(async () => {
  const { createClient } = await import("@libsql/client");
  const { separarStatements } = await import("../../../prisma/nutri/separar-statements.mjs");
  const bruto = createClient({ url: `file:${arquivoBanco}` });
  for (const stmt of separarStatements(readFileSync(CAMINHO_INIT_SQL, "utf8"))) {
    await bruto.execute(stmt);
  }
  bruto.close();

  ({ removerRefeicao } = await import("./publico"));
  ({ buscarPainelDoCliente } = await import("./consultas"));
  ({ prismaNutri } = await import("@/lib/nutri/prisma"));

  const profissional = await prismaNutri.profissional.create({
    data: { authUserId: "auth-p", nome: "Ana", email: "ana@x.test", ehNutricionista: true },
  });
  const cliente = await prismaNutri.cliente.create({
    data: { nome: "Marina", tokenAcesso: TOKEN, codigoConvite: "MAR234", consentimentoEm: new Date() },
  });
  clienteId = cliente.id;
  await prismaNutri.cliente.create({
    data: { nome: "Rafael", tokenAcesso: TOKEN_OUTRO, codigoConvite: "RAF234", consentimentoEm: new Date() },
  });
  await prismaNutri.vinculo.create({
    data: { clienteId: cliente.id, profissionalId: profissional.id, tipo: "NUTRICAO", status: "ATIVO" },
  });
  await prismaNutri.planoNutricional.create({
    data: { clienteId: cliente.id, metaKcal: 2000, metaProteina: 150, metaCarbo: 200, metaGordura: 60 },
  });
}, 60_000);

afterAll(async () => {
  await prismaNutri?.$disconnect();
  rmSync(diretorio, { recursive: true, force: true });
});

let sequencia = 0;
async function registrarRefeicao(kcal: number): Promise<string> {
  sequencia += 1;
  const r = await prismaNutri.refeicao.create({
    data: {
      clienteId,
      clienteRegistroId: `reg-${sequencia}`,
      origem: "TEXTO",
      entradaBruta: `refeição ${sequencia}`,
      itens: "[]",
      kcal,
      proteina: 10,
      carbo: 10,
      gordura: 5,
      confianca: 0.9,
      registradoEm: hojeAoMeioDia(),
    },
  });
  return r.id;
}

async function saldoKcal(): Promise<number> {
  const cliente = await prismaNutri.cliente.findUniqueOrThrow({ where: { id: clienteId } });
  const painel = await buscarPainelDoCliente(cliente);
  return painel.nutricao?.saldo.kcal.consumido ?? -1;
}

beforeEach(async () => {
  // updateMany não é leitura, então não é filtrado — devolve as removidas
  // ao estado ativo pra cada teste partir limpo, sem apagar linha nenhuma.
  await prismaNutri.refeicao.updateMany({ where: {}, data: { removidoEm: null } });
  await prismaNutri.refeicao.deleteMany({ where: {} });
});

describe("remover refeição", () => {
  it("tira a refeição do saldo do dia", async () => {
    await registrarRefeicao(500);
    const alvo = await registrarRefeicao(300);
    expect(await saldoKcal()).toBe(800);

    const resultado = await removerRefeicao({ token: TOKEN, registroId: alvo });
    expect(resultado.sucesso).toBe(true);
    expect(await saldoKcal()).toBe(500);
  });

  it("não apaga a linha — só marca removidoEm", async () => {
    const alvo = await registrarRefeicao(400);
    await removerRefeicao({ token: TOKEN, registroId: alvo });

    // findUnique não é filtrado pela extensão: a linha crua continua lá.
    const crua = await prismaNutri.refeicao.findUnique({ where: { id: alvo } });
    expect(crua).not.toBeNull();
    expect(crua?.removidoEm).not.toBeNull();

    // Mas a leitura normal não a enxerga mais.
    const visivel = await prismaNutri.refeicao.findFirst({ where: { id: alvo } });
    expect(visivel).toBeNull();
  });

  it("o token de outro cliente não remove refeição alheia", async () => {
    const alvo = await registrarRefeicao(600);
    const resultado = await removerRefeicao({ token: TOKEN_OUTRO, registroId: alvo });

    expect(resultado).toEqual({ sucesso: false, erro: "registro não encontrado" });
    expect(await saldoKcal()).toBe(600);
  });

  it("remover de novo devolve não encontrado, sem mexer duas vezes", async () => {
    const alvo = await registrarRefeicao(200);
    expect((await removerRefeicao({ token: TOKEN, registroId: alvo })).sucesso).toBe(true);
    expect((await removerRefeicao({ token: TOKEN, registroId: alvo })).sucesso).toBe(false);
  });

  it("token inválido não remove nada", async () => {
    const alvo = await registrarRefeicao(700);
    expect((await removerRefeicao({ token: "nao-existe", registroId: alvo })).sucesso).toBe(false);
    expect(await saldoKcal()).toBe(700);
  });
});
