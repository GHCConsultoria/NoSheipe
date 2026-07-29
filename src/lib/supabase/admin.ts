import { createClient } from "@supabase/supabase-js";

/**
 * Cliente admin do Supabase — usa a service_role key, que ignora RLS e tem
 * acesso total à API do projeto. Só pode ser usado em código que roda no
 * servidor (Server Actions, Route Handlers); nunca importar isto de um
 * Client Component, senão a chave vaza pro navegador. Hoje só serve pra
 * criar usuário via Auth Admin API (ver src/lib/usuarios/acoes.ts).
 */
export function criarClienteSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados — veja .env.example",
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
