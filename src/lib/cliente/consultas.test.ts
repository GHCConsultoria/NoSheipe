import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Teste de integração de `buscarPainelDoCliente` contra um SQLite de
 * verdade em arquivo temporário — o mesmo motor do Turso em produção.
 *
 * A regra sob teste é a que faz a home do cliente se ajustar sozinha: cada
 * bloco (dieta / treino) só existe se houver vínculo ATIVO daquele tipo.
 * É lógica de leitura acoplada ao banco, então mock de Prisma testaria o
 * mock, não a regra.
 *
 * TURSO_DATABASE_URL precisa estar definida antes de importar
 * src/lib/nutri/prisma.ts — o client libSQL lê a URL no import do módulo.
 * Daí os `await import()` dentro do beforeAll, em vez de imports no topo.
 */

/** init.sql resolvido a partir deste arquivo — não depende do cwd de quem roda o vitest. */
const CAMINHO_INIT_SQL = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../prisma/nutri/init.sql");

const diretorio = mkdtempSync(path.join(tmpdir(), "nosheipe-teste-"));
const arquivoBanco = path.join(diretorio, "teste.db");
process.env.TURSO_DATABASE_URL = `file:${arquivoBanco}`;
delete process.env.TURSO_AUTH_TOKEN;

type ModuloConsultas = typeof import("./consultas");
type ModuloPrisma = typeof import("@/lib/nutri/prisma");

let buscarPainelDoCliente: ModuloConsultas["buscarPainelDoCliente"];
let prismaNutri: ModuloPrisma["prismaNutri"];

/** Ids dos clientes de cada cenário, preenchidos no beforeAll. */
const clientes: Record<"ambos" | "soNutricao" | "soTreino" | "semVinculo" | "encerrado", string> = {
  ambos: "",
  soNutricao: "",
  soTreino: "",
  semVinculo: "",
  encerrado: "",
};

/** Meio-dia em São Paulo (15:00 UTC) — longe das bordas do dia local. */
function hojeAoMeioDia(): Date {
  const agora = new Date();
  const chave = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
  return new Date(`${chave}T15:00:00.000Z`);
}

beforeAll(async () => {
  const { createClient } = await import("@libsql/client");
  const bruto = createClient({ url: `file:${arquivoBanco}` });

  const { separarStatements } = await import("../../../prisma/nutri/separar-statements.mjs");
  const statements = separarStatements(readFileSync(CAMINHO_INIT_SQL, "utf8"));

  for (const stmt of statements) {
    await bruto.execute(stmt);
  }
  bruto.close();

  ({ buscarPainelDoCliente } = await import("./consultas"));
  ({ prismaNutri } = await import("@/lib/nutri/prisma"));

  const profissional = await prismaNutri.profissional.create({
    data: {
      authUserId: "auth-teste",
      nome: "Profissional de Teste",
      email: "teste@exemplo.test",
      ehNutricionista: true,
      ehPersonal: true,
    },
  });

  const meioDia = hojeAoMeioDia();
  let sequencia = 0;

  async function semear(
    chave: keyof typeof clientes,
    vinculos: { tipo: "NUTRICAO" | "TREINO"; status: string }[],
  ) {
    sequencia += 1;
    const cliente = await prismaNutri.cliente.create({
      data: {
        nome: `Cliente ${chave}`,
        tokenAcesso: `token-${chave}`,
        codigoConvite: `CONV${sequencia}`,
        consentimentoEm: meioDia,
      },
    });
    clientes[chave] = cliente.id;

    for (const vinculo of vinculos) {
      await prismaNutri.vinculo.create({
        data: {
          clienteId: cliente.id,
          profissionalId: profissional.id,
          tipo: vinculo.tipo,
          status: vinculo.status,
          aceitoEm: vinculo.status === "ATIVO" ? meioDia : null,
        },
      });
    }

    // Todo cliente recebe plano, treino e registros — independentemente do
    // vínculo. Assim o teste prova que é o vínculo que esconde o bloco, e
    // não a ausência de dado.
    await prismaNutri.planoNutricional.create({
      data: { clienteId: cliente.id, metaKcal: 2000, metaProteina: 150, metaCarbo: 200, metaGordura: 60 },
    });
    await prismaNutri.treinoPrescrito.create({
      data: { clienteId: cliente.id, nome: "Full body", descricao: "agachamento, supino", diasPorSemana: 4 },
    });
    await prismaNutri.refeicao.create({
      data: {
        clienteId: cliente.id,
        clienteRegistroId: `ref-${chave}`,
        origem: "TEXTO",
        entradaBruta: "arroz, feijão e frango",
        itens: "[]",
        kcal: 1000,
        proteina: 75,
        carbo: 100,
        gordura: 30,
        confianca: 0.8,
        registradoEm: meioDia,
      },
    });
    await prismaNutri.sessaoTreino.create({
      data: {
        clienteId: cliente.id,
        clienteRegistroId: `ses-${chave}`,
        origem: "TEXTO",
        entradaBruta: "treino de peito",
        realizadoEm: meioDia,
      },
    });
  }

  await semear("ambos", [
    { tipo: "NUTRICAO", status: "ATIVO" },
    { tipo: "TREINO", status: "ATIVO" },
  ]);
  await semear("soNutricao", [{ tipo: "NUTRICAO", status: "ATIVO" }]);
  await semear("soTreino", [{ tipo: "TREINO", status: "ATIVO" }]);
  await semear("semVinculo", []);
  await semear("encerrado", [
    { tipo: "NUTRICAO", status: "ENCERRADO" },
    { tipo: "TREINO", status: "PENDENTE" },
  ]);
}, 60_000);

afterAll(async () => {
  await prismaNutri?.$disconnect();
  rmSync(diretorio, { recursive: true, force: true });
});

async function painel(chave: keyof typeof clientes) {
  const cliente = await prismaNutri.cliente.findUniqueOrThrow({ where: { id: clientes[chave] } });
  return buscarPainelDoCliente(cliente);
}

describe("buscarPainelDoCliente", () => {
  it("com nutrição e treino, devolve os dois blocos", async () => {
    const resultado = await painel("ambos");
    expect(resultado.nutricao).not.toBeNull();
    expect(resultado.treino).not.toBeNull();
  });

  it("com só nutrição, não devolve o bloco de treino", async () => {
    const resultado = await painel("soNutricao");
    expect(resultado.nutricao).not.toBeNull();
    expect(resultado.treino).toBeNull();
  });

  it("com só treino, não devolve o bloco de nutrição", async () => {
    const resultado = await painel("soTreino");
    expect(resultado.treino).not.toBeNull();
    expect(resultado.nutricao).toBeNull();
  });

  it("sem nenhum vínculo, não devolve bloco algum", async () => {
    const resultado = await painel("semVinculo");
    expect(resultado.nutricao).toBeNull();
    expect(resultado.treino).toBeNull();
  });

  it("vínculo ENCERRADO ou PENDENTE não abre bloco", async () => {
    const resultado = await painel("encerrado");
    expect(resultado.nutricao).toBeNull();
    expect(resultado.treino).toBeNull();
  });

  it("calcula o percentual do dia sobre as metas do plano ativo", async () => {
    const resultado = await painel("ambos");
    // 1000 kcal de 2000 = 50%.
    expect(resultado.nutricao?.saldo.kcal).toEqual({ consumido: 1000, meta: 2000, percentual: 50 });
    expect(resultado.nutricao?.saldo.proteina.percentual).toBe(50);
    expect(resultado.nutricao?.registrosHoje).toHaveLength(1);
  });

  it("conta a sessão de hoje na aderência da semana", async () => {
    const resultado = await painel("ambos");
    expect(resultado.treino?.treino?.diasPorSemana).toBe(4);
    expect(resultado.treino?.sessoesHoje).toHaveLength(1);
    expect(resultado.treino?.aderenciaSemana?.diasTreinados).toBe(1);
  });
});
