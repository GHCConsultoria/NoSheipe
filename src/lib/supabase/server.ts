import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Cliente Supabase para uso em Server Components/Actions/Route Handlers.
 * Lê a sessão dos cookies da requisição atual. As env vars
 * NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY precisam estar
 * configuradas (ver .env.example) — sem elas, isto lança na primeira
 * chamada, o que é intencional: melhor falhar alto do que fingir sessão.
 */
export async function criarClienteSupabaseServidor() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY nao configurados — veja .env.example",
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesParaDefinir) {
        try {
          for (const { name, value, options } of cookiesParaDefinir) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Chamado de um Server Component (sem permissão de escrever
          // cookie) — inofensivo enquanto o middleware.ts também renova a
          // sessão a cada requisição.
        }
      },
    },
  });
}
