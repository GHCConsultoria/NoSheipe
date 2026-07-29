"use server";

import { redirect } from "next/navigation";
import { prismaNutri } from "@/lib/nutri/prisma";
import { criarClienteSupabaseServidor } from "@/lib/supabase/server";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/admin";
import { cadastroProfissionalSchema, entrarSchema } from "@/lib/profissional/schemas";

export interface EstadoLoginProfissional {
  erro?: string;
}

function supabaseConfigurado(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Login por e-mail/senha do profissional via Supabase Auth. */
export async function entrarProfissional(
  _estadoAnterior: EstadoLoginProfissional,
  formData: FormData,
): Promise<EstadoLoginProfissional> {
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

  redirect("/pro");
}

/**
 * Cadastro self-service do profissional. Diferente das duas telas que este
 * substitui, aqui o cadastro pergunta **o que a pessoa faz** — as
 * capacidades é que decidem o que ela consegue prescrever e o que aparece
 * no painel. Pelo menos uma é obrigatória (validado no schema Zod).
 */
export async function cadastrarProfissional(
  _estadoAnterior: EstadoLoginProfissional,
  formData: FormData,
): Promise<EstadoLoginProfissional> {
  const parsed = cadastroProfissionalSchema.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    senha: formData.get("senha"),
    // Checkbox não marcado nem aparece no FormData — daí a comparação com
    // "on" em vez de confiar na presença da chave.
    ehNutricionista: formData.get("ehNutricionista") === "on",
    ehPersonal: formData.get("ehPersonal") === "on",
    crn: formData.get("crn") || undefined,
    cref: formData.get("cref") || undefined,
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
    await prismaNutri.profissional.create({
      data: {
        authUserId: data.user.id,
        nome: parsed.data.nome,
        email: parsed.data.email,
        ehNutricionista: parsed.data.ehNutricionista,
        ehPersonal: parsed.data.ehPersonal,
        // Guarda o registro só do lado que a pessoa marcou — CRN de quem
        // não é nutricionista seria dado sem sentido.
        crn: parsed.data.ehNutricionista ? parsed.data.crn || null : null,
        cref: parsed.data.ehPersonal ? parsed.data.cref || null : null,
      },
    });
  } catch {
    // Sem isto, uma falha aqui deixaria um usuário Auth órfão, sem
    // Profissional correspondente — nunca conseguiria logar e ninguém
    // saberia por quê.
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

  redirect("/pro");
}

export async function sairProfissional(): Promise<void> {
  const supabase = await criarClienteSupabaseServidor();
  await supabase.auth.signOut();
  redirect("/pro/login");
}
