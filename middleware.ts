import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ROTA_LOGIN_NUTRI = "/nutri/login";

/**
 * Renova a sessão do Supabase a cada navegação e redireciona para
 * /nutri/login quando não há usuário autenticado. /p/[token] (link do
 * paciente, sem senha) fica de fora do gate inteiramente — o token na
 * própria URL é a credencial.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (request.nextUrl.pathname.startsWith("/p/")) {
    return response;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Supabase ainda não configurado neste ambiente — deixa passar sem
    // checar sessão em vez de travar o app inteiro.
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesParaDefinir) {
        for (const { name, value } of cookiesParaDefinir) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesParaDefinir) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ehRotaDeLogin = request.nextUrl.pathname.startsWith(ROTA_LOGIN_NUTRI);
  if (!user && !ehRotaDeLogin) {
    const destino = request.nextUrl.clone();
    destino.pathname = ROTA_LOGIN_NUTRI;
    return NextResponse.redirect(destino);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
