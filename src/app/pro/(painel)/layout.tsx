import { redirect } from "next/navigation";
import { obterProfissionalAtual, ehErroDeAutenticacao } from "@/lib/profissional/auth";

export const dynamic = "force-dynamic";

/**
 * Guarda de acesso da área do profissional: o middleware.ts já cuida do
 * caso "sem sessão Supabase" (redireciona pra /pro/login antes de chegar
 * aqui); este layout cobre o caso "com sessão Supabase, mas sem linha
 * Profissional correspondente".
 */
export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  try {
    await obterProfissionalAtual();
  } catch (erro) {
    if (ehErroDeAutenticacao(erro)) {
      redirect("/pro/login");
    }
    throw erro;
  }

  return <>{children}</>;
}
