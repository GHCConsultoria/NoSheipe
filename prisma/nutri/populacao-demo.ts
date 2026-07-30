import type { PrismaClient } from "./generated";

/**
 * População de placeholder pro painel administrativo.
 *
 * Separada do CLIENTES_FAKE de seed.ts de propósito: aqueles quatro são
 * escritos à mão pra cobrir os casos exatos da tela do cliente (os dois
 * acompanhamentos, um de cada, sem consentimento) e ficam com a conta do
 * dono. Estes aqui existem só pra o /master abrir com volume em vez de
 * quatro linhas, e se espalham por vários profissionais.
 *
 * Tudo é determinístico. Com Math.random, cada deploy geraria números
 * diferentes e as métricas de 7/30 dias mudariam sozinhas — o painel
 * pareceria vivo quando na verdade era só ruído do seed.
 */

/** PRNG determinístico (mulberry32). Mesma semente, mesma população. */
function gerador(semente: number) {
  let estado = semente;
  return () => {
    estado |= 0;
    estado = (estado + 0x6d2b79f5) | 0;
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PROFISSIONAIS = [
  { nome: "Ana Ribeiro", tipo: "NUTRI" as const },
  { nome: "Bruno Sato", tipo: "PERSONAL" as const },
  { nome: "Carla Nunes", tipo: "AMBOS" as const },
  { nome: "Diego Farias", tipo: "PERSONAL" as const },
  { nome: "Elisa Prado", tipo: "NUTRI" as const },
];

const NOMES = [
  "Amanda Rocha", "Bruno Teixeira", "Camila Duarte", "Diego Antunes", "Elaine Moraes",
  "Felipe Barros", "Giovana Lopes", "Henrique Sales", "Isabela Cruz", "Jonas Vieira",
  "Karina Mendes", "Leandro Pires", "Mariana Castro", "Nelson Aguiar", "Olívia Ramos",
  "Paulo Cardoso", "Renata Bastos", "Sérgio Lima",
];

const REFEICOES = [
  "ovos mexidos com pão integral e café",
  "salada de folhas com atum e azeite",
  "arroz, feijão, bife grelhado e brócolis",
  "iogurte com granola e banana",
  "macarrão ao sugo com frango desfiado",
  "sanduíche natural de peito de peru",
  "tapioca com queijo branco",
  "sopa de legumes com carne moída",
  "omelete de três ovos com espinafre",
  "wrap de frango com salada",
];

const TREINOS = [
  "Treino A — peito e tríceps",
  "Treino B — costas e bíceps",
  "Treino C — pernas completo",
  "Corrida 5 km",
  "Funcional 40 min",
];

const OBJETIVOS = ["emagrecer", "ganhar massa", "manter o peso", "melhorar condicionamento", "recomposição corporal"];

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Semeia a população. Idempotente por token: cliente que já existe é
 * pulado inteiro, sem regerar registros — senão cada deploy empilharia
 * mais refeições nas mesmas pessoas.
 */
export async function seedPopulacaoDemo(prisma: PrismaClient): Promise<{ profissionais: number; clientes: number }> {
  const aleatorio = gerador(20260730);
  const escolher = <T>(lista: T[]): T => lista[Math.floor(aleatorio() * lista.length)];
  const entre = (min: number, max: number) => min + Math.floor(aleatorio() * (max - min + 1));

  // Índice manual em vez de .entries(): o target de TS do projeto não
  // itera iteradores de array sem downlevelIteration.
  const idsProfissionais: { id: string; nutri: boolean; personal: boolean }[] = [];
  for (let i = 0; i < PROFISSIONAIS.length; i += 1) {
    const p = PROFISSIONAIS[i];
    const authUserId = `demo-pop-prof-${i}`;
    const nutri = p.tipo === "NUTRI" || p.tipo === "AMBOS";
    const personal = p.tipo === "PERSONAL" || p.tipo === "AMBOS";
    const criado = await prisma.profissional.upsert({
      where: { authUserId },
      update: {},
      create: {
        authUserId,
        nome: `${p.nome} (demo)`,
        email: `demo.pop.${i}@example.com`,
        ehNutricionista: nutri,
        ehPersonal: personal,
        crn: nutri ? `CRN-9${i}00` : null,
        cref: personal ? `CREF-9${i}00` : null,
      },
    });
    idsProfissionais.push({ id: criado.id, nutri, personal });
  }

  const nutris = idsProfissionais.filter((p) => p.nutri);
  const personais = idsProfissionais.filter((p) => p.personal);

  let novos = 0;
  for (let i = 0; i < NOMES.length; i += 1) {
    const nome = NOMES[i];
    const tokenAcesso = `demo-pop-${i}`;
    if (await prisma.cliente.findUnique({ where: { tokenAcesso } })) continue;

    // Distribuição proposital: a maioria com um acompanhamento só, uma
    // parte com os dois — que é o caso interessante no painel.
    const sorteio = aleatorio();
    const temNutricao = sorteio < 0.75;
    const temTreino = sorteio > 0.45;

    const nascimento = new Date(Date.UTC(entre(1975, 2005), entre(0, 11), entre(1, 28)));
    const cliente = await prisma.cliente.create({
      data: {
        nome: `${nome} (demo)`,
        tokenAcesso,
        codigoConvite: `DEMO${String(i).padStart(2, "0")}`,
        consentimentoEm: new Date(Date.now() - entre(10, 90) * DIA_MS),
        dataNascimento: nascimento,
        sexo: escolher(["F", "M", "OUTRO"]),
        alturaCm: entre(152, 195),
        objetivo: escolher(OBJETIVOS),
        criadoEm: new Date(Date.now() - entre(30, 120) * DIA_MS),
      },
    });
    novos += 1;

    if (temNutricao && nutris.length > 0) {
      const prof = escolher(nutris);
      await prisma.vinculo.create({
        data: {
          clienteId: cliente.id,
          profissionalId: prof.id,
          tipo: "NUTRICAO",
          status: "ATIVO",
          aceitoEm: new Date(),
        },
      });
      const metaKcal = entre(1500, 2800);
      await prisma.planoNutricional.create({
        data: {
          clienteId: cliente.id,
          metaKcal,
          metaProteina: Math.round((metaKcal * 0.3) / 4),
          metaCarbo: Math.round((metaKcal * 0.45) / 4),
          metaGordura: Math.round((metaKcal * 0.25) / 9),
        },
      });
      await prisma.anamneseNutricional.create({
        data: {
          clienteId: cliente.id,
          jaSeguiuDieta: aleatorio() > 0.5,
          usaSuplemento: aleatorio() > 0.6,
          refeicoesPorDia: entre(3, 6),
          consumoAlcool: escolher(["NUNCA", "SOCIAL", "FREQUENTE"]),
        },
      });

      // Registros espalhados nos últimos 30 dias, pra as métricas de 7 e
      // 30 dias do painel terem diferença de verdade entre si.
      const quantas = entre(8, 40);
      for (let r = 0; r < quantas; r += 1) {
        const diasAtras = Math.floor(aleatorio() * 30);
        const kcal = entre(250, 900);
        await prisma.refeicao.create({
          data: {
            clienteId: cliente.id,
            clienteRegistroId: `demo-pop-ref-${i}-${r}`,
            origem: aleatorio() > 0.6 ? "AUDIO" : "TEXTO",
            entradaBruta: escolher(REFEICOES),
            itens: "[]",
            kcal,
            proteina: Math.round((kcal * 0.3) / 4),
            carbo: Math.round((kcal * 0.45) / 4),
            gordura: Math.round((kcal * 0.25) / 9),
            confianca: 0.6 + aleatorio() * 0.35,
            registradoEm: new Date(Date.now() - diasAtras * DIA_MS - entre(0, 20) * 60 * 60 * 1000),
          },
        });
      }

      for (let m = 0; m < entre(3, 10); m += 1) {
        await prisma.medida.create({
          data: {
            clienteId: cliente.id,
            pesoKg: Math.round((entre(55, 105) + aleatorio()) * 10) / 10,
            registradoEm: new Date(Date.now() - (m * 7 + entre(0, 3)) * DIA_MS),
          },
        });
      }

      await prisma.anotacao.create({
        data: {
          clienteId: cliente.id,
          profissionalId: prof.id,
          texto: escolher([
            "Relatou fome no fim da tarde — ajustar lanche.",
            "Boa adesão nas duas primeiras semanas.",
            "Viagem a trabalho na semana que vem, plano flexível.",
            "Reclamou de enjoo com o suplemento.",
          ]),
        },
      });
    }

    if (temTreino && personais.length > 0) {
      const prof = escolher(personais);
      await prisma.vinculo.create({
        data: {
          clienteId: cliente.id,
          profissionalId: prof.id,
          tipo: "TREINO",
          status: "ATIVO",
          aceitoEm: new Date(),
        },
      });
      const diasPorSemana = entre(2, 5);
      await prisma.treinoPrescrito.create({
        data: {
          clienteId: cliente.id,
          nome: escolher(["Full body 3x", "ABC clássico", "Upper/Lower", "Push Pull Legs"]),
          descricao: "Agachamento, supino, remada, desenvolvimento, prancha.",
          diasPorSemana,
        },
      });
      await prisma.anamneseTreino.create({
        data: {
          clienteId: cliente.id,
          experiencia: escolher(["INICIANTE", "INTERMEDIARIO", "AVANCADO"]),
          frequenciaAtual: entre(0, 4),
        },
      });

      for (let s = 0; s < entre(5, 25); s += 1) {
        await prisma.sessaoTreino.create({
          data: {
            clienteId: cliente.id,
            clienteRegistroId: `demo-pop-ses-${i}-${s}`,
            origem: "TEXTO",
            entradaBruta: escolher(TREINOS),
            realizadoEm: new Date(Date.now() - Math.floor(aleatorio() * 30) * DIA_MS - entre(0, 20) * 60 * 60 * 1000),
          },
        });
      }

      await prisma.anotacao.create({
        data: {
          clienteId: cliente.id,
          profissionalId: prof.id,
          texto: escolher([
            "Evoluiu 5 kg no agachamento este mês.",
            "Queixa de dor no ombro direito — reduzir supino.",
            "Faltou duas semanas seguidas, retomar carga menor.",
            "Pediu pra incluir corrida no fim de semana.",
          ]),
        },
      });
    }
  }

  return { profissionais: idsProfissionais.length, clientes: novos };
}
