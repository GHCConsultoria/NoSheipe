import { PrismaClient } from "../../../prisma/nutri/generated";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

/**
 * Client Prisma do módulo SHEIPE — banco próprio (Turso/libSQL), separado
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

/**
 * Operações de leitura que devem esconder registros removidos. Escrita
 * (create/update/delete) e busca por chave única (findUnique) ficam de
 * fora: a remoção é um update que precisa alcançar a própria linha, e a
 * dedupe por clienteRegistroId não pode deixar de ver uma linha só porque
 * ela foi removida.
 */
const OPERACOES_DE_LEITURA = new Set(["findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy"]);

/**
 * Injeta `removidoEm: null` no where, mutando o args no lugar (o `query`
 * precisa do tipo original que o Prisma inferiu, então não dá pra passar um
 * objeto novo).
 *
 * É a garantia central da remoção lógica: em vez de lembrar de filtrar em
 * cada uma das ~15 consultas de saldo, aderência, histórico e métricas —
 * onde esquecer um site deixaria o registro removido envenenar o anel em
 * algum canto —, a exclusão passa a ser automática e cobre consultas
 * futuras sem ninguém pensar nisso.
 */
function ocultarRemovidos(operation: string, args: unknown): void {
  if (!OPERACOES_DE_LEITURA.has(operation)) return;
  const comWhere = args as { where?: Record<string, unknown> };
  comWhere.where = { AND: [comWhere.where ?? {}, { removidoEm: null }] };
}

function criarPrismaNutri() {
  return new PrismaClient({ adapter }).$extends({
    query: {
      refeicao: {
        $allOperations({ operation, args, query }) {
          ocultarRemovidos(operation, args);
          return query(args);
        },
      },
      sessaoTreino: {
        $allOperations({ operation, args, query }) {
          ocultarRemovidos(operation, args);
          return query(args);
        },
      },
      corrida: {
        $allOperations({ operation, args, query }) {
          ocultarRemovidos(operation, args);
          return query(args);
        },
      },
    },
  });
}

type PrismaNutriEstendido = ReturnType<typeof criarPrismaNutri>;

const globalForPrismaNutri = globalThis as unknown as { prismaNutri?: PrismaNutriEstendido };

export const prismaNutri = globalForPrismaNutri.prismaNutri ?? criarPrismaNutri();

if (process.env.NODE_ENV !== "production") {
  globalForPrismaNutri.prismaNutri = prismaNutri;
}
