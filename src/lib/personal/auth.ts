import { prismaNutri } from "@/lib/nutri/prisma";
import type { PersonalTrainer } from "../../../prisma/nutri/generated";
import { criarClienteSupabaseServidor } from "@/lib/supabase/server";

const SUPABASE_CONFIGURADO = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export class PersonalTrainerNaoAutenticadoError extends Error {}
export class PersonalTrainerNaoCadastradoError extends Error {}

/**
 * Resolve o PersonalTrainer da requisição atual — mesmo padrão de
 * src/lib/nutri/auth.ts: com Supabase configurado, lê a sessão real
 * (o middleware.ts já deve ter redirecionado pra /personal/login antes de
 * qualquer Server Component chegar aqui sem sessão); sem Supabase
 * configurado, cai no personal trainer demo semeado.
 */
export async function obterPersonalTrainerAtual(): Promise<PersonalTrainer> {
  if (!SUPABASE_CONFIGURADO) {
    const demo = await prismaNutri.personalTrainer.findUnique({
      where: { authUserId: "demo-personal-trainer-auth-id" },
    });
    if (!demo) {
      throw new Error("personal trainer demo nao encontrado — rode 'npx prisma db seed' antes de usar o painel");
    }
    return demo;
  }

  const supabase = await criarClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new PersonalTrainerNaoAutenticadoError("sem sessao Supabase ativa");
  }

  const personalTrainer = await prismaNutri.personalTrainer.findUnique({ where: { authUserId: user.id } });
  if (!personalTrainer) {
    throw new PersonalTrainerNaoCadastradoError(
      `usuario Supabase ${user.email ?? user.id} autenticado, mas sem PersonalTrainer correspondente no banco`,
    );
  }

  return personalTrainer;
}
