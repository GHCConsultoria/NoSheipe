import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { buscarClientePorToken, buscarPainelDoCliente } from "@/lib/cliente/consultas";
import { ConsentimentoCliente } from "@/components/cliente/ConsentimentoCliente";
import { HomeDoCliente } from "@/components/cliente/HomeDoCliente";

export const dynamic = "force-dynamic";

export const viewport: Viewport = { themeColor: "#16a34a" };

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  return {
    title: "NoSheipe",
    manifest: `/p/${params.token}/manifest.json`,
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "NoSheipe" },
    icons: { icon: "/icons/nosheipe-192.png", apple: "/icons/nosheipe-180.png" },
  };
}

export default async function PaginaCliente({ params }: { params: { token: string } }) {
  const cliente = await buscarClientePorToken(params.token);
  if (!cliente) {
    notFound();
  }

  if (!cliente.consentimentoEm) {
    return <ConsentimentoCliente token={cliente.tokenAcesso} nome={cliente.nome} />;
  }

  const painel = await buscarPainelDoCliente(cliente);

  return (
    <HomeDoCliente
      token={cliente.tokenAcesso}
      nome={cliente.nome}
      nutricao={painel.nutricao}
      treino={painel.treino}
    />
  );
}
