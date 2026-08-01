import { z } from "zod";

// SQLite/Turso não tem enum nativo — estas constantes fazem o papel dos
// enums que o Prisma geraria em outro provider.
export const StatusCliente = {
  ATIVO: "ATIVO",
  ARQUIVADO: "ARQUIVADO",
} as const;
export type StatusCliente = (typeof StatusCliente)[keyof typeof StatusCliente];

/** O que um profissional acompanha num cliente. */
export const TipoVinculo = {
  NUTRICAO: "NUTRICAO",
  TREINO: "TREINO",
} as const;
export type TipoVinculo = (typeof TipoVinculo)[keyof typeof TipoVinculo];

export const StatusVinculo = {
  /** Profissional pediu, o cliente ainda não aceitou (Fase 3). */
  PENDENTE: "PENDENTE",
  ATIVO: "ATIVO",
  /** Encerrado pelo cliente ou pelo profissional — nunca exclusão física. */
  ENCERRADO: "ENCERRADO",
} as const;
export type StatusVinculo = (typeof StatusVinculo)[keyof typeof StatusVinculo];

export const OrigemRegistro = {
  AUDIO: "AUDIO",
  TEXTO: "TEXTO",
} as const;
export type OrigemRegistro = (typeof OrigemRegistro)[keyof typeof OrigemRegistro];

export const Sexo = { F: "F", M: "M", OUTRO: "OUTRO" } as const;
export const Experiencia = {
  INICIANTE: "INICIANTE",
  INTERMEDIARIO: "INTERMEDIARIO",
  AVANCADO: "AVANCADO",
} as const;
export const ConsumoAlcool = { NUNCA: "NUNCA", SOCIAL: "SOCIAL", FREQUENTE: "FREQUENTE" } as const;

/**
 * Campo de formulário que pode chegar vazio. Vira `undefined` em vez de ""
 * — dado ausente fica ausente, não vira string vazia no banco.
 */
const textoOpcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

const numeroOpcional = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => (v === undefined || v === "" ? undefined : Number(v)))
  .refine((v) => v === undefined || Number.isFinite(v), { message: "número inválido" });

/** Anamnese comum aos dois nichos — mora no próprio Cliente. */
export const anamneseComumSchema = z.object({
  // Data de nascimento, nunca idade: idade calculada na hora de exibir.
  dataNascimento: textoOpcional,
  sexo: z.nativeEnum(Sexo).optional(),
  alturaCm: numeroOpcional,
  objetivo: textoOpcional,
});

export const anamneseNutricionalSchema = z.object({
  jaSeguiuDieta: z.coerce.boolean().optional(),
  restricoesAlimentares: textoOpcional,
  usaSuplemento: z.coerce.boolean().optional(),
  refeicoesPorDia: numeroOpcional,
  consumoAlcool: z.nativeEnum(ConsumoAlcool).optional(),
  observacoes: textoOpcional,
});

export const anamneseTreinoSchema = z.object({
  experiencia: z.nativeEnum(Experiencia).optional(),
  lesoesLimitacoes: textoOpcional,
  frequenciaAtual: numeroOpcional,
  praticaOutroEsporte: textoOpcional,
  observacoes: textoOpcional,
});

export const metasSchema = z.object({
  metaKcal: z.coerce.number().int().positive("kcal deve ser positivo"),
  metaProteina: z.coerce.number().int().nonnegative("proteína não pode ser negativa"),
  metaCarbo: z.coerce.number().int().nonnegative("carboidrato não pode ser negativo"),
  metaGordura: z.coerce.number().int().nonnegative("gordura não pode ser negativa"),
});

export const treinoSchema = z.object({
  nome: z.string().trim().min(1, "informe o nome do treino"),
  descricao: z.string().trim().min(1, "descreva os exercícios prescritos"),
  diasPorSemana: z.coerce.number().int().min(1, "mínimo 1 dia por semana").max(7, "máximo 7 dias por semana"),
});

/**
 * Cadastro de cliente. O profissional escolhe o que vai acompanhar; as
 * metas e o treino só são exigidos do lado escolhido — não faz sentido
 * pedir meta de kcal a quem só vai prescrever treino.
 */
export const criarClienteSchema = z
  .object({
    nome: z.string().trim().min(1, "informe o nome"),
    telefone: textoOpcional,
    acompanhaNutricao: z.coerce.boolean(),
    acompanhaTreino: z.coerce.boolean(),
    metas: metasSchema.optional(),
    treino: treinoSchema.optional(),
    anamneseNutricional: anamneseNutricionalSchema.optional(),
    anamneseTreino: anamneseTreinoSchema.optional(),
  })
  .merge(anamneseComumSchema)
  .refine((d) => d.acompanhaNutricao || d.acompanhaTreino, {
    message: "escolha ao menos o que você vai acompanhar: nutrição ou treino",
    path: ["acompanhaNutricao"],
  })
  .refine((d) => !d.acompanhaNutricao || d.metas !== undefined, {
    message: "informe as metas para acompanhar a nutrição",
    path: ["metas"],
  })
  .refine((d) => !d.acompanhaTreino || d.treino !== undefined, {
    message: "informe o treino para acompanhar o treino",
    path: ["treino"],
  });

export type CriarClienteInput = z.infer<typeof criarClienteSchema>;

export const clienteIdSchema = z.object({ clienteId: z.string().min(1) });

export const atualizarMetasSchema = clienteIdSchema.merge(metasSchema);
export const atualizarTreinoSchema = clienteIdSchema.merge(treinoSchema);

export const anotacaoSchema = clienteIdSchema.extend({
  texto: z.string().trim().min(1, "escreva alguma coisa"),
});

export const tokenSchema = z.object({ token: z.string().min(1) });

export const registrarPesoSchema = tokenSchema.extend({
  pesoKg: z.coerce.number().positive("peso deve ser positivo").max(500, "peso fora do intervalo plausível"),
});

/**
 * Um copo d'água. `ml` é opcional: o botão de 1 toque manda sem valor e a
 * ação usa o copo padrão; o teto evita erro grosseiro de digitação se algum
 * dia houver campo livre.
 */
export const registrarAguaSchema = tokenSchema.extend({
  ml: z.coerce.number().int().positive("volume deve ser positivo").max(5000, "volume fora do plausível").optional(),
});

/** Cliente ajustando a própria meta diária de água. */
export const definirMetaAguaSchema = tokenSchema.extend({
  metaMl: z.coerce
    .number()
    .int()
    .min(250, "meta mínima de 250 ml")
    .max(10000, "meta fora do plausível"),
});

export const registrarSchema = tokenSchema.extend({
  clientLogId: z.string().uuid("clientLogId deve ser um UUID"),
  rawText: z.string().trim().min(1, "descreva o que aconteceu"),
  origem: z.nativeEnum(OrigemRegistro).default(OrigemRegistro.TEXTO),
});

export const favoritoSchema = tokenSchema.extend({
  descricao: z.string().trim().min(1, "descreva a refeição"),
});

export const removerFavoritoSchema = tokenSchema.extend({
  favoritoId: z.string().min(1),
});

/** Remover um registro do próprio cliente (refeição ou sessão de treino). */
export const removerRegistroSchema = tokenSchema.extend({
  registroId: z.string().min(1),
});

/**
 * Ajuste manual dos macros de uma refeição — quando a IA estimou perto mas
 * não exato, ou quando a pessoa prefere digitar o valor da embalagem. Inteiros
 * não-negativos; um teto plausível evita erro grosseiro de digitação.
 */
export const ajustarMacrosSchema = tokenSchema.extend({
  registroId: z.string().min(1),
  kcal: z.coerce.number().int().nonnegative("kcal não pode ser negativo").max(20000, "kcal fora do plausível"),
  proteina: z.coerce.number().int().nonnegative("proteína não pode ser negativa").max(2000, "valor fora do plausível"),
  carbo: z.coerce.number().int().nonnegative("carboidrato não pode ser negativo").max(2000, "valor fora do plausível"),
  gordura: z.coerce.number().int().nonnegative("gordura não pode ser negativa").max(2000, "valor fora do plausível"),
});

/** Mesmo alfabeto de gerarCodigoConvite — sem 0/O e 1/I. */
const ALFABETO_CONVITE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

/**
 * Profissional pedindo acompanhamento de um cliente que já existe. O
 * código chega digitado à mão, então normaliza antes de validar: espaço
 * sobrando e minúscula são erro de digitação, não código errado.
 */
export const solicitarVinculoSchema = z.object({
  codigoConvite: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase().replace(/[\s-]/g, ""))
    .refine((v) => ALFABETO_CONVITE.test(v), { message: "o código tem 6 letras e números" }),
  tipo: z.nativeEnum(TipoVinculo),
});

/** Cliente respondendo sobre um vínculo seu — aceitar, recusar ou encerrar. */
export const vinculoDoClienteSchema = tokenSchema.extend({
  vinculoId: z.string().min(1),
});
