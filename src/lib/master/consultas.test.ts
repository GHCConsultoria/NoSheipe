import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Métricas do painel administrativo.
 *
 * Dois motivos pra existir. O primeiro é a regra de privacidade: o Master
 * é operacional, não clínico, então nenhuma consulta daqui pode devolver
 * refeição, peso ou anotação — e o cenário abaixo semeia esses dados de
 * propósito, pra o teste ter o que não encontrar.
 *
 * O segundo é `_count` com `where` (contagem de relação filtrada), que
 * depende de suporte do Prisma no runtime, não só de tipo. Um teste de
 * verdade contra SQLite é o que prova que funciona.
 */

/** init.sql resolvido a partir deste arquivo — não depende do cwd de quem roda o vitest. */
const CAMINHO_INIT_SQL = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../prisma/nutri/init.sql");

const diretorio = mkdtempSync(path.join(tmpdir(), "nosheipe-master-"));
const arquivoBanco = path.join(diretorio, "teste.db");
process.env.TURSO_DATABASE_URL = `file:${arquivoBanco}`;
delete process.env.TURSO_AUTH_TOKEN;

type ModuloConsultas = typeof import("./consultas");
type ModuloPrisma = typeof import("@/lib/nutri/prisma");

let buscarMetricasGerais: ModuloConsultas["buscarMetricasGerais"];
let buscarProfissionais: ModuloConsultas["buscarProfissionais"];
let prismaNutri: ModuloPrisma["prismaNutri"];

beforeAll(async () => {
  const { createClient } = await import("@libsql/client");
  const { separarStatements } = await import("../../../prisma/nutri/separar-statements.mjs");
  const bruto = createClient({ url: `file:${arquivoBanco}` });
  for (const stmt of separarStatements(readFileSync(CAMINHO_INIT_SQL, "utf8"))) {
    await bruto.execute(stmt);
  }
  bruto.close();

  ({ buscarMetricasGerais, buscarProfissionais } = await import("./consultas"));
  ({ prismaNutri } = await import("@/lib/nutri/prisma"));

  const ana = await prismaNutri.profissional.create({
    data: { authUserId: "a1", nome: "Ana", email: "ana@x.test", ehNutricionista: true, limitePlano: 20 },
  });
  const bruno = await prismaNutri.profissional.create({
    data: { authUserId: "a2", nome: "Bruno", email: "bruno@x.test", ehPersonal: true },
  });
  // Híbrido e master, pra a listagem exercitar os três rótulos.
  await prismaNutri.profissional.create({
    data: {
      authUserId: "a3",
      nome: "Carla",
      email: "carla@x.test",
      ehNutricionista: true,
      ehPersonal: true,
      ehMaster: true,
    },
  });

  // Marina é compartilhada: Ana na nutrição, Bruno no treino.
  const marina = await prismaNutri.cliente.create({
    data: { nome: "Marina", tokenAcesso: "t1", codigoConvite: "MAR234" },
  });
  // Rafael tem só a Ana.
  const rafael = await prismaNutri.cliente.create({
    data: { nome: "Rafael", tokenAcesso: "t2", codigoConvite: "RAF234" },
  });
  // Lucas está arquivado — não entra na contagem de ativos.
  await prismaNutri.cliente.create({
    data: { nome: "Lucas", tokenAcesso: "t3", codigoConvite: "LUC234", status: "ARQUIVADO" },
  });

  await prismaNutri.vinculo.createMany({
    data: [
      { clienteId: marina.id, profissionalId: ana.id, tipo: "NUTRICAO", status: "ATIVO" },
      { clienteId: marina.id, profissionalId: bruno.id, tipo: "TREINO", status: "ATIVO" },
      { clienteId: rafael.id, profissionalId: ana.id, tipo: "NUTRICAO", status: "ATIVO" },
      { clienteId: rafael.id, profissionalId: bruno.id, tipo: "TREINO", status: "PENDENTE" },
    ],
  });

  // Dado de saúde, que o Master não pode expor.
  await prismaNutri.refeicao.create({
    data: {
      clienteId: marina.id,
      clienteRegistroId: "r1",
      origem: "TEXTO",
      entradaBruta: "SEGREDO CLINICO",
      itens: "[]",
      kcal: 500,
      proteina: 30,
      carbo: 50,
      gordura: 15,
      confianca: 0.8,
    },
  });
  await prismaNutri.sessaoTreino.create({
    data: { clienteId: marina.id, clienteRegistroId: "s1", origem: "TEXTO", entradaBruta: "SEGREDO CLINICO" },
  });
  await prismaNutri.medida.create({ data: { clienteId: marina.id, pesoKg: 71.9 } });
  await prismaNutri.anotacao.create({
    data: { clienteId: marina.id, profissionalId: ana.id, texto: "SEGREDO CLINICO" },
  });
}, 60_000);

afterAll(async () => {
  await prismaNutri?.$disconnect();
  rmSync(diretorio, { recursive: true, force: true });
});

describe("métricas gerais", () => {
  it("conta profissionais por atuação, contando o híbrido dos dois lados", async () => {
    const m = await buscarMetricasGerais();
    expect(m.profissionais).toBe(3);
    expect(m.profissionaisNutricionistas).toBe(2); // Ana e Carla
    expect(m.profissionaisPersonais).toBe(2); // Bruno e Carla
  });

  it("separa cliente ativo de arquivado", async () => {
    const m = await buscarMetricasGerais();
    expect(m.clientesAtivos).toBe(2);
    expect(m.clientesArquivados).toBe(1);
  });

  it("conta vínculos por status e tipo", async () => {
    const m = await buscarMetricasGerais();
    expect(m.vinculosAtivos).toBe(3);
    expect(m.vinculosPendentes).toBe(1);
    expect(m.vinculosNutricao).toBe(2);
    expect(m.vinculosTreino).toBe(1);
  });

  it("conta como compartilhado só quem tem mais de um profissional ativo", async () => {
    const m = await buscarMetricasGerais();
    // Marina sim; Rafael não — o segundo vínculo dele ainda é PENDENTE.
    expect(m.clientesCompartilhados).toBe(1);
  });

  it("agrega registros dos dois tipos na janela de tempo", async () => {
    const m = await buscarMetricasGerais();
    expect(m.registros7dias).toBe(2); // uma refeição + uma sessão
    expect(m.registros30dias).toBe(2);
  });
});

describe("listagem de profissionais", () => {
  it("conta só os vínculos ativos de cada um", async () => {
    const linhas = await buscarProfissionais();
    const porNome = new Map(linhas.map((l) => [l.nome, l]));

    expect(porNome.get("Ana")?.clientesAtivos).toBe(2);
    expect(porNome.get("Ana")?.pendentes).toBe(0);
    // Bruno tem 1 ativo e 1 pendente — o pendente não ocupa vaga.
    expect(porNome.get("Bruno")?.clientesAtivos).toBe(1);
    expect(porNome.get("Bruno")?.pendentes).toBe(1);
    expect(porNome.get("Carla")?.clientesAtivos).toBe(0);
  });

  it("traz as capacidades e o limite do plano", async () => {
    const linhas = await buscarProfissionais();
    const carla = linhas.find((l) => l.nome === "Carla");
    expect(carla).toMatchObject({ ehNutricionista: true, ehPersonal: true, ehMaster: true });
    expect(linhas.find((l) => l.nome === "Ana")?.limitePlano).toBe(20);
  });

  it("não devolve nome de cliente nem dado de saúde", async () => {
    const bruto = JSON.stringify([await buscarMetricasGerais(), await buscarProfissionais()]);
    for (const proibido of ["SEGREDO CLINICO", "Marina", "Rafael", "Lucas", "71.9"]) {
      expect(bruto).not.toContain(proibido);
    }
  });
});
