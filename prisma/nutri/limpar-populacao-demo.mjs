// Remove a população de placeholder criada por populacao-demo.ts.
//
// Roda à mão, nunca no build:
//   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node prisma/nutri/limpar-populacao-demo.mjs
//
// Este é o único lugar do projeto que apaga linha de verdade, e existe
// porque estes dados nunca foram de ninguém: são inventados, criados por
// um seed, e marcados desde o nascimento com prefixo próprio. A regra de
// "nunca exclusão física" protege dado de negócio real — arquivar um
// cliente de verdade continua sendo mudança de status.
//
// O alvo é sempre o prefixo. Cliente com tokenAcesso "demo-pop-" e
// profissional com authUserId "demo-pop-prof-" só existem se o
// SEED_POPULACAO_DEMO os criou; ninguém se cadastra com esses valores
// pela aplicação.
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error("TURSO_DATABASE_URL não configurada.");
  process.exit(1);
}

const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

const clientes = await db.execute("SELECT id, nome FROM clientes WHERE tokenAcesso LIKE 'demo-pop-%'");
const profissionais = await db.execute("SELECT id, nome FROM profissionais WHERE authUserId LIKE 'demo-pop-prof-%'");

if (clientes.rows.length === 0 && profissionais.rows.length === 0) {
  console.log("Nada de população demo no banco.");
  process.exit(0);
}

const idsClientes = clientes.rows.map((r) => `'${r.id}'`).join(",");
const idsProfissionais = profissionais.rows.map((r) => `'${r.id}'`).join(",");

// Ordem importa: os filhos primeiro, senão as foreign keys barram.
if (idsClientes) {
  for (const tabela of [
    "refeicoes",
    "sessoes_treino",
    "medidas",
    "anotacoes",
    "favoritos",
    "planos_nutricionais",
    "treinos_prescritos",
    "anamnese_nutricional",
    "anamnese_treino",
    "vinculos",
  ]) {
    await db.execute(`DELETE FROM ${tabela} WHERE clienteId IN (${idsClientes})`);
  }
  await db.execute(`DELETE FROM clientes WHERE id IN (${idsClientes})`);
}

if (idsProfissionais) {
  // Um profissional demo pode ter anotado num cliente que não é demo, se
  // alguém tiver mexido à mão. Limpa o que sobrou antes de removê-lo.
  await db.execute(`DELETE FROM anotacoes WHERE profissionalId IN (${idsProfissionais})`);
  await db.execute(`DELETE FROM vinculos WHERE profissionalId IN (${idsProfissionais})`);
  await db.execute(`DELETE FROM profissionais WHERE id IN (${idsProfissionais})`);
}

console.log(`Removidos ${clientes.rows.length} clientes e ${profissionais.rows.length} profissionais de demonstração.`);
console.log("Lembre de tirar SEED_POPULACAO_DEMO das variáveis, senão o próximo build recria.");
db.close();
