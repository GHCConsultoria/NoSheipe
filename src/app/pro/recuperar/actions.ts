"use server";

import { headers } from "next/headers";
import { criarClienteSupabaseServidor } from "@/lib/supabase/server";
import {
  emailRecuperacaoSchema,
  montarUrlDeRetorno,
  resolverOrigem,
} from "@/lib/profissional/recuperacao";

export interface EstadoRecuperacao {
  erro?: string;
  enviado?: boolean;
}

function supabaseConfigurado(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Dispara o e-mail de recuperação de senha do profissional.
 *
 * A resposta é sempre a mesma, exista a conta ou não: dizer "esse e-mail não
 * tem conta" entregaria a um estranho quais e-mails estão cadastrados. O
 * próprio Supabase já responde sem erro pra e-mail desconhecido; a mensagem
 * neutra aqui fecha o resto da brecha.
 */
export async function solicitarRecuperacao(
  _estadoAnterior: EstadoRecuperacao,
  formData: FormData,
): Promise<EstadoRecuperacao> {
  const parsed = emailRecuperacaoSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "e-mail inválido" };
  }

  if (!supabaseConfigurado()) {
    return { erro: "Supabase ainda não está configurado neste ambiente (ver .env.example)." };
  }

  const cabecalhos = await headers();
  const origem = resolverOrigem({
    origin: cabecalhos.get("origin"),
    host: cabecalhos.get("host"),
    proto: cabecalhos.get("x-forwarded-proto"),
  });
  if (!origem) {
    return { erro: "não deu pra montar o link de retorno — tente de novo" };
  }

  const supabase = await criarClienteSupabaseServidor();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: montarUrlDeRetorno(origem),
  });

  // Sucesso silencioso de propósito: não confirma nem nega que o e-mail
  // existe. Se existir, o link chega; se não, nada acontece — e a tela diz
  // a mesma coisa nos dois casos.
  return { enviado: true };
}
