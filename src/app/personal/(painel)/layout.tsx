import { redirect } from "next/navigation";
import {
  obterPersonalTrainerAtual,
  PersonalTrainerNaoAutenticadoError,
  PersonalTrainerNaoCadastradoError,
} from "@/lib/personal/auth";

export const dynamic = "force-dynamic";

/**
 * Guarda de acesso da área do personal trainer — mesmo padrão de
 * src/app/nutri/(painel)/layout.tsx: o middleware.ts já cuida do caso "sem
 * sessão Supabase"; este layout cobre "com sessão, mas sem PersonalTrainer
 * correspondente".
 */
export default async function PersonalPainelLayout({ children }: { children: React.ReactNode }) {
  try {
    await obterPersonalTrainerAtual();
  } catch (erro) {
    if (erro instanceof PersonalTrainerNaoAutenticadoError || erro instanceof PersonalTrainerNaoCadastradoError) {
      redirect("/personal/login");
    }
    throw erro;
  }

  return <>{children}</>;
}
