import { prismaNutri } from "@/lib/nutri/prisma";
import type { Profissional } from "../../../prisma/nutri/generated";
import { criarClienteSupabaseServidor } from "@/lib/supabase/server";
import { Capacidade, temCapacidade } from "@/lib/profissional/schemas";

const SUPABASE_CONFIGURADO = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export class ProfissionalNaoAutenticadoError extends Error {}
export class ProfissionalNaoCadastradoError extends Error {}
/** Autenticado e cadastrado, mas sem a capacidade exigida pela rota. */
export class ProfissionalSemCapacidadeError extends Error {}

/**
 * Resolve o Profissional da requisição atual — substitui
 * obterNutricionistaAtual e obterPersonalTrainerAtual, que eram idênticos
 * exceto pela tabela consultada.
 *
 * Com Supabase configurado, lê a sessão real (o middleware.ts já redireciona
 * pra /app/login antes de qualquer Server Component chegar aqui sem sessão);
 * sem Supabase configurado, cai no profissional demo semeado, pra o painel
 * continuar navegável localmente.
 */
export async function obterProfissionalAtual(): Promise<Profissional> {
  if (!SUPABASE_CONFIGURADO) {
    const demo = await prismaNutri.profissional.findUnique({
      where: { authUserId: "demo-profissional-auth-id" },
    });
    if (!demo) {
      throw new Error("profissional demo nao encontrado — rode 'npx prisma db seed' antes de usar o painel");
    }
    return demo;
  }

  const supabase = await criarClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ProfissionalNaoAutenticadoError("sem sessao Supabase ativa");
  }

  const profissional = await prismaNutri.profissional.findUnique({ where: { authUserId: user.id } });
  if (!profissional) {
    throw new ProfissionalNaoCadastradoError(
      `usuario Supabase ${user.email ?? user.id} autenticado, mas sem Profissional correspondente no banco`,
    );
  }

  return profissional;
}

/**
 * Igual a obterProfissionalAtual, mas exige uma capacidade específica —
 * usar em rotas que só fazem sentido pra um dos dois lados (ex.: prescrever
 * treino exige TREINO). Sem isto, um nutricionista conseguiria abrir a
 * prescrição de treino só sabendo a URL.
 */
export async function exigirCapacidade(capacidade: Capacidade): Promise<Profissional> {
  const profissional = await obterProfissionalAtual();
  if (!temCapacidade(profissional, capacidade)) {
    throw new ProfissionalSemCapacidadeError(
      `profissional ${profissional.id} nao tem a capacidade ${capacidade}`,
    );
  }
  return profissional;
}

/** True quando o erro deve levar o visitante de volta pro login. */
export function ehErroDeAutenticacao(erro: unknown): boolean {
  return erro instanceof ProfissionalNaoAutenticadoError || erro instanceof ProfissionalNaoCadastradoError;
}

export { Capacidade };
