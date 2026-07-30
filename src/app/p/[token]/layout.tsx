import type { Metadata, Viewport } from "next";
import { buscarClientePorToken, buscarResumoDaNavegacao } from "@/lib/cliente/consultas";
import { NavRodape } from "@/components/cliente/NavRodape";

export const dynamic = "force-dynamic";

export const viewport: Viewport = { themeColor: "#16a34a" };

/**
 * Metadados do PWA no layout, e não na página inicial: com a navegação em
 * abas o cliente passa a viver em /historico e /perfil também, e sem isto
 * essas telas ficavam sem manifesto e sem theme-color — no app instalado a
 * barra de status trocava de cor ao mudar de aba.
 */
export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  return {
    title: "NoSheipe",
    manifest: `/p/${params.token}/manifest.json`,
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "NoSheipe" },
    icons: { icon: "/icons/nosheipe-192.png", apple: "/icons/nosheipe-180.png" },
  };
}

/**
 * Casca das telas do cliente: conteúdo mais a barra do rodapé.
 *
 * A barra some em dois casos, de propósito. Token inválido, porque não há
 * pra onde navegar; e antes do consentimento, porque a única coisa a
 * fazer naquela tela é aceitar ou sair — oferecer abas ali seria convidar
 * a contornar o consentimento.
 */
export default async function LayoutDoCliente({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { token: string };
}) {
  const cliente = await buscarClientePorToken(params.token);

  if (!cliente || !cliente.consentimentoEm) {
    return <>{children}</>;
  }

  const { pendentes, temNutricao } = await buscarResumoDaNavegacao(cliente.id);

  return (
    <>
      {/* pb-24 reserva a altura da barra fixa; sem isso ela cobre o fim da
          página, que é justo onde ficam os botões de registrar. */}
      <div className="entrada-aba pb-24">{children}</div>
      <NavRodape token={params.token} pendentes={pendentes} mostrarHistorico={temNutricao} />
    </>
  );
}
