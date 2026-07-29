"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prismaNutri } from "@/lib/nutri/prisma";
import { criarClienteSupabaseServidor } from "@/lib/supabase/server";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/admin";

export interface EstadoLoginNutri {
  erro?: string;
}

const entrarSchema = z.object({
  email: z.string().email("informe um e-mail válido"),
  senha: z.string().min(6, "a senha deve ter pelo menos 6 caracteres"),
});

function supabaseConfigurado(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Login por e-mail/senha do nutricionista via Supabase Auth. */
export async function entrarNutricionista(
  _estadoAnterior: EstadoLoginNutri,
  formData: FormData,
): Promise<EstadoLoginNutri> {
  const parsed = entrarSchema.safeParse({
    email: formData.get("email"),
    senha: formData.get("senha"),
  });
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "dados inválidos" };
  }

  if (!supabaseConfigurado()) {
    return { erro: "Supabase ainda não está configurado neste ambiente (ver .env.example)." };
  }

  const supabase = await criarClienteSupabaseServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.senha,
  });
  if (error) {
    return { erro: "e-mail ou senha incorretos" };
  }

  redirect("/nutri");
}

const cadastrarSchema = z.object({
  nome: z.string().trim().min(1, "informe o nome"),
  email: z.string().trim().email("e-mail inválido"),
  senha: z.string().min(6, "a senha deve ter pelo menos 6 caracteres"),
  crn: z.string().trim().optional(),
});

/**
 * Cadastro self-service do nutricionista: diferente do /login do sistema
 * jurídico (provisionado só por admin, de propósito), aqui o nutricionista É
 * o cliente direto — precisa conseguir criar a própria conta. Cria o
 * usuário no Supabase Auth (já confirmado, sem etapa de e-mail — atrito
 * desnecessário num demo de descoberta) + a linha Nutricionista
 * correspondente, depois já autentica a sessão no navegador.
 */
export async function cadastrarNutricionista(
  _estadoAnterior: EstadoLoginNutri,
  formData: FormData,
): Promise<EstadoLoginNutri> {
  const parsed = cadastrarSchema.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    senha: formData.get("senha"),
    crn: formData.get("crn") || undefined,
  });
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "dados inválidos" };
  }

  if (!supabaseConfigurado()) {
    return { erro: "Supabase ainda não está configurado neste ambiente (ver .env.example)." };
  }

  let supabaseAdmin: ReturnType<typeof criarClienteSupabaseAdmin>;
  try {
    supabaseAdmin = criarClienteSupabaseAdmin();
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Supabase admin não configurado" };
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.senha,
    email_confirm: true,
  });
  if (error || !data.user) {
    return { erro: error?.message ?? "falha ao criar usuário no Supabase Auth" };
  }

  try {
    await prismaNutri.nutricionista.create({
      data: {
        authUserId: data.user.id,
        nome: parsed.data.nome,
        email: parsed.data.email,
        crn: parsed.data.crn || null,
      },
    });
  } catch {
    // Sem isso, uma falha aqui deixaria um usuário Auth órfão, sem
    // Nutricionista correspondente — nunca conseguiria logar e ninguém
    // saberia por quê (mesmo cuidado de src/lib/usuarios/acoes.ts).
    await supabaseAdmin.auth.admin.deleteUser(data.user.id).catch(() => {});
    return { erro: "e-mail já cadastrado ou dados inválidos" };
  }

  const supabase = await criarClienteSupabaseServidor();
  const { error: erroLogin } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.senha,
  });
  if (erroLogin) {
    return { erro: "conta criada, mas falhou o login automático — tente entrar manualmente" };
  }

  redirect("/nutri");
}

export async function sairNutricionista(): Promise<void> {
  const supabase = await criarClienteSupabaseServidor();
  await supabase.auth.signOut();
  redirect("/nutri/login");
}
