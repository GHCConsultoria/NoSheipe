"use server";

import { redirect } from "next/navigation";
import { criarClienteSupabaseServidor } from "@/lib/supabase/server";
import { redefinirSenhaSchema } from "@/lib/profissional/recuperacao";

export interface EstadoRedefinir {
  erro?: string;
}

function supabaseConfigurado(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Grava a senha nova. Só funciona com a sessão de recuperação no ar — a que
 * o callback criou ao trocar o code do e-mail. Sem ela, o `updateUser`
 * recusa e a pessoa é mandada de volta a pedir outro link, em vez de trocar
 * a senha de uma conta que não provou ser dela.
 */
export async function redefinirSenha(
  _estadoAnterior: EstadoRedefinir,
  formData: FormData,
): Promise<EstadoRedefinir> {
  const parsed = redefinirSenhaSchema.safeParse({
    senha: formData.get("senha"),
    confirmacao: formData.get("confirmacao"),
  });
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "dados inválidos" };
  }

  if (!supabaseConfigurado()) {
    return { erro: "Supabase ainda não está configurado neste ambiente (ver .env.example)." };
  }

  const supabase = await criarClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { erro: "seu link de recuperação expirou. Peça um novo em “Recuperar senha”." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.senha });
  if (error) {
    return { erro: error.message || "não deu pra salvar a senha nova — tente de novo" };
  }

  redirect("/pro");
}
