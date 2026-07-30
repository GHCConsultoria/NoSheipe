import { z } from "zod";

/**
 * Recuperação de senha do profissional (Supabase Auth).
 *
 * A parte pura mora aqui, fora dos arquivos "use server": schemas e o
 * cálculo da origem do link de retorno. Assim dá pra testar sem subir o
 * Next nem falar com o Supabase.
 */

/** Onde o link do e-mail volta a cair — a rota que troca o code por sessão. */
export const CAMINHO_CALLBACK = "/api/auth/callback";

/** Depois de trocar o code, é pra cá que o callback manda: definir a senha nova. */
export const CAMINHO_REDEFINIR = "/pro/redefinir";

export const emailRecuperacaoSchema = z.object({
  email: z.string().trim().email("informe um e-mail válido"),
});

/**
 * Senha nova + confirmação. A confirmação não é frescura: sem ela, um erro
 * de digitação vira uma senha que a pessoa não sabe qual é, e o único jeito
 * de descobrir seria... recuperar a senha de novo.
 */
export const redefinirSenhaSchema = z
  .object({
    senha: z.string().min(6, "a senha deve ter pelo menos 6 caracteres"),
    confirmacao: z.string().min(1, "confirme a senha"),
  })
  .refine((dados) => dados.senha === dados.confirmacao, {
    message: "as senhas não conferem",
    path: ["confirmacao"],
  });

/**
 * A origem absoluta da requisição, pra montar o `redirectTo` do e-mail —
 * que o Supabase exige absoluto e precisa bater com a allowlist do projeto.
 *
 * Prefere o header `Origin` (que o POST do formulário manda); cai pro
 * `Host` + protocolo quando ele falta. Devolve `null` quando não dá pra
 * saber, pra quem chama tratar em vez de montar uma URL torta.
 */
export function resolverOrigem(cabecalhos: {
  origin?: string | null;
  host?: string | null;
  proto?: string | null;
}): string | null {
  const origin = cabecalhos.origin?.trim();
  if (origin) return origin.replace(/\/+$/, "");

  const host = cabecalhos.host?.trim();
  if (host) {
    const proto = cabecalhos.proto?.trim() || "https";
    return `${proto}://${host}`;
  }

  return null;
}

/** URL absoluta pro callback, já com o destino final embutido no `next`. */
export function montarUrlDeRetorno(origem: string): string {
  return `${origem}${CAMINHO_CALLBACK}?next=${encodeURIComponent(CAMINHO_REDEFINIR)}`;
}
