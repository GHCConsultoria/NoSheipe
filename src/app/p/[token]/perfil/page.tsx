import { notFound } from "next/navigation";
import { buscarClientePorToken, buscarPainelDoCliente } from "@/lib/cliente/consultas";
import { MeusProfissionais, SolicitacoesPendentes } from "@/components/cliente/MeusProfissionais";
import { MeusDadosLGPD } from "@/components/cliente/MeusDadosLGPD";
import { NoSheipeLogo } from "@/components/nutri/NoSheipeLogo";
import { ThemeToggle } from "@/components/nutri/ThemeToggle";

export const dynamic = "force-dynamic";

/**
 * Aba Perfil: quem acompanha o cliente, quem pediu pra acompanhar, e o
 * código que ele passa pra um profissional novo.
 *
 * Os pedidos pendentes moram aqui, e não na Hoje, pra não empurrar o
 * progresso pra baixo da dobra logo na abertura — o distintivo na barra do
 * rodapé é que avisa que tem algo esperando. A aba Hoje também aponta pra
 * cá quando o cliente ainda não tem nenhum profissional.
 */
export default async function PerfilDoCliente({ params }: { params: { token: string } }) {
  const cliente = await buscarClientePorToken(params.token);
  if (!cliente || !cliente.consentimentoEm) {
    notFound();
  }

  const painel = await buscarPainelDoCliente(cliente);

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <div className="mb-3">
        <NoSheipeLogo size={24} />
      </div>
      <h1 className="font-display text-2xl">{cliente.nome}</h1>

      <SolicitacoesPendentes token={cliente.tokenAcesso} solicitacoes={painel.solicitacoes} />

      <MeusProfissionais
        token={cliente.tokenAcesso}
        codigoConvite={cliente.codigoConvite}
        ativos={painel.vinculosAtivos}
      />

      <section className="mt-8">
        <h2 className="eyebrow mb-3">Aparência</h2>
        <div className="paper-card flex items-center justify-between gap-3 rounded-sm p-4">
          <p className="text-sm text-ink-soft">Tema claro ou escuro</p>
          <ThemeToggle inline />
        </div>
      </section>

      <MeusDadosLGPD token={cliente.tokenAcesso} />
    </main>
  );
}
