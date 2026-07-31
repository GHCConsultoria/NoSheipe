import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Exportar e apagar os próprios dados (LGPD), contra um SQLite de verdade.
 * A exclusão é por anonimização: interessa provar que o que identifica a
 * pessoa some, que o texto livre é apagado, que o vínculo encerra e que o
 * link morre — tudo numa transação só.
 */
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const CAMINHO_INIT_SQL = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../prisma/nutri/init.sql");

const diretorio = mkdtempSync(path.join(tmpdir(), "nosheipe-lgpd-"));
const arquivoBanco = path.join(diretorio, "teste.db");
process.env.TURSO_DATABASE_URL = `file:${arquivoBanco}`;
delete process.env.TURSO_AUTH_TOKEN;

type ModuloPublico = typeof import("./publico");
type ModuloExport = typeof import("./exportacao");
type ModuloPrisma = typeof import("@/lib/nutri/prisma");

let apagarMeusDados: ModuloPublico["apagarMeusDados"];
let removerRefeicao: ModuloPublico["removerRefeicao"];
let montarExportacao: ModuloExport["montarExportacao"];
let prismaNutri: ModuloPrisma["prismaNutri"];

const TOKEN = "tok-lgpd";
let clienteId = "";

beforeAll(async () => {
  const { createClient } = await import("@libsql/client");
  const { separarStatements } = await import("../../../prisma/nutri/separar-statements.mjs");
  const bruto = createClient({ url: `file:${arquivoBanco}` });
  for (const stmt of separarStatements(readFileSync(CAMINHO_INIT_SQL, "utf8"))) {
    await bruto.execute(stmt);
  }
  bruto.close();

  ({ apagarMeusDados, removerRefeicao } = await import("./publico"));
  ({ montarExportacao } = await import("./exportacao"));
  ({ prismaNutri } = await import("@/lib/nutri/prisma"));

  const profissional = await prismaNutri.profissional.create({
    data: { authUserId: "auth-p", nome: "Ana", email: "ana@x.test", ehNutricionista: true },
  });
  const cliente = await prismaNutri.cliente.create({
    data: {
      nome: "Marina Souza",
      telefone: "11999999999",
      objetivo: "emagrecer",
      tokenAcesso: TOKEN,
      codigoConvite: "MAR234",
      consentimentoEm: new Date(),
    },
  });
  clienteId = cliente.id;
  await prismaNutri.vinculo.create({
    data: { clienteId: cliente.id, profissionalId: profissional.id, tipo: "NUTRICAO", status: "ATIVO" },
  });
  await prismaNutri.refeicao.create({
    data: {
      clienteId: cliente.id,
      clienteRegistroId: "reg-1",
      origem: "TEXTO",
      entradaBruta: "3 ovos e pão",
      itens: "[]",
      kcal: 300,
      proteina: 20,
      carbo: 30,
      gordura: 10,
      confianca: 0.9,
    },
  });
}, 60_000);

afterAll(async () => {
  await prismaNutri?.$disconnect();
  rmSync(diretorio, { recursive: true, force: true });
});

describe("exportar dados (LGPD)", () => {
  it("reúne o perfil e os registros do cliente", async () => {
    const dados = await montarExportacao(clienteId);
    expect(dados.perfil.nome).toBe("Marina Souza");
    expect(dados.perfil.telefone).toBe("11999999999");
    expect(dados.refeicoes).toHaveLength(1);
    expect(dados.refeicoes[0]?.descricao).toBe("3 ovos e pão");
    expect(dados.acompanhamentos[0]?.profissional).toBe("Ana");
  });
});

describe("apagar dados (LGPD)", () => {
  // Roda depois do teste de exportação (ordem do arquivo), então a exportação
  // acima ainda vê os dados originais.
  it("anonimiza, apaga o texto livre, encerra o vínculo e mata o link", async () => {
    const resultado = await apagarMeusDados({ token: TOKEN });
    expect(resultado.sucesso).toBe(true);

    // findUnique não é filtrado pela extensão: a linha crua mostra a anonimização.
    const cru = await prismaNutri.cliente.findUniqueOrThrow({ where: { id: clienteId } });
    expect(cru.nome).toBe("Cliente removido");
    expect(cru.telefone).toBeNull();
    expect(cru.objetivo).toBeNull();
    expect(cru.status).toBe("ARQUIVADO");

    const refeicao = await prismaNutri.refeicao.findFirstOrThrow({ where: { clienteId } });
    expect(refeicao.entradaBruta).toBe("[removido]");

    const vinculo = await prismaNutri.vinculo.findFirstOrThrow({ where: { clienteId } });
    expect(vinculo.status).toBe("ENCERRADO");

    // O link morreu: uma ação que resolve pelo token não acha mais o cliente.
    const depois = await removerRefeicao({ token: TOKEN, registroId: refeicao.id });
    expect(depois).toEqual({ sucesso: false, erro: "cliente não encontrado" });
  });
});
