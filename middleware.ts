import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Área do profissional. Antes eram duas (/nutri e /personal, cada uma com
// seu login); com o Profissional unificado é só uma.
const AREA_PROFISSIONAL = { prefixo: "/pro", login: "/pro/login" };

// /master usa o mesmo login: é um profissional com ehMaster no banco, não
// uma conta à parte. Aqui só se confere que existe sessão; quem confere a
// permissão em si é src/app/master/layout.tsx — o middleware roda no edge
// e não tem acesso ao banco.
const PREFIXOS_COM_SESSAO = [AREA_PROFISSIONAL.prefixo, "/master"];

/**
 * Renova a sessão do Supabase a cada navegação e redireciona para o login
 * quando não há usuário autenticado. Os links públicos (/p/[token] do
 * paciente e /t/[token] do aluno) ficam de fora do gate inteiramente — o
 * token na própria URL é a credencial.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (request.nextUrl.pathname.startsWith("/p/") || request.nextUrl.pathname.startsWith("/t/")) {
    return response;
  }

  if (!PREFIXOS_COM_SESSAO.some((prefixo) => request.nextUrl.pathname.startsWith(prefixo))) {
    return response;
  }
  const area = AREA_PROFISSIONAL;

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

  const ehRotaDeLogin = request.nextUrl.pathname.startsWith(area.login);
  if (!user && !ehRotaDeLogin) {
    const destino = request.nextUrl.clone();
    destino.pathname = area.login;
    return NextResponse.redirect(destino);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
