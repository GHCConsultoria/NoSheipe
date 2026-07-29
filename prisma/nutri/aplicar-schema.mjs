// Aplica prisma/nutri/init.sql no Turso via @libsql/client direto.
//
// Não dá pra usar `prisma db push`/`migrate` aqui: o CLI do Prisma exige que
// a URL do datasource sqlite comece com "file:" (erro de validação de
// schema, P1012) — não entende "libsql://" mesmo com o driver adapter
// configurado no client em runtime. O adapter só vale pra o PrismaClient da
// aplicação (src/lib/nutri/prisma.ts); pra aplicar o schema em si, a via é
// executar o SQL manualmente com o client libSQL puro. init.sql usa
// "IF NOT EXISTS" em tudo, então rodar de novo em cada deploy é seguro.
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) {
  console.log("TURSO_DATABASE_URL não configurada — pulando aplicação do schema no Turso.");
  process.exit(0);
}

const client = createClient({ url, authToken });
const caminhoSql = path.join(path.dirname(fileURLToPath(import.meta.url)), "init.sql");
const sql = readFileSync(caminhoSql, "utf8");

const statements = sql
  .split(";")
  .map((bloco) =>
    bloco
      .split("\n")
      .filter((linha) => !linha.trim().startsWith("--"))
      .join("\n")
      .trim(),
  )
  .filter((s) => s.length > 0);

for (const stmt of statements) {
  await client.execute(stmt);
}

console.log(`Schema do NoSheipe aplicado no Turso (${statements.length} statements).`);
client.close();
