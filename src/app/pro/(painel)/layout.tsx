import { redirect } from "next/navigation";
import { obterProfissionalAtual, ehErroDeAutenticacao } from "@/lib/profissional/auth";
import { NavProfissional } from "@/components/profissional/NavProfissional";

export const dynamic = "force-dynamic";

/**
 * Guarda de acesso da área do profissional: o middleware.ts já cuida do
 * caso "sem sessão Supabase" (redireciona pra /pro/login antes de chegar
 * aqui); este layout cobre o caso "com sessão Supabase, mas sem linha
 * Profissional correspondente".
 *
 * É também onde mora a barra de abas. Fica no layout do grupo (painel), e
 * não no de /pro, pra o login ficar de fora sozinho: lá não há pra onde
 * navegar.
 */
export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  try {
    await obterProfissionalAtual();
  } catch (erro) {
    if (ehErroDeAutenticacao(erro)) {
      redirect("/pro/login");
    }
    throw erro;
  }

  return (
    <>
      {/* No desktop a barra é estática no topo, então vem antes do
          conteúdo; no celular ela é fixa no rodapé e a ordem no DOM não
          muda nada visualmente — mas mantém a navegação primeiro pra quem
          usa teclado ou leitor de tela. */}
      <NavProfissional />
      {/* pb-24 reserva a altura da barra fixa no celular; no desktop ela
          não flutua sobre nada, então a reserva some. */}
      <div className="pb-24 sm:pb-0">{children}</div>
    </>
  );
}
