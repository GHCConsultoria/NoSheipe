import { PrismaClient } from "../../../prisma/nutri/generated";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

/**
 * Client Prisma do módulo NoSheipe — banco próprio (Turso/libSQL), separado
 * do Postgres/Supabase do sistema jurídico (ver src/lib/prisma.ts). URL
 * placeholder quando TURSO_DATABASE_URL não está configurada: constrói o
 * client sem lançar (só falha na primeira query de verdade), igual ao
 * PrismaClient comum sem DATABASE_URL — evita quebrar o build/prerender.
 */
const libsql = createClient({
  url: process.env.TURSO_DATABASE_URL || "libsql://not-configured.turso.io",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const adapter = new PrismaLibSQL(libsql);

const globalForPrismaNutri = globalThis as unknown as { prismaNutri?: PrismaClient };

export const prismaNutri = globalForPrismaNutri.prismaNutri ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrismaNutri.prismaNutri = prismaNutri;
}
