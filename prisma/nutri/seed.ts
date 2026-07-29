import { PrismaClient } from "./generated";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

const libsql = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const prismaNutri = new PrismaClient({ adapter: new PrismaLibSQL(libsql) });

// Nutricionista demo, pra src/lib/nutri/auth.ts ter o que resolver quando
// Supabase não está configurado (navegação local de /nutri sem credenciais
// reais) — mesmo padrão do advogado demo do sistema jurídico.
async function seedNutricionistaDemo() {
  await prismaNutri.nutricionista.upsert({
    where: { authUserId: "demo-nutricionista-auth-id" },
    update: {},
    create: {
      authUserId: "demo-nutricionista-auth-id",
      nome: "Nutricionista Demo",
      email: "nutricionista.demo@example.com",
    },
  });
}

seedNutricionistaDemo()
  .then(() => console.log("Nutricionista demo semeado no Turso."))
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prismaNutri.$disconnect();
  });
