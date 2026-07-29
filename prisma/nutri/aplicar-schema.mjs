// Aplica prisma/nutri/init.sql no Turso via @libsql/client direto.
//
// Não dá pra usar `prisma db push`/`migrate` aqui: o CLI do Prisma exige que
// a URL do datasource sqlite comece com "file:" (erro de validação de
// schema, P1012) — não entende "libsql://" mesmo com o driver adapter
// configurado no client em runtime. O adapter só vale pra o PrismaClient da
// aplicação (src/lib/nutri/prisma.ts); pra aplicar o schema em si, a via é
// executar o SQL manualmente com o client libSQL puro. init.sql usa
// "IF NOT EXISTS" em tudo que suporta, então rodar de novo em cada deploy é
// seguro — ver a exceção do ALTER TABLE mais abaixo.
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { separarStatements } from "./separar-statements.mjs";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) {
  console.log("TURSO_DATABASE_URL não configurada — pulando aplicação do schema no Turso.");
  process.exit(0);
}

const client = createClient({ url, authToken });
const caminhoSql = path.join(path.dirname(fileURLToPath(import.meta.url)), "init.sql");
const sql = readFileSync(caminhoSql, "utf8");

const statements = separarStatements(sql);

// O SQLite não tem "ADD COLUMN IF NOT EXISTS", e este script roda em todo
// build — então um ALTER TABLE que adiciona coluna falha da segunda vez em
// diante com "duplicate column name". Esse erro específico significa "já
// aplicado", que é exatamente o estado desejado, então é ignorado. Qualquer
// outro erro continua estourando: a intenção é ser idempotente, não
// silencioso.
function ehColunaJaExistente(erro) {
  return /duplicate column name/i.test(erro instanceof Error ? erro.message : String(erro));
}

let aplicados = 0;
let jaExistentes = 0;

for (const stmt of statements) {
  try {
    await client.execute(stmt);
    aplicados += 1;
  } catch (erro) {
    if (ehColunaJaExistente(erro)) {
      jaExistentes += 1;
      continue;
    }
    throw erro;
  }
}

const detalheJaExistentes = jaExistentes > 0 ? ` (${jaExistentes} coluna(s) já existiam)` : "";
console.log(`Schema do NoSheipe aplicado no Turso (${aplicados} statements)${detalheJaExistentes}.`);
client.close();
