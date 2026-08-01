import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * A regra de segurança central da Fase 3: um cliente pode ser atendido por
 * dois profissionais diferentes, e cada um só enxerga o lado dele.
 *
 * O cenário é o do plano: Ana cuida da nutrição da Marina, Bruno cuida do
 * treino da mesma Marina. Bruno nunca pode ler refeição, meta ou anotação
 * da Ana — e vice-versa.
 *
 * Roda contra um SQLite de verdade, pelos mesmos motivos de
 * src/lib/cliente/consultas.test.ts (o isolamento vive nas cláusulas
 * `where`; um Prisma mockado testaria o mock).
 */

/** init.sql resolvido a partir deste arquivo — não depende do cwd de quem roda o vitest. */
const CAMINHO_INIT_SQL = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../prisma/nutri/init.sql");

const diretorio = mkdtempSync(path.join(tmpdir(), "nosheipe-isolamento-"));
const arquivoBanco = path.join(diretorio, "teste.db");
process.env.TURSO_DATABASE_URL = `file:${arquivoBanco}`;
delete process.env.TURSO_AUTH_TOKEN;

type ModuloConsultas = typeof import("./consultas");
type ModuloPrisma = typeof import("@/lib/nutri/prisma");

let buscarFichaDoCliente: ModuloConsultas["buscarFichaDoCliente"];
let buscarClientesDoProfissional: ModuloConsultas["buscarClientesDoProfissional"];
let prismaNutri: ModuloPrisma["prismaNutri"];

const ids = { ana: "", bruno: "", carla: "", marina: "", rafael: "" };

beforeAll(async () => {
  const { createClient } = await import("@libsql/client");
  const bruto = createClient({ url: `file:${arquivoBanco}` });

  const { separarStatements } = await import("../../../prisma/nutri/separar-statements.mjs");
  const statements = separarStatements(readFileSync(CAMINHO_INIT_SQL, "utf8"));
  for (const stmt of statements) {
    await bruto.execute(stmt);
  }
  bruto.close();

  ({ buscarFichaDoCliente, buscarClientesDoProfissional } = await import("./consultas"));
  ({ prismaNutri } = await import("@/lib/nutri/prisma"));

  async function criarProfissional(chave: "ana" | "bruno" | "carla", nutri: boolean, personal: boolean) {
    const criado = await prismaNutri.profissional.create({
      data: {
        authUserId: `auth-${chave}`,
        nome: chave,
        email: `${chave}@exemplo.test`,
        ehNutricionista: nutri,
        ehPersonal: personal,
      },
    });
    ids[chave] = criado.id;
  }

  await criarProfissional("ana", true, false);
  await criarProfissional("bruno", false, true);
  // Carla é nutricionista, mas não atende ninguém — o caso do intruso.
  await criarProfissional("carla", true, false);

  const marina = await prismaNutri.cliente.create({
    data: { nome: "Marina", tokenAcesso: "tok-marina", codigoConvite: "MAR234" },
  });
  ids.marina = marina.id;

  // Rafael só tem a Ana — serve pra provar que Bruno não o alcança.
  const rafael = await prismaNutri.cliente.create({
    data: { nome: "Rafael", tokenAcesso: "tok-rafael", codigoConvite: "RAF234" },
  });
  ids.rafael = rafael.id;

  await prismaNutri.vinculo.createMany({
    data: [
      { clienteId: marina.id, profissionalId: ids.ana, tipo: "NUTRICAO", status: "ATIVO", aceitoEm: new Date() },
      { clienteId: marina.id, profissionalId: ids.bruno, tipo: "TREINO", status: "ATIVO", aceitoEm: new Date() },
      { clienteId: rafael.id, profissionalId: ids.ana, tipo: "NUTRICAO", status: "ATIVO", aceitoEm: new Date() },
    ],
  });

  // Dados dos dois lados na Marina.
  await prismaNutri.planoNutricional.create({
    data: { clienteId: marina.id, metaKcal: 1800, metaProteina: 120, metaCarbo: 180, metaGordura: 60 },
  });
  await prismaNutri.anamneseNutricional.create({
    data: { clienteId: marina.id, jaSeguiuDieta: true, restricoesAlimentares: "intolerante a lactose" },
  });
  await prismaNutri.treinoPrescrito.create({
    data: { clienteId: marina.id, nome: "Full body", descricao: "agachamento, supino", diasPorSemana: 3 },
  });
  await prismaNutri.anamneseTreino.create({
    data: { clienteId: marina.id, experiencia: "INICIANTE", lesoesLimitacoes: "ombro direito" },
  });

  await prismaNutri.anotacao.create({
    data: { clienteId: marina.id, profissionalId: ids.ana, texto: "reclamou de fome à noite" },
  });
  await prismaNutri.anotacao.create({
    data: { clienteId: marina.id, profissionalId: ids.bruno, texto: "evoluiu na carga do agachamento" },
  });

  // Recados dos dois lados — cada um vê só o seu histórico na ficha.
  await prismaNutri.recado.create({
    data: { clienteId: marina.id, profissionalId: ids.ana, texto: "bora caprichar no café da manhã" },
  });
  await prismaNutri.recado.create({
    data: { clienteId: marina.id, profissionalId: ids.bruno, texto: "não esquece o alongamento" },
  });
}, 60_000);

afterAll(async () => {
  await prismaNutri?.$disconnect();
  rmSync(diretorio, { recursive: true, force: true });
});

describe("isolamento entre profissionais do mesmo cliente", () => {
  it("o personal não recebe nada de nutrição", async () => {
    const ficha = await buscarFichaDoCliente(ids.marina, ids.bruno);
    expect(ficha).not.toBeNull();
    expect(ficha?.acompanhaTreino).toBe(true);
    expect(ficha?.acompanhaNutricao).toBe(false);
    expect(ficha?.metas).toBeNull();
    expect(ficha?.anamneseNutricional).toBeNull();
  });

  it("a nutricionista não recebe nada de treino", async () => {
    const ficha = await buscarFichaDoCliente(ids.marina, ids.ana);
    expect(ficha?.acompanhaNutricao).toBe(true);
    expect(ficha?.acompanhaTreino).toBe(false);
    expect(ficha?.treino).toBeNull();
    expect(ficha?.anamneseTreino).toBeNull();
  });

  it("cada um vê só as próprias anotações", async () => {
    const daAna = await buscarFichaDoCliente(ids.marina, ids.ana);
    const doBruno = await buscarFichaDoCliente(ids.marina, ids.bruno);

    expect(daAna?.anotacoes.map((a) => a.texto)).toEqual(["reclamou de fome à noite"]);
    expect(doBruno?.anotacoes.map((a) => a.texto)).toEqual(["evoluiu na carga do agachamento"]);
  });

  it("cada um vê só os próprios recados enviados", async () => {
    const daAna = await buscarFichaDoCliente(ids.marina, ids.ana);
    const doBruno = await buscarFichaDoCliente(ids.marina, ids.bruno);

    expect(daAna?.recados.map((r) => r.texto)).toEqual(["bora caprichar no café da manhã"]);
    expect(doBruno?.recados.map((r) => r.texto)).toEqual(["não esquece o alongamento"]);
  });

  it("profissional sem vínculo não abre a ficha nem sabendo o id", async () => {
    expect(await buscarFichaDoCliente(ids.marina, ids.carla)).toBeNull();
    // Bruno atende a Marina, mas não o Rafael.
    expect(await buscarFichaDoCliente(ids.rafael, ids.bruno)).toBeNull();
  });

  it("vínculo PENDENTE ainda não dá acesso", async () => {
    const pendente = await prismaNutri.cliente.create({
      data: { nome: "Lucas", tokenAcesso: "tok-lucas", codigoConvite: "LUC234" },
    });
    await prismaNutri.vinculo.create({
      data: { clienteId: pendente.id, profissionalId: ids.carla, tipo: "NUTRICAO", status: "PENDENTE" },
    });

    expect(await buscarFichaDoCliente(pendente.id, ids.carla)).toBeNull();

    const painel = await buscarClientesDoProfissional(ids.carla);
    expect(painel.map((c) => c.cliente.nome)).not.toContain("Lucas");
  });

  it("o painel de cada um traz só o bloco do seu tipo", async () => {
    const painelBruno = await buscarClientesDoProfissional(ids.bruno);
    expect(painelBruno).toHaveLength(1);
    expect(painelBruno[0].cliente.nome).toBe("Marina");
    expect(painelBruno[0].nutricao).toBeNull();
    expect(painelBruno[0].treino).not.toBeNull();

    const painelAna = await buscarClientesDoProfissional(ids.ana);
    expect(painelAna.map((c) => c.cliente.nome).sort()).toEqual(["Marina", "Rafael"]);
    for (const linha of painelAna) {
      expect(linha.treino).toBeNull();
      expect(linha.nutricao).not.toBeNull();
    }
  });

  it("encerrar o vínculo tira o acesso, sem apagar o histórico", async () => {
    const vinculo = await prismaNutri.vinculo.findFirstOrThrow({
      where: { clienteId: ids.rafael, profissionalId: ids.ana },
    });
    await prismaNutri.vinculo.update({ where: { id: vinculo.id }, data: { status: "ENCERRADO" } });

    expect(await buscarFichaDoCliente(ids.rafael, ids.ana)).toBeNull();
    // A linha continua lá: encerrar é mudança de status, não exclusão.
    expect(await prismaNutri.vinculo.findUnique({ where: { id: vinculo.id } })).not.toBeNull();

    // E o índice parcial libera a vaga: outra nutricionista pode entrar,
    // sem sobrescrever o registro de que a Ana atendeu antes.
    await prismaNutri.vinculo.create({
      data: { clienteId: ids.rafael, profissionalId: ids.carla, tipo: "NUTRICAO", status: "ATIVO" },
    });
    const historico = await prismaNutri.vinculo.findMany({
      where: { clienteId: ids.rafael, tipo: "NUTRICAO" },
    });
    expect(historico).toHaveLength(2);
  });

  it("dois vínculos vivos do mesmo tipo são barrados pelo banco", async () => {
    const disputado = await prismaNutri.cliente.create({
      data: { nome: "Disputado", tokenAcesso: "tok-disputado", codigoConvite: "DIS234" },
    });
    await prismaNutri.vinculo.create({
      data: { clienteId: disputado.id, profissionalId: ids.ana, tipo: "NUTRICAO", status: "ATIVO" },
    });

    // Mesmo que a checagem da action falhasse, o índice parcial segura.
    await expect(
      prismaNutri.vinculo.create({
        data: { clienteId: disputado.id, profissionalId: ids.carla, tipo: "NUTRICAO", status: "PENDENTE" },
      }),
    ).rejects.toThrow();
  });
});
