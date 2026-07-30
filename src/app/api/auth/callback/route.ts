import { NextResponse, type NextRequest } from "next/server";
import { criarClienteSupabaseServidor } from "@/lib/supabase/server";
import { CAMINHO_REDEFINIR } from "@/lib/profissional/recuperacao";

/**
 * Onde o link do e-mail de recuperação cai. O Supabase manda pra cá com um
 * `?code=` (fluxo PKCE); aqui ele vira sessão, e a pessoa segue pra tela de
 * definir a senha nova já autenticada.
 *
 * Fica sob /api de propósito: o matcher do middleware pula /api, então esta
 * rota roda sem o gate de sessão — que é o que precisa ser, já que a sessão
 * só passa a existir depois da troca aqui dentro.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  // Só aceita destino relativo (começando com "/"): um `next` absoluto viraria
  // um redirecionamento aberto pra fora do app.
  const nextBruto = searchParams.get("next");
  const next = nextBruto && nextBruto.startsWith("/") ? nextBruto : CAMINHO_REDEFINIR;

  if (!code) {
    return NextResponse.redirect(new URL("/pro/recuperar?erro=link", origin));
  }

  const supabase = await criarClienteSupabaseServidor();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // Link expirado ou já usado — manda de volta pra pedir outro, com aviso.
    return NextResponse.redirect(new URL("/pro/recuperar?erro=expirado", origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}
