/**
 * Interpretação das mensagens de erro do Supabase Auth (GoTrue).
 *
 * Mora fora de actions.ts porque aquele arquivo é "use server": lá todo
 * export precisa ser função assíncrona, o que impede testar isto direto.
 */

/**
 * O Auth recusou porque já existe usuário com esse e-mail.
 *
 * A mensagem vem do GoTrue e não tem código estável no SDK, então é
 * reconhecida pelo texto. As variações conhecidas:
 *
 *   "A user with this email address has already been registered"  (observada em produção)
 *   "User already registered"
 *   "user already exists"
 */
export function ehEmailJaRegistrado(mensagem: string | undefined | null): boolean {
  if (!mensagem) return false;
  return /already\b.*\bregistered|already\b.*\bexists/i.test(mensagem);
}
