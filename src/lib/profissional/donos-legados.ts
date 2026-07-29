import { prismaNutri } from "@/lib/nutri/prisma";

/**
 * Andaime temporário da Fase 1 — sai na Fase 2.
 *
 * `Paciente.nutricionistaId` e `Aluno.personalTrainerId` ainda são NOT NULL
 * (o SQLite não deixa afrouxar isso sem reconstruir a tabela, e não vale o
 * risco por uma coluna que a Fase 2 elimina junto com os próprios models
 * Paciente/Aluno). Então todo registro novo precisa apontar pra *alguma*
 * linha dessas tabelas antigas.
 *
 * A saída é uma linha-placeholder única e compartilhada: o dono de verdade
 * é sempre `profissionalId`, e estas colunas viram só um resto sem
 * significado até serem removidas.
 */

const PLACEHOLDER_NUTRICIONISTA = "legado-placeholder-nutricionista";
const PLACEHOLDER_PERSONAL = "legado-placeholder-personal";

export async function obterDonoLegadoNutricao(): Promise<string> {
  const linha = await prismaNutri.nutricionista.upsert({
    where: { authUserId: PLACEHOLDER_NUTRICIONISTA },
    update: {},
    create: {
      authUserId: PLACEHOLDER_NUTRICIONISTA,
      nome: "(placeholder legado)",
      email: "legado.nutricionista@nosheipe.invalid",
    },
  });
  return linha.id;
}

export async function obterDonoLegadoTreino(): Promise<string> {
  const linha = await prismaNutri.personalTrainer.upsert({
    where: { authUserId: PLACEHOLDER_PERSONAL },
    update: {},
    create: {
      authUserId: PLACEHOLDER_PERSONAL,
      nome: "(placeholder legado)",
      email: "legado.personal@nosheipe.invalid",
    },
  });
  return linha.id;
}
