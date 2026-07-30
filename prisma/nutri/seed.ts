import { PrismaClient } from "./generated";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";
import { seedPopulacaoDemo } from "./populacao-demo";

const libsql = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const prismaNutri = new PrismaClient({ adapter: new PrismaLibSQL(libsql) });

const horasAtras = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);
const diasAtras = (d: number, h = 0) => new Date(Date.now() - (d * 24 + h) * 60 * 60 * 1000);

/**
 * Profissional demo — híbrido de propósito (nutricionista E personal), pra
 * src/lib/profissional/auth.ts ter o que resolver sem Supabase configurado
 * e pro painel unificado ser exercitado no caso mais completo.
 */
async function seedProfissionalDemo() {
  return prismaNutri.profissional.upsert({
    where: { authUserId: "demo-profissional-auth-id" },
    update: { ehNutricionista: true, ehPersonal: true },
    create: {
      authUserId: "demo-profissional-auth-id",
      nome: "Profissional Demo",
      email: "profissional.demo@example.com",
      ehNutricionista: true,
      ehPersonal: true,
      crn: "CRN-0000",
      cref: "CREF-0000",
    },
  });
}

/**
 * Concede acesso à interface administrativa. MASTER_EMAILS aceita uma
 * lista separada por vírgula.
 *
 * Continua sendo concessão manual, como combinado: é configuração de
 * ambiente aplicada no deploy, não uma tela dentro do app — não existe
 * caminho pelo qual um profissional se promova sozinho.
 *
 * Só concede, nunca revoga: tirar o acesso de alguém é decisão deliberada
 * e se faz no banco, pra ninguém perder acesso por um deploy que esqueceu
 * a variável. Os masters atuais vão pro log em todo deploy, pra a lista
 * nunca ficar invisível.
 */
async function seedMasters() {
  const emails = (process.env.MASTER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  for (const email of emails) {
    const profissional = await prismaNutri.profissional.findUnique({ where: { email } });
    if (!profissional) {
      console.warn(`MASTER_EMAILS: "${email}" nao corresponde a nenhum profissional — ignorado.`);
      continue;
    }
    if (profissional.ehMaster) continue;
    await prismaNutri.profissional.update({ where: { id: profissional.id }, data: { ehMaster: true } });
    console.log(`Acesso de administracao concedido a "${profissional.nome}".`);
  }

  const masters = await prismaNutri.profissional.findMany({ where: { ehMaster: true }, select: { email: true } });
  console.log(
    masters.length > 0
      ? `Masters atuais: ${masters.map((m) => m.email).join(", ")}.`
      : "Nenhum master — /master devolve 404 pra todo mundo.",
  );
}

/**
 * Segundo profissional, só personal — existe pra o fluxo da Fase 3 ser
 * testável sem criar duas contas: é ele que aparece pedindo pra acompanhar
 * o treino de um cliente que já tem nutricionista.
 */
async function seedOutroProfissional() {
  return prismaNutri.profissional.upsert({
    where: { authUserId: "demo-personal-convidado-auth-id" },
    update: {},
    create: {
      authUserId: "demo-personal-convidado-auth-id",
      nome: "Bruno Personal (demo)",
      email: "bruno.personal.demo@example.com",
      ehNutricionista: false,
      ehPersonal: true,
      cref: "CREF-0001",
    },
  });
}

/**
 * Deixa um pedido de acompanhamento esperando resposta na página do
 * cliente, pra a tela de aceitar/recusar ter o que mostrar no preview.
 *
 * Idempotente: só cria se não houver vínculo vivo desse tipo. Sem isso, um
 * segundo deploy esbarraria no índice parcial — ou pior, recriaria o
 * pedido depois de o cliente já ter recusado.
 */
async function seedSolicitacaoPendente(clienteToken: string, profissionalId: string, tipo: "NUTRICAO" | "TREINO") {
  const cliente = await prismaNutri.cliente.findUnique({ where: { tokenAcesso: clienteToken } });
  if (!cliente) return;

  const vivo = await prismaNutri.vinculo.findFirst({
    where: { clienteId: cliente.id, tipo, status: { not: "ENCERRADO" } },
  });
  if (vivo) return;

  await prismaNutri.vinculo.create({
    data: { clienteId: cliente.id, profissionalId, tipo, status: "PENDENTE" },
  });
}

/**
 * Dono dos clientes de exemplo. Com Supabase configurado o login resolve a
 * conta real e o demo fica inalcançável — o painel abriria vazio. Definir
 * DONO_DEMO_EMAIL com o e-mail de uma conta real passa os exemplos pra ela.
 * O e-mail fica em variável de ambiente de propósito: o repositório é
 * público.
 */
async function obterDono(demo: { id: string; nome: string }) {
  const email = process.env.DONO_DEMO_EMAIL?.trim();
  if (!email) return demo;

  const real = await prismaNutri.profissional.findUnique({ where: { email } });
  if (!real) {
    console.warn(`DONO_DEMO_EMAIL="${email}" nao corresponde a nenhum profissional — usando o demo.`);
    return demo;
  }
  return real;
}

interface ItemFake {
  nome: string;
  gramas: number;
  kcal: number;
  proteina: number;
  carbo: number;
  gordura: number;
}

function totais(itens: ItemFake[]) {
  return itens.reduce(
    (acc, i) => ({
      kcal: acc.kcal + i.kcal,
      proteina: acc.proteina + i.proteina,
      carbo: acc.carbo + i.carbo,
      gordura: acc.gordura + i.gordura,
    }),
    { kcal: 0, proteina: 0, carbo: 0, gordura: 0 },
  );
}

interface ClienteFake {
  tokenAcesso: string;
  codigoConvite: string;
  nome: string;
  telefone?: string;
  comConsentimento: boolean;
  dataNascimento?: string;
  sexo?: string;
  alturaCm?: number;
  objetivo?: string;
  metas?: { metaKcal: number; metaProteina: number; metaCarbo: number; metaGordura: number };
  treino?: { nome: string; descricao: string; diasPorSemana: number };
  refeicoes?: {
    clienteRegistroId: string;
    origem: "AUDIO" | "TEXTO";
    entradaBruta: string;
    itens: ItemFake[];
    registradoEm: Date;
    confianca: number;
  }[];
  sessoes?: { clienteRegistroId: string; origem: "AUDIO" | "TEXTO"; entradaBruta: string; realizadoEm: Date }[];
  pesos?: { pesoKg: number; registradoEm: Date }[];
  favoritos?: string[];
}

/**
 * Cobre os casos que a tela do cliente precisa mostrar: quem tem os dois
 * acompanhamentos (a tela de progresso combinado), quem tem só um de cada,
 * e quem ainda não deu consentimento.
 */
const CLIENTES_FAKE: ClienteFake[] = [
  {
    tokenAcesso: "demo-marina-souza",
    codigoConvite: "MARINA",
    nome: "Marina Souza",
    telefone: "11988887777",
    comConsentimento: true,
    dataNascimento: "1994-03-12",
    sexo: "F",
    alturaCm: 165,
    objetivo: "emagrecer com saúde",
    metas: { metaKcal: 1800, metaProteina: 120, metaCarbo: 180, metaGordura: 60 },
    treino: {
      nome: "Full body 3x",
      descricao: "Agachamento, supino, remada, elevação lateral, prancha.",
      diasPorSemana: 3,
    },
    refeicoes: [
      {
        clienteRegistroId: "demo-marina-cafe",
        origem: "TEXTO",
        entradaBruta: "2 fatias de pão integral com ovo mexido e café com leite",
        itens: [{ nome: "pão integral com ovo e café", gramas: 220, kcal: 420, proteina: 22, carbo: 45, gordura: 16 }],
        registradoEm: horasAtras(5),
        confianca: 0.82,
      },
      {
        clienteRegistroId: "demo-marina-almoco",
        origem: "AUDIO",
        entradaBruta: "150g de peito de frango grelhado com arroz e salada",
        itens: [{ nome: "frango com arroz e salada", gramas: 400, kcal: 620, proteina: 48, carbo: 70, gordura: 14 }],
        registradoEm: horasAtras(2),
        confianca: 0.88,
      },
    ],
    sessoes: [
      {
        clienteRegistroId: "demo-marina-treino-hoje",
        origem: "TEXTO",
        entradaBruta: "Full body completo",
        realizadoEm: horasAtras(8),
      },
      {
        clienteRegistroId: "demo-marina-treino-2",
        origem: "TEXTO",
        entradaBruta: "Full body, aumentei o agachamento",
        realizadoEm: diasAtras(2),
      },
    ],
    pesos: [
      { pesoKg: 74.2, registradoEm: diasAtras(35) },
      { pesoKg: 73.6, registradoEm: diasAtras(28) },
      { pesoKg: 73.1, registradoEm: diasAtras(21) },
      { pesoKg: 72.6, registradoEm: diasAtras(14) },
      { pesoKg: 72.4, registradoEm: diasAtras(7) },
      { pesoKg: 71.9, registradoEm: horasAtras(6) },
    ],
    favoritos: ["iogurte natural com granola", "150g de frango grelhado com arroz e salada"],
  },
  {
    tokenAcesso: "demo-rafael-lima",
    codigoConvite: "RAFAEL",
    nome: "Rafael Lima",
    telefone: "11977776666",
    comConsentimento: true,
    dataNascimento: "1988-07-30",
    sexo: "M",
    alturaCm: 180,
    objetivo: "ganhar massa",
    metas: { metaKcal: 2000, metaProteina: 140, metaCarbo: 200, metaGordura: 65 },
    refeicoes: [
      {
        clienteRegistroId: "demo-rafael-almoco",
        origem: "TEXTO",
        entradaBruta: "marmita de picanha com arroz, feijão e farofa, mais um refrigerante",
        itens: [{ nome: "picanha com acompanhamentos", gramas: 550, kcal: 1350, proteina: 70, carbo: 140, gordura: 55 }],
        registradoEm: horasAtras(3),
        confianca: 0.68,
      },
      {
        clienteRegistroId: "demo-rafael-lanche",
        origem: "AUDIO",
        entradaBruta: "um pedaço de bolo de chocolate",
        itens: [{ nome: "bolo de chocolate", gramas: 120, kcal: 430, proteina: 6, carbo: 55, gordura: 20 }],
        registradoEm: horasAtras(1),
        confianca: 0.74,
      },
    ],
  },
  {
    tokenAcesso: "demo-joao-pereira",
    codigoConvite: "JOAOPT",
    nome: "João Pereira",
    telefone: "11944443333",
    comConsentimento: true,
    dataNascimento: "1996-11-02",
    sexo: "M",
    alturaCm: 178,
    objetivo: "hipertrofia",
    treino: {
      nome: "Treino A/B — hipertrofia",
      descricao: "A: agachamento 4x10, leg press 3x12, cadeira extensora 3x15. B: supino 4x10, remada 4x10.",
      diasPorSemana: 4,
    },
    sessoes: [
      {
        clienteRegistroId: "demo-joao-treino-hoje",
        origem: "TEXTO",
        entradaBruta: "Treino A completo",
        realizadoEm: horasAtras(3),
      },
      {
        clienteRegistroId: "demo-joao-treino-2",
        origem: "AUDIO",
        entradaBruta: "Treino B, subi a carga do supino",
        realizadoEm: diasAtras(2, 2),
      },
    ],
  },
  {
    tokenAcesso: "demo-lucas-martins",
    codigoConvite: "LUCASM",
    nome: "Lucas Martins",
    telefone: "11922221111",
    comConsentimento: false,
    treino: {
      nome: "Treino iniciante",
      descricao: "Adaptação: agachamento livre, flexão, remada com elástico.",
      diasPorSemana: 2,
    },
  },
];

async function seedClientes(profissionalId: string) {
  for (const fake of CLIENTES_FAKE) {
    const cliente = await prismaNutri.cliente.upsert({
      where: { tokenAcesso: fake.tokenAcesso },
      update: { consentimentoEm: fake.comConsentimento ? new Date() : null },
      create: {
        nome: fake.nome,
        telefone: fake.telefone,
        tokenAcesso: fake.tokenAcesso,
        codigoConvite: fake.codigoConvite,
        consentimentoEm: fake.comConsentimento ? new Date() : null,
        dataNascimento: fake.dataNascimento ? new Date(fake.dataNascimento) : null,
        sexo: fake.sexo,
        alturaCm: fake.alturaCm,
        objetivo: fake.objetivo,
      },
    });

    // Vínculo por tipo, sempre reapontando pro dono atual — é o que faz
    // DONO_DEMO_EMAIL mover os exemplos entre contas.
    for (const [tipo, temPrescricao] of [
      ["NUTRICAO", Boolean(fake.metas)],
      ["TREINO", Boolean(fake.treino)],
    ] as const) {
      if (!temPrescricao) continue;
      // Sem upsert por [clienteId, tipo]: o unique agora é parcial (só
      // entre vínculos vivos), então o Prisma não o conhece. Procura o
      // vínculo vivo à mão e reaponta, que é o mesmo efeito.
      const vivo = await prismaNutri.vinculo.findFirst({
        where: { clienteId: cliente.id, tipo, status: { not: "ENCERRADO" } },
      });
      if (vivo) {
        await prismaNutri.vinculo.update({
          where: { id: vivo.id },
          data: { profissionalId, status: "ATIVO", aceitoEm: vivo.aceitoEm ?? new Date() },
        });
      } else {
        await prismaNutri.vinculo.create({
          data: { clienteId: cliente.id, profissionalId, tipo, status: "ATIVO", aceitoEm: new Date() },
        });
      }
    }

    if (fake.metas) {
      const existente = await prismaNutri.planoNutricional.findFirst({ where: { clienteId: cliente.id, ativo: true } });
      if (!existente) {
        await prismaNutri.planoNutricional.create({ data: { clienteId: cliente.id, ...fake.metas } });
      }
    }

    if (fake.treino) {
      const existente = await prismaNutri.treinoPrescrito.findFirst({ where: { clienteId: cliente.id, ativo: true } });
      if (!existente) {
        await prismaNutri.treinoPrescrito.create({ data: { clienteId: cliente.id, ...fake.treino } });
      }
    }

    for (const r of fake.refeicoes ?? []) {
      const soma = totais(r.itens);
      await prismaNutri.refeicao.upsert({
        where: { clienteRegistroId: r.clienteRegistroId },
        update: {},
        create: {
          clienteId: cliente.id,
          clienteRegistroId: r.clienteRegistroId,
          origem: r.origem,
          entradaBruta: r.entradaBruta,
          itens: JSON.stringify(r.itens),
          ...soma,
          confianca: r.confianca,
          registradoEm: r.registradoEm,
        },
      });
    }

    for (const s of fake.sessoes ?? []) {
      await prismaNutri.sessaoTreino.upsert({
        where: { clienteRegistroId: s.clienteRegistroId },
        update: {},
        create: {
          clienteId: cliente.id,
          clienteRegistroId: s.clienteRegistroId,
          origem: s.origem,
          entradaBruta: s.entradaBruta,
          realizadoEm: s.realizadoEm,
        },
      });
    }

    // Peso e favoritos não têm chave natural — só semeia se estiver vazio,
    // pra rodar de novo não empilhar duplicata.
    if (fake.pesos && (await prismaNutri.medida.count({ where: { clienteId: cliente.id } })) === 0) {
      await prismaNutri.medida.createMany({
        data: fake.pesos.map((p) => ({ clienteId: cliente.id, ...p })),
      });
    }
    if (fake.favoritos && (await prismaNutri.favorito.count({ where: { clienteId: cliente.id } })) === 0) {
      await prismaNutri.favorito.createMany({
        data: fake.favoritos.map((descricao) => ({ clienteId: cliente.id, descricao })),
      });
    }
  }
}

async function semear() {
  const demo = await seedProfissionalDemo();
  const dono = await obterDono(demo);
  await seedClientes(dono.id);

  // Rafael só tem nutrição — o Bruno pede o treino dele, e o pedido fica
  // aguardando resposta em /p/demo-rafael-lima.
  const bruno = await seedOutroProfissional();
  await seedSolicitacaoPendente("demo-rafael-lima", bruno.id, "TREINO");

  console.log(`${CLIENTES_FAKE.length} clientes fake semeados no Turso, atribuídos a "${dono.nome}".`);
  console.log(`Pedido de vínculo pendente de "${bruno.nome}" em /p/demo-rafael-lima.`);

  // População de placeholder pro painel administrativo. Opcional: sem a
  // variável o banco fica só com os exemplos escritos à mão, que é o que
  // se quer num ambiente de verdade.
  if (process.env.SEED_POPULACAO_DEMO === "true") {
    const { profissionais, clientes } = await seedPopulacaoDemo(prismaNutri);
    console.log(
      clientes > 0
        ? `Populacao demo: ${profissionais} profissionais e ${clientes} clientes novos.`
        : `Populacao demo ja existia (${profissionais} profissionais) — nada criado.`,
    );
  }

  await seedMasters();
}

semear()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prismaNutri.$disconnect();
  });
