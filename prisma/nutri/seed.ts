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
  return prismaNutri.nutricionista.upsert({
    where: { authUserId: "demo-nutricionista-auth-id" },
    update: {},
    create: {
      authUserId: "demo-nutricionista-auth-id",
      nome: "Nutricionista Demo",
      email: "nutricionista.demo@example.com",
    },
  });
}

const horasAtras = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);
const diasAtras = (d: number, h: number) => new Date(Date.now() - (d * 24 + h) * 60 * 60 * 1000);

interface ItemFake {
  nome: string;
  gramas: number;
  kcal: number;
  proteina: number;
  carbo: number;
  gordura: number;
}

interface RegistroFake {
  clienteRegistroId: string;
  origem: "AUDIO" | "TEXTO";
  entradaBruta: string;
  itens: ItemFake[];
  registradoEm: Date;
  confianca: number;
}

function totais(itens: ItemFake[]) {
  return itens.reduce(
    (acc, item) => ({
      kcal: acc.kcal + item.kcal,
      proteina: acc.proteina + item.proteina,
      carbo: acc.carbo + item.carbo,
      gordura: acc.gordura + item.gordura,
    }),
    { kcal: 0, proteina: 0, carbo: 0, gordura: 0 },
  );
}

interface PacienteFake {
  tokenAcesso: string;
  nome: string;
  telefone?: string;
  metaKcal: number;
  metaProteina: number;
  metaCarbo: number;
  metaGordura: number;
  comConsentimento: boolean;
  arquivado?: boolean;
  registros: RegistroFake[];
}

// Quatro perfis de teste: um dentro da meta, um estourando, um bem abaixo
// (pra ver os três estados de aderência no painel) e um que ainda não deu
// consentimento LGPD (pra ver a tela de consentimento em /p/[token]).
const PACIENTES_FAKE: PacienteFake[] = [
  {
    tokenAcesso: "demo-marina-souza",
    nome: "Marina Souza",
    telefone: "11988887777",
    metaKcal: 1800,
    metaProteina: 120,
    metaCarbo: 180,
    metaGordura: 60,
    comConsentimento: true,
    registros: [
      {
        clienteRegistroId: "demo-seed-marina-cafe-hoje",
        origem: "TEXTO",
        entradaBruta: "2 fatias de pão integral com ovo mexido e café com leite",
        itens: [{ nome: "pão integral com ovo e café com leite", gramas: 220, kcal: 420, proteina: 22, carbo: 45, gordura: 16 }],
        registradoEm: horasAtras(5),
        confianca: 0.82,
      },
      {
        clienteRegistroId: "demo-seed-marina-almoco-hoje",
        origem: "AUDIO",
        entradaBruta: "150g de peito de frango grelhado com arroz e salada",
        itens: [{ nome: "frango grelhado com arroz e salada", gramas: 400, kcal: 620, proteina: 48, carbo: 70, gordura: 14 }],
        registradoEm: horasAtras(2),
        confianca: 0.88,
      },
      {
        clienteRegistroId: "demo-seed-marina-almoco-ontem",
        origem: "TEXTO",
        entradaBruta: "salmão grelhado com legumes no vapor",
        itens: [{ nome: "salmão com legumes", gramas: 350, kcal: 540, proteina: 42, carbo: 30, gordura: 22 }],
        registradoEm: diasAtras(1, 3),
        confianca: 0.85,
      },
    ],
  },
  {
    tokenAcesso: "demo-rafael-lima",
    nome: "Rafael Lima",
    telefone: "11977776666",
    metaKcal: 2000,
    metaProteina: 140,
    metaCarbo: 200,
    metaGordura: 65,
    comConsentimento: true,
    registros: [
      {
        clienteRegistroId: "demo-seed-rafael-cafe-hoje",
        origem: "TEXTO",
        entradaBruta: "pão de queijo e um copo de suco de laranja",
        itens: [{ nome: "pão de queijo com suco", gramas: 200, kcal: 480, proteina: 12, carbo: 55, gordura: 20 }],
        registradoEm: horasAtras(6),
        confianca: 0.79,
      },
      {
        clienteRegistroId: "demo-seed-rafael-almoco-hoje",
        origem: "TEXTO",
        entradaBruta: "marmita de picanha com arroz, feijão e farofa, mais um refrigerante",
        itens: [{ nome: "picanha com arroz, feijão, farofa e refrigerante", gramas: 550, kcal: 1350, proteina: 70, carbo: 140, gordura: 55 }],
        registradoEm: horasAtras(3),
        confianca: 0.68,
      },
      {
        clienteRegistroId: "demo-seed-rafael-lanche-hoje",
        origem: "AUDIO",
        entradaBruta: "um pedaço de bolo de chocolate",
        itens: [{ nome: "bolo de chocolate", gramas: 120, kcal: 430, proteina: 6, carbo: 55, gordura: 20 }],
        registradoEm: horasAtras(1),
        confianca: 0.74,
      },
    ],
  },
  {
    tokenAcesso: "demo-camila-torres",
    nome: "Camila Torres",
    telefone: "11966665555",
    metaKcal: 1600,
    metaProteina: 110,
    metaCarbo: 150,
    metaGordura: 50,
    comConsentimento: true,
    registros: [
      {
        clienteRegistroId: "demo-seed-camila-cafe-hoje",
        origem: "TEXTO",
        entradaBruta: "iogurte natural com granola",
        itens: [{ nome: "iogurte com granola", gramas: 180, kcal: 260, proteina: 14, carbo: 30, gordura: 8 }],
        registradoEm: horasAtras(4),
        confianca: 0.83,
      },
    ],
  },
  {
    tokenAcesso: "demo-bruno-alves",
    nome: "Bruno Alves",
    telefone: "11955554444",
    metaKcal: 2200,
    metaProteina: 150,
    metaCarbo: 220,
    metaGordura: 70,
    comConsentimento: false,
    registros: [],
  },
  {
    tokenAcesso: "demo-paciente-arquivado",
    nome: "Paciente Arquivado (teste)",
    metaKcal: 1800,
    metaProteina: 120,
    metaCarbo: 180,
    metaGordura: 60,
    comConsentimento: true,
    arquivado: true,
    registros: [],
  },
];

/**
 * Pacientes + registros de refeição fake pra popular o painel de teste —
 * cobre paciente dentro da meta, fora da meta (estourando), bem abaixo, sem
 * consentimento ainda e um arquivado (não deve aparecer no painel). Só roda
 * quando o nutricionista demo é usado (sem Supabase configurado), então não
 * risca dados reais de produção.
 */
async function seedPacientesFake(nutricionistaId: string) {
  for (const pacienteFake of PACIENTES_FAKE) {
    const paciente = await prismaNutri.paciente.upsert({
      where: { tokenAcesso: pacienteFake.tokenAcesso },
      update: {
        status: pacienteFake.arquivado ? "ARQUIVADO" : "ATIVO",
        consentimentoEm: pacienteFake.comConsentimento ? new Date() : null,
      },
      create: {
        nutricionistaId,
        nome: pacienteFake.nome,
        telefone: pacienteFake.telefone,
        tokenAcesso: pacienteFake.tokenAcesso,
        metaKcal: pacienteFake.metaKcal,
        metaProteina: pacienteFake.metaProteina,
        metaCarbo: pacienteFake.metaCarbo,
        metaGordura: pacienteFake.metaGordura,
        consentimentoEm: pacienteFake.comConsentimento ? new Date() : null,
        status: pacienteFake.arquivado ? "ARQUIVADO" : "ATIVO",
      },
    });

    for (const registro of pacienteFake.registros) {
      const soma = totais(registro.itens);
      await prismaNutri.registroRefeicao.upsert({
        where: { clienteRegistroId: registro.clienteRegistroId },
        update: {},
        create: {
          pacienteId: paciente.id,
          clienteRegistroId: registro.clienteRegistroId,
          origem: registro.origem,
          entradaBruta: registro.entradaBruta,
          itens: JSON.stringify(registro.itens),
          kcal: soma.kcal,
          proteina: soma.proteina,
          carbo: soma.carbo,
          gordura: soma.gordura,
          confianca: registro.confianca,
          registradoEm: registro.registradoEm,
        },
      });
    }
  }
}

seedNutricionistaDemo()
  .then((nutricionista) => seedPacientesFake(nutricionista.id))
  .then(() => console.log(`Nutricionista demo + ${PACIENTES_FAKE.length} pacientes fake semeados no Turso.`))
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prismaNutri.$disconnect();
  });
