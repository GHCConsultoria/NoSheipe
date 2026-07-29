"use server";

import { redirect } from "next/navigation";
import { prismaNutri } from "@/lib/nutri/prisma";
import { criarClienteSupabaseServidor } from "@/lib/supabase/server";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/admin";
import { cadastroProfissionalSchema, entrarSchema } from "@/lib/profissional/schemas";
import { ehEmailJaRegistrado } from "@/lib/profissional/erros-auth";

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
 * Adota um usuário que existe no Supabase Auth mas não tem `Profissional`
 * no banco. Devolve o authUserId, ou null quando não é caso de adoção.
 *
 * Esse estado meio-caminho acontece de dois jeitos: contas criadas antes
 * da Fase 1, quando o cadastro gravava um `Nutricionista` e a tabela
 * `profissionais` nem existia; e cadastros que falharam entre criar o
 * usuário no Auth e gravar a linha. Nos dois, a pessoa ficava sem saída
 * pela tela — o cadastro recusava com "e-mail já registrado" e o login
 * autenticava mas caía fora, porque o layout não acha o Profissional.
 *
 * A senha é conferida antes de adotar. Sem isso, qualquer um completaria
 * o cadastro de um e-mail alheio e entraria na conta.
 */
async function adotarContaSemProfissional(email: string, senha: string): Promise<string | null> {
  // Se já existe Profissional com esse e-mail, é duplicata de verdade:
  // o caminho é entrar, não cadastrar de novo.
  const jaExiste = await prismaNutri.profissional.findUnique({ where: { email } });
  if (jaExiste) return null;

  const supabase = await criarClienteSupabaseServidor();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error || !data.user) return null;

  return data.user.id;
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

  // Só dá pra apagar o usuário no rollback se fomos nós que o criamos
  // agora. Numa conta adotada, apagar seria destruir o login de alguém.
  const criadoAgora = Boolean(data?.user);
  const authUserId = data?.user?.id ?? (await adotarContaSemProfissional(parsed.data.email, parsed.data.senha));

  if (!authUserId) {
    // Chegar aqui com "e-mail já registrado" significa que a adoção não
    // rolou: ou já existe Profissional (então é entrar, não cadastrar), ou
    // a senha digitada não é a da conta. Qualquer outro erro do Auth —
    // senha fraca, e-mail inválido — vai literal, que é mais útil.
    return {
      erro: ehEmailJaRegistrado(error?.message)
        ? "esse e-mail já tem conta. Entre com a sua senha — se não lembrar, use a recuperação de senha."
        : (error?.message ?? "falha ao criar usuário no Supabase Auth"),
    };
  }

  try {
    await prismaNutri.profissional.create({
      data: {
        authUserId,
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
    // Profissional correspondente — exatamente o estado que
    // adotarContaSemProfissional existe pra resgatar. Melhor não criar.
    if (criadoAgora) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(() => {});
    }
    return { erro: "não deu pra concluir o cadastro — confira os dados e tente de novo" };
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
