import { notFound } from "next/navigation";
import { buscarClientePorToken, buscarPainelDoCliente } from "@/lib/cliente/consultas";
import { ConsentimentoCliente } from "@/components/cliente/ConsentimentoCliente";
import { HomeDoCliente } from "@/components/cliente/HomeDoCliente";

export const dynamic = "force-dynamic";

// O manifesto e o theme-color moraram aqui até virarem abas: agora estão
// no layout, pra valerem também em /historico e /perfil.

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
      solicitacoesPendentes={painel.solicitacoes.length}
      nutricao={painel.nutricao}
      treino={painel.treino}
      hidratacao={painel.hidratacao}
    />
  );
}
