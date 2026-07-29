import { z } from "zod";

// SQLite/Turso não tem enum nativo (ver prisma/nutri/schema.prisma), então os
// campos `status`/`origem` são String no banco. Estas constantes substituem
// os enums que o Prisma geraria num provider com suporte nativo.
export const StatusPaciente = {
  ATIVO: "ATIVO",
  ARQUIVADO: "ARQUIVADO",
} as const;
export type StatusPaciente = (typeof StatusPaciente)[keyof typeof StatusPaciente];

export const OrigemRegistro = {
  AUDIO: "AUDIO",
  TEXTO: "TEXTO",
} as const;
export type OrigemRegistro = (typeof OrigemRegistro)[keyof typeof OrigemRegistro];

export const metasSchema = z.object({
  metaKcal: z.coerce.number().int().positive("kcal deve ser positivo"),
  metaProteina: z.coerce.number().int().nonnegative("proteína não pode ser negativa"),
  metaCarbo: z.coerce.number().int().nonnegative("carboidrato não pode ser negativo"),
  metaGordura: z.coerce.number().int().nonnegative("gordura não pode ser negativa"),
});

export const criarPacienteSchema = z
  .object({
    nome: z.string().trim().min(1, "informe o nome"),
    telefone: z.string().trim().optional(),
  })
  .merge(metasSchema);

export type CriarPacienteInput = z.infer<typeof criarPacienteSchema>;

export const atualizarMetasSchema = z
  .object({
    pacienteId: z.string().min(1),
  })
  .merge(metasSchema);

export type AtualizarMetasInput = z.infer<typeof atualizarMetasSchema>;

export const pacienteIdSchema = z.object({
  pacienteId: z.string().min(1),
});
