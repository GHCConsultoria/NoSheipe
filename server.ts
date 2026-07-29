import { redirect } from "next/navigation";
import { obterNutricionistaAtual, NutricionistaNaoAutenticadoError, NutricionistaNaoCadastradoError } from "@/lib/nutri/auth";

export const dynamic = "force-dynamic";

/**
 * Guarda de acesso da área do nutricionista: o middleware.ts já cuida do
 * caso "sem sessão Supabase" (redireciona pra /nutri/login antes de chegar
 * aqui); este layout cobre o caso "com sessão Supabase, mas sem linha
 * Nutricionista correspondente" — ex.: um Usuario do sistema jurídico
 * navegando pra /nutri por engano.
 */
export default async function NutriLayout({ children }: { children: React.ReactNode }) {
  try {
    await obterNutricionistaAtual();
  } catch (erro) {
    if (erro instanceof NutricionistaNaoAutenticadoError || erro instanceof NutricionistaNaoCadastradoError) {
      redirect("/nutri/login");
    }
    throw erro;
  }

  return <>{children}</>;
}
