import { prismaNutri } from "@/lib/nutri/prisma";
import type { Nutricionista } from "../../../prisma/nutri/generated";
import { criarClienteSupabaseServidor } from "@/lib/supabase/server";

const SUPABASE_CONFIGURADO = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export class NutricionistaNaoAutenticadoError extends Error {}
export class NutricionistaNaoCadastradoError extends Error {}

/**
 * Resolve o Nutricionista da requisição atual. Mesmo padrão de
 * src/lib/auth.ts: com Supabase configurado, lê a sessão real (o
 * middleware.ts já deve ter redirecionado pra /nutri/login antes de
 * qualquer Server Component chegar aqui sem sessão); sem Supabase
 * configurado, cai no nutricionista demo semeado, só pra o painel
 * continuar navegável localmente.
 */
export async function obterNutricionistaAtual(): Promise<Nutricionista> {
  if (!SUPABASE_CONFIGURADO) {
    const demo = await prismaNutri.nutricionista.findUnique({ where: { authUserId: "demo-nutricionista-auth-id" } });
    if (!demo) {
      throw new Error("nutricionista demo nao encontrado — rode 'npx prisma db seed' antes de usar o painel");
    }
    return demo;
  }

  const supabase = await criarClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new NutricionistaNaoAutenticadoError("sem sessao Supabase ativa");
  }

  const nutricionista = await prismaNutri.nutricionista.findUnique({ where: { authUserId: user.id } });
  if (!nutricionista) {
    throw new NutricionistaNaoCadastradoError(
      `usuario Supabase ${user.email ?? user.id} autenticado, mas sem Nutricionista correspondente no banco`,
    );
  }

  return nutricionista;
}
