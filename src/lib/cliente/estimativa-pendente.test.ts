import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Refeição registrada "a estimar" (a IA estava fora quando o cliente
 * registrou) e a estimativa posterior. Roda contra um SQLite de verdade,
 * como o teste de remoção — é o único jeito de exercitar o saldo do dia e a
 * extensão do client de ponta a ponta.
 *
 * A IA é controlada por IA_STUB_JSON: definida, gerarTexto devolve o texto
 * fixo (estimativa entra); apagada e sem chave de provedor, extrairMacros
 * lança e a estimativa continua pendente — os dois caminhos que importam.
 */
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const CAMINHO_INIT_SQL = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../prisma/nutri/init.sql");

const diretorio = mkdtempSync(path.join(tmpdir(), "nosheipe-estimativa-"));
const arquivoBanco = path.join(diretorio, "teste.db");
process.env.TURSO_DATABASE_URL = `file:${arquivoBanco}`;
delete process.env.TURSO_AUTH_TOKEN;
// Nenhum provedor de IA: assim, sem IA_STUB_JSON, extrairMacros lança
// IaNaoConfiguradaError — o cenário "IA fora do ar".
delete process.env.IA_STUB_JSON;
delete process.env.GEMINI_API_KEY;
delete process.env.GROQ_API_KEY;
delete process.env.ANTHROPIC_API_KEY;

const STUB_MACROS = JSON.stringify({
  items: [{ name: "ovos", grams: 100, kcal: 300, protein: 20, carbs: 2, fat: 22 }],
  totals: { kcal: 300, protein: 20, carbs: 2, fat: 22 },
  confidence: 0.8,
});

type ModuloPublico = typeof import("./publico");
type ModuloConsultas = typeof import("./consultas");
type ModuloPrisma = typeof import("@/lib/nutri/prisma");

let estimarRefeicao: ModuloPublico["estimarRefeicao"];
let buscarPainelDoCliente: ModuloConsultas["buscarPainelDoCliente"];
let prismaNutri: ModuloPrisma["prismaNutri"];

const TOKEN = "tok-cliente";
const TOKEN_OUTRO = "tok-outro";
let clienteId = "";

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

  ({ estimarRefeicao } = await import("./publico"));
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
async function registrarPendente(): Promise<string> {
  sequencia += 1;
  const r = await prismaNutri.refeicao.create({
    data: {
      clienteId,
      clienteRegistroId: `reg-${sequencia}`,
      origem: "TEXTO",
      entradaBruta: "2 ovos mexidos",
      itens: "[]",
      kcal: 0,
      proteina: 0,
      carbo: 0,
      gordura: 0,
      confianca: 0,
      macrosPendentes: true,
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
  delete process.env.IA_STUB_JSON;
  await prismaNutri.refeicao.deleteMany({ where: {} });
});

describe("refeição a estimar", () => {
  it("registrada pendente não conta no saldo do dia", async () => {
    await registrarPendente();
    expect(await saldoKcal()).toBe(0);
  });

  it("estimar com a IA de volta preenche os macros e tira a pendência", async () => {
    const alvo = await registrarPendente();
    expect(await saldoKcal()).toBe(0);

    process.env.IA_STUB_JSON = STUB_MACROS;
    const resultado = await estimarRefeicao({ token: TOKEN, registroId: alvo });
    expect(resultado.sucesso).toBe(true);

    const atualizada = await prismaNutri.refeicao.findUniqueOrThrow({ where: { id: alvo } });
    expect(atualizada.macrosPendentes).toBe(false);
    expect(atualizada.kcal).toBe(300);
    expect(await saldoKcal()).toBe(300);
  });

  it("estimar com a IA ainda fora mantém a pendência e devolve erro", async () => {
    const alvo = await registrarPendente();
    const resultado = await estimarRefeicao({ token: TOKEN, registroId: alvo });

    expect(resultado.sucesso).toBe(false);
    const crua = await prismaNutri.refeicao.findUniqueOrThrow({ where: { id: alvo } });
    expect(crua.macrosPendentes).toBe(true);
    expect(crua.kcal).toBe(0);
  });

  it("o token de outro cliente não estima refeição alheia", async () => {
    const alvo = await registrarPendente();
    process.env.IA_STUB_JSON = STUB_MACROS;
    const resultado = await estimarRefeicao({ token: TOKEN_OUTRO, registroId: alvo });
    expect(resultado).toEqual({ sucesso: false, erro: "registro não encontrado" });
  });

  it("estimar uma refeição já estimada é no-op de sucesso", async () => {
    const alvo = await registrarPendente();
    process.env.IA_STUB_JSON = STUB_MACROS;
    expect((await estimarRefeicao({ token: TOKEN, registroId: alvo })).sucesso).toBe(true);
    // Segunda chamada: já não está pendente, devolve sucesso sem tocar a IA.
    delete process.env.IA_STUB_JSON;
    expect((await estimarRefeicao({ token: TOKEN, registroId: alvo })).sucesso).toBe(true);
  });
});
