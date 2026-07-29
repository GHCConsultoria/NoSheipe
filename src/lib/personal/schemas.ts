import { z } from "zod";

// Mesmo motivo de src/lib/nutri/schemas.ts: SQLite/Turso não tem enum
// nativo, então status/origem são String no banco.
export const StatusAluno = {
  ATIVO: "ATIVO",
  ARQUIVADO: "ARQUIVADO",
} as const;
export type StatusAluno = (typeof StatusAluno)[keyof typeof StatusAluno];

export const OrigemRegistroTreino = {
  AUDIO: "AUDIO",
  TEXTO: "TEXTO",
} as const;
export type OrigemRegistroTreino = (typeof OrigemRegistroTreino)[keyof typeof OrigemRegistroTreino];

export const criarAlunoSchema = z.object({
  nome: z.string().trim().min(1, "informe o nome"),
  telefone: z.string().trim().optional(),
});
export type CriarAlunoInput = z.infer<typeof criarAlunoSchema>;

export const treinoSchema = z.object({
  alunoId: z.string().min(1),
  nome: z.string().trim().min(1, "informe o nome do treino"),
  descricao: z.string().trim().min(1, "descreva os exercícios prescritos"),
  diasPorSemana: z.coerce.number().int().min(1, "mínimo 1 dia por semana").max(7, "máximo 7 dias por semana"),
});
export type TreinoInput = z.infer<typeof treinoSchema>;

export const alunoIdSchema = z.object({
  alunoId: z.string().min(1),
});
