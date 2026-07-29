import { z } from "zod";

// As duas coisas que um profissional pode fazer. Um cadastro precisa de
// pelo menos uma; pode ter as duas.
export const Capacidade = {
  NUTRICAO: "NUTRICAO",
  TREINO: "TREINO",
} as const;
export type Capacidade = (typeof Capacidade)[keyof typeof Capacidade];

/**
 * Cadastro do profissional. O `refine` é onde mora a regra que o SQLite não
 * consegue expressar como constraint: sem nenhuma capacidade, a conta não
 * conseguiria fazer nada no app.
 */
export const cadastroProfissionalSchema = z
  .object({
    nome: z.string().trim().min(1, "informe o nome"),
    email: z.string().trim().email("e-mail inválido"),
    senha: z.string().min(6, "a senha deve ter pelo menos 6 caracteres"),
    ehNutricionista: z.coerce.boolean(),
    ehPersonal: z.coerce.boolean(),
    crn: z.string().trim().optional(),
    cref: z.string().trim().optional(),
  })
  .refine((dados) => dados.ehNutricionista || dados.ehPersonal, {
    message: "escolha pelo menos uma atuação: nutricionista ou personal trainer",
    path: ["ehNutricionista"],
  });

export type CadastroProfissionalInput = z.infer<typeof cadastroProfissionalSchema>;

export const entrarSchema = z.object({
  email: z.string().email("informe um e-mail válido"),
  senha: z.string().min(6, "a senha deve ter pelo menos 6 caracteres"),
});

/** Capacidades de um profissional, no formato que a UI consome. */
export interface CapacidadesDoProfissional {
  ehNutricionista: boolean;
  ehPersonal: boolean;
}

export function temCapacidade(profissional: CapacidadesDoProfissional, capacidade: Capacidade): boolean {
  return capacidade === Capacidade.NUTRICAO ? profissional.ehNutricionista : profissional.ehPersonal;
}
