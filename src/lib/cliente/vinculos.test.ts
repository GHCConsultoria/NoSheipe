import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * As ações que o cliente dispara pra responder a um pedido de
 * acompanhamento: aceitar, recusar e encerrar.
 *
 * Elas são o caminho de ESCRITA da Fase 3, e o único jeito de exercitá-lo
 * fora de um navegador — o preview da Vercel só é alcançável por GET
 * daqui. Por isso o teste chama as funções de verdade, contra um SQLite
 * de verdade, em vez de conferir só a consulta.
 *
 * `next/cache` é mockado porque revalidatePath só existe dentro de uma
 * requisição do Next; é encanamento de framework, não a regra sob teste.
 */
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

/** init.sql resolvido a partir deste arquivo — não depende do cwd de quem roda o vitest. */
const CAMINHO_INIT_SQL = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../prisma/nutri/init.sql");

const diretorio = mkdtempSync(path.join(tmpdir(), "nosheipe-vinculos-"));
const arquivoBanco = path.join(diretorio, "teste.db");
process.env.TURSO_DATABASE_URL = `file:${arquivoBanco}`;
delete process.env.TURSO_AUTH_TOKEN;

type ModuloPublico = typeof import("./publico");
type ModuloPrisma = typeof import("@/lib/nutri/prisma");
type ModuloConsultas = typeof import("@/lib/profissional/consultas");

let aceitarVinculo: ModuloPublico["aceitarVinculo"];
let recusarVinculo: ModuloPublico["recusarVinculo"];
let encerrarVinculo: ModuloPublico["encerrarVinculo"];
let buscarSolicitacoesEnviadas: ModuloConsultas["buscarSolicitacoesEnviadas"];
let prismaNutri: ModuloPrisma["prismaNutri"];

const TOKEN = "tok-cliente";
const TOKEN_OUTRO = "tok-outro";
let clienteId = "";
let outroClienteId = "";
let profissionalId = "";

beforeAll(async () => {
  const { createClient } = await import("@libsql/client");
  const { separarStatements } = await import("../../../prisma/nutri/separar-statements.mjs");
  const bruto = createClient({ url: `file:${arquivoBanco}` });
  for (const stmt of separarStatements(readFileSync(CAMINHO_INIT_SQL, "utf8"))) {
    await bruto.execute(stmt);
  }
  bruto.close();

  ({ aceitarVinculo, recusarVinculo, encerrarVinculo } = await import("./publico"));
  ({ buscarSolicitacoesEnviadas } = await import("@/lib/profissional/consultas"));
  ({ prismaNutri } = await import("@/lib/nutri/prisma"));

  const profissional = await prismaNutri.profissional.create({
    data: {
      authUserId: "auth-bruno",
      nome: "Bruno",
      email: "bruno@exemplo.test",
      ehPersonal: true,
      limitePlano: 2,
    },
  });
  profissionalId = profissional.id;

  const cliente = await prismaNutri.cliente.create({
    data: { nome: "Marina", tokenAcesso: TOKEN, codigoConvite: "MAR234", consentimentoEm: new Date() },
  });
  clienteId = cliente.id;

  const outro = await prismaNutri.cliente.create({
    data: { nome: "Rafael", tokenAcesso: TOKEN_OUTRO, codigoConvite: "RAF234", consentimentoEm: new Date() },
  });
  outroClienteId = outro.id;
}, 60_000);

afterAll(async () => {
  await prismaNutri?.$disconnect();
  rmSync(diretorio, { recursive: true, force: true });
});

/** Cada teste parte de um pedido pendente novo, sem herdar estado. */
beforeEach(async () => {
  await prismaNutri.vinculo.deleteMany({});
  await prismaNutri.vinculo.create({
    data: { clienteId, profissionalId, tipo: "TREINO", status: "PENDENTE" },
  });
});

async function pedidoAtual() {
  return prismaNutri.vinculo.findFirstOrThrow({ where: { clienteId, tipo: "TREINO" } });
}

describe("o cliente responde a um pedido de acompanhamento", () => {
  it("aceitar ativa o vínculo e carimba a data", async () => {
    const antes = await pedidoAtual();
    const resultado = await aceitarVinculo({ token: TOKEN, vinculoId: antes.id });

    expect(resultado.sucesso).toBe(true);
    const depois = await pedidoAtual();
    expect(depois.status).toBe("ATIVO");
    expect(depois.aceitoEm).not.toBeNull();
  });

  it("recusar encerra sem apagar a linha", async () => {
    const antes = await pedidoAtual();
    expect((await recusarVinculo({ token: TOKEN, vinculoId: antes.id })).sucesso).toBe(true);

    const depois = await pedidoAtual();
    expect(depois.status).toBe("ENCERRADO");
    expect(depois.aceitoEm).toBeNull();
  });

  it("encerrar um acompanhamento ativo tira o acesso e mantém o cliente ATIVO", async () => {
    const pedido = await pedidoAtual();
    await aceitarVinculo({ token: TOKEN, vinculoId: pedido.id });

    expect((await encerrarVinculo({ token: TOKEN, vinculoId: pedido.id })).sucesso).toBe(true);
    expect((await pedidoAtual()).status).toBe("ENCERRADO");

    // O cliente não pode ser arquivado por encerrar o próprio vínculo:
    // isso o trancaria pra fora da própria página.
    const cliente = await prismaNutri.cliente.findUniqueOrThrow({ where: { id: clienteId } });
    expect(cliente.status).toBe("ATIVO");
  });

  it("o token de outro cliente não responde pelo pedido alheio", async () => {
    const pedido = await pedidoAtual();
    const resultado = await aceitarVinculo({ token: TOKEN_OUTRO, vinculoId: pedido.id });

    expect(resultado).toEqual({ sucesso: false, erro: "solicitação não encontrada" });
    expect((await pedidoAtual()).status).toBe("PENDENTE");
  });

  it("token inválido não move nada", async () => {
    const pedido = await pedidoAtual();
    expect((await aceitarVinculo({ token: "nao-existe", vinculoId: pedido.id })).sucesso).toBe(false);
    expect((await pedidoAtual()).status).toBe("PENDENTE");
  });

  it("aceitar duas vezes não passa da primeira", async () => {
    const pedido = await pedidoAtual();
    expect((await aceitarVinculo({ token: TOKEN, vinculoId: pedido.id })).sucesso).toBe(true);
    // O segundo aceite não acha mais nada PENDENTE — nada a fazer.
    expect((await aceitarVinculo({ token: TOKEN, vinculoId: pedido.id })).sucesso).toBe(false);
    expect((await pedidoAtual()).status).toBe("ATIVO");
  });

  it("não ativa o vínculo se o plano do profissional encheu no meio do caminho", async () => {
    // limitePlano é 2; ocupa as duas vagas com outros vínculos ativos.
    await prismaNutri.vinculo.create({
      data: { clienteId: outroClienteId, profissionalId, tipo: "TREINO", status: "ATIVO" },
    });
    await prismaNutri.vinculo.create({
      data: { clienteId: outroClienteId, profissionalId, tipo: "NUTRICAO", status: "ATIVO" },
    });

    const pedido = await pedidoAtual();
    const resultado = await aceitarVinculo({ token: TOKEN, vinculoId: pedido.id });

    expect(resultado.sucesso).toBe(false);
    expect((await pedidoAtual()).status).toBe("PENDENTE");
  });
});

describe("solicitações que o profissional enviou", () => {
  it("aparecem enquanto pendentes, e só pra quem pediu", async () => {
    const enviadas = await buscarSolicitacoesEnviadas(profissionalId);
    expect(enviadas.map((s) => s.clienteNome)).toEqual(["Marina"]);

    const outroProfissional = await prismaNutri.profissional.upsert({
      where: { authUserId: "auth-ana" },
      update: {},
      create: { authUserId: "auth-ana", nome: "Ana", email: "ana@exemplo.test", ehNutricionista: true },
    });
    expect(await buscarSolicitacoesEnviadas(outroProfissional.id)).toEqual([]);
  });

  it("somem da lista assim que o cliente responde", async () => {
    const pedido = await pedidoAtual();
    await aceitarVinculo({ token: TOKEN, vinculoId: pedido.id });
    expect(await buscarSolicitacoesEnviadas(profissionalId)).toEqual([]);
  });
});
