import { notFound } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { buscarClientePorToken } from "@/lib/cliente/consultas";

export const dynamic = "force-dynamic";

/**
 * Aba Marketplace — ocupou o lugar que era do Perfil na barra de baixo (o
 * Perfil virou o avatar no topo). Por enquanto é um estado "em breve":
 * a tela existe pra o botão não ser um beco sem saída, e o conteúdo entra
 * numa próxima etapa (treinos e dietas avulsos, indicação com cashback etc.).
 */
export default async function MarketplaceDoCliente({ params }: { params: { token: string } }) {
  const cliente = await buscarClientePorToken(params.token);
  if (!cliente || !cliente.consentimentoEm) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-md px-6 pb-10 pt-6">
      <h1 className="font-display text-2xl">Marketplace</h1>

      <div className="mt-10 flex flex-col items-center gap-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-paper-raised text-ink-faint shadow-sm">
          <ShoppingBag size={28} strokeWidth={1.5} />
        </span>
        <p className="text-sm text-ink-soft">
          Em breve por aqui: treinos e dietas avulsos, e mais um jeito de você levar o NoSheipe pros amigos.
        </p>
        <span className="eyebrow text-ink-faint">chegando logo</span>
      </div>
    </main>
  );
}
