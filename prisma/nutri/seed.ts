import { PrismaClient } from "./generated";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

const libsql = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const prismaNutri = new PrismaClient({ adapter: new PrismaLibSQL(libsql) });

/**
 * Dono dos clientes de exemplo.
 *
 * Por padrão é o profissional demo. Com Supabase configurado, porém, o
 * login resolve a conta real e o demo fica inalcançável — o painel abre
 * vazio, porque os clientes de exemplo pertencem a outro profissional.
 *
 * Definir DONO_DEMO_EMAIL com o e-mail de uma conta real faz os clientes
 * de exemplo passarem pra ela, dando um painel já populado pra testar.
 * O e-mail fica em variável de ambiente de propósito: o repositório é
 * público. Sem a variável (ou com um e-mail que não existe), cai no demo.
 */
async function obterDonoDosExemplos(demo: { id: string; nome: string }) {
  const email = process.env.DONO_DEMO_EMAIL?.trim();
  if (!email) return demo;

  const real = await prismaNutri.profissional.findUnique({ where: { email } });
  if (!real) {
    console.warn(`DONO_DEMO_EMAIL="${email}" nao corresponde a nenhum profissional — usando o demo.`);
    return demo;
  }
  return real;
}

/**
 * Profissional demo — híbrido de propósito (nutricionista E personal), pra
 * src/lib/profissional/auth.ts ter o que resolver quando o Supabase não
 * está configurado, e pra o painel unificado ser exercitado no seu caso
 * mais completo (as duas seções visíveis ao mesmo tempo).
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

// Nutricionista/PersonalTrainer demo obsoletos: os models antigos ainda
// existem no schema (nenhuma exclusão física), e Paciente.nutricionistaId /
// Aluno.personalTrainerId continuam NOT NULL, então o seed precisa de uma
// linha em cada só pra satisfazer a FK. Nenhum código novo os lê.
async function seedDonosLegados() {
  const [nutricionista, personalTrainer] = await Promise.all([
    prismaNutri.nutricionista.upsert({
      where: { authUserId: "demo-nutricionista-auth-id" },
      update: {},
      create: {
        authUserId: "demo-nutricionista-auth-id",
        nome: "Nutricionista Demo (legado)",
        email: "nutricionista.demo@example.com",
      },
    }),
    prismaNutri.personalTrainer.upsert({
      where: { authUserId: "demo-personal-trainer-auth-id" },
      update: {},
      create: {
        authUserId: "demo-personal-trainer-auth-id",
        nome: "Personal Trainer Demo (legado)",
        email: "personal.demo@example.com",
      },
    }),
  ]);
  return { nutricionistaId: nutricionista.id, personalTrainerId: personalTrainer.id };
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
async function seedPacientesFake(profissionalId: string, nutricionistaId: string) {
  for (const pacienteFake of PACIENTES_FAKE) {
    const paciente = await prismaNutri.paciente.upsert({
      where: { tokenAcesso: pacienteFake.tokenAcesso },
      update: {
        // profissionalId no update também: reapontar pacientes que já
        // existiam antes da unificação pro dono novo.
        profissionalId,
        status: pacienteFake.arquivado ? "ARQUIVADO" : "ATIVO",
        consentimentoEm: pacienteFake.comConsentimento ? new Date() : null,
      },
      create: {
        profissionalId,
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

    // Peso + favoritos só pra Marina, pra ter um paciente com o gráfico de
    // evolução e os chips de refeição frequente visíveis no teste.
    if (pacienteFake.tokenAcesso === "demo-marina-souza") {
      const jaTemPeso = await prismaNutri.registroMedida.count({ where: { pacienteId: paciente.id } });
      if (jaTemPeso === 0) {
        for (const [semanasAtras, pesoKg] of [
          [5, 74.2],
          [4, 73.8],
          [3, 73.1],
          [2, 72.6],
          [1, 72.4],
          [0, 71.9],
        ] as const) {
          await prismaNutri.registroMedida.create({
            data: { pacienteId: paciente.id, pesoKg, registradoEm: diasAtras(semanasAtras * 7, 4) },
          });
        }
      }

      const jaTemFavorito = await prismaNutri.refeicaoFavorita.count({ where: { pacienteId: paciente.id } });
      if (jaTemFavorito === 0) {
        for (const descricao of [
          "2 fatias de pão integral com ovo mexido",
          "150g de frango grelhado com arroz e salada",
          "iogurte natural com granola",
        ]) {
          await prismaNutri.refeicaoFavorita.create({ data: { pacienteId: paciente.id, descricao } });
        }
      }
    }
  }
}

interface RegistroTreinoFake {
  clienteRegistroId: string;
  origem: "AUDIO" | "TEXTO";
  entradaBruta: string;
  realizadoEm: Date;
}

interface AlunoFake {
  tokenAcesso: string;
  nome: string;
  telefone?: string;
  comConsentimento: boolean;
  treino?: { nome: string; descricao: string; diasPorSemana: number };
  registros: RegistroTreinoFake[];
}

// Três perfis: um treinando dentro do esperado, um bem abaixo da meta
// semanal (aparece "fora" no painel) e um sem consentimento ainda.
const ALUNOS_FAKE: AlunoFake[] = [
  {
    tokenAcesso: "demo-joao-pereira",
    nome: "João Pereira",
    telefone: "11944443333",
    comConsentimento: true,
    treino: {
      nome: "Treino A/B — hipertrofia",
      descricao: "A: agachamento 4x10, leg press 3x12, cadeira extensora 3x15. B: supino 4x10, remada 4x10, puxada 3x12.",
      diasPorSemana: 4,
    },
    registros: [
      {
        clienteRegistroId: "demo-seed-joao-treino-hoje",
        origem: "TEXTO",
        entradaBruta: "Treino A completo — agachamento, leg press e cadeira extensora",
        realizadoEm: horasAtras(3),
      },
      {
        clienteRegistroId: "demo-seed-joao-treino-anteontem",
        origem: "AUDIO",
        entradaBruta: "Treino B completo, aumentei a carga do supino",
        realizadoEm: diasAtras(2, 2),
      },
    ],
  },
  {
    tokenAcesso: "demo-patricia-gomes",
    nome: "Patrícia Gomes",
    telefone: "11933332222",
    comConsentimento: true,
    treino: {
      nome: "Treino full body",
      descricao: "Agachamento, supino, remada, elevação lateral, prancha — 3x por semana.",
      diasPorSemana: 3,
    },
    registros: [
      {
        clienteRegistroId: "demo-seed-patricia-treino-semana-passada",
        origem: "TEXTO",
        entradaBruta: "Consegui fazer só metade do treino, tava sem tempo",
        realizadoEm: diasAtras(6, 0),
      },
    ],
  },
  {
    tokenAcesso: "demo-lucas-martins",
    nome: "Lucas Martins",
    telefone: "11922221111",
    comConsentimento: false,
    treino: {
      nome: "Treino iniciante",
      descricao: "Adaptação: agachamento livre, flexão, remada com elástico — 2x por semana.",
      diasPorSemana: 2,
    },
    registros: [],
  },
];

/**
 * Alunos + treino prescrito + registros fake pra popular o painel do
 * personal trainer demo — mesmo espírito do seedPacientesFake: um aluno
 * com boa frequência, um abaixo da meta semanal, um sem consentimento
 * ainda.
 */
async function seedAlunosFake(profissionalId: string, personalTrainerId: string) {
  for (const alunoFake of ALUNOS_FAKE) {
    const aluno = await prismaNutri.aluno.upsert({
      where: { tokenAcesso: alunoFake.tokenAcesso },
      update: {
        // Ver nota em seedPacientesFake sobre reapontar o dono.
        profissionalId,
        consentimentoEm: alunoFake.comConsentimento ? new Date() : null,
      },
      create: {
        profissionalId,
        personalTrainerId,
        nome: alunoFake.nome,
        telefone: alunoFake.telefone,
        tokenAcesso: alunoFake.tokenAcesso,
        consentimentoEm: alunoFake.comConsentimento ? new Date() : null,
      },
    });

    if (alunoFake.treino) {
      const treinoExistente = await prismaNutri.treino.findFirst({ where: { alunoId: aluno.id, ativo: true } });
      if (!treinoExistente) {
        await prismaNutri.treino.create({
          data: {
            alunoId: aluno.id,
            nome: alunoFake.treino.nome,
            descricao: alunoFake.treino.descricao,
            diasPorSemana: alunoFake.treino.diasPorSemana,
          },
        });
      }
    }

    for (const registro of alunoFake.registros) {
      await prismaNutri.registroTreino.upsert({
        where: { clienteRegistroId: registro.clienteRegistroId },
        update: {},
        create: {
          alunoId: aluno.id,
          clienteRegistroId: registro.clienteRegistroId,
          origem: registro.origem,
          entradaBruta: registro.entradaBruta,
          realizadoEm: registro.realizadoEm,
        },
      });
    }
  }
}

// Um profissional demo híbrido é dono tanto dos pacientes quanto dos alunos
// — assim o painel unificado aparece no seu caso mais completo. Sequencial
// porque pacientes e alunos dependem dos ids criados antes.
async function semear() {
  const demo = await seedProfissionalDemo();
  const legados = await seedDonosLegados();

  // Os exemplos vão pro demo, ou pra uma conta real se DONO_DEMO_EMAIL
  // apontar pra uma. Como os upserts abaixo também atualizam o dono, mudar
  // a variável reaponta os exemplos no deploy seguinte — inclusive de volta
  // pro demo, se ela for removida.
  const dono = await obterDonoDosExemplos(demo);

  await seedPacientesFake(dono.id, legados.nutricionistaId);
  await seedAlunosFake(dono.id, legados.personalTrainerId);

  console.log(
    `${PACIENTES_FAKE.length} pacientes e ${ALUNOS_FAKE.length} alunos fake semeados no Turso, atribuídos a "${dono.nome}".`,
  );
}

semear()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prismaNutri.$disconnect();
  });
