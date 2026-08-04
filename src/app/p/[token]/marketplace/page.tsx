import { notFound } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { buscarClientePorToken, buscarOfertasParaCliente } from "@/lib/cliente/consultas";

export const dynamic = "force-dynamic";

/**
 * Marketplace do cliente: as ofertas dos profissionais que o acompanham
 * (treino/dieta avulsos, consultorias). Por enquanto é a vitrine — o
 * checkout entra quando o meio de pagamento for definido; até lá, o cliente
 * fala com o profissional.
 */
export default async function MarketplaceDoCliente({ params }: { params: { token: string } }) {
  const cliente = await buscarClientePorToken(params.token);
  if (!cliente || !cliente.consentimentoEm) {
    notFound();
  }

  const ofertas = await buscarOfertasParaCliente(cliente.id);

  return (
    <main className="mx-auto max-w-md px-6 pb-10 pt-6">
      <h1 className="font-display text-2xl">Marketplace</h1>

      {ofertas.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-paper-raised text-ink-faint shadow-sm">
            <ShoppingBag size={28} strokeWidth={1.5} />
          </span>
          <p className="text-sm text-ink-soft">
            Seu time ainda não publicou nenhuma oferta. Quando publicar, os avulsos aparecem aqui.
          </p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {ofertas.map((o) => (
            <li key={o.id} className="paper-card rounded-sm p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-sm">{o.titulo}</h2>
                <span className="shrink-0 font-data text-sm text-sheipe">{o.preco}</span>
              </div>
              <p className="mt-1 text-sm text-ink-soft">{o.descricao}</p>
              <p className="mt-2 text-xs text-ink-faint">por {o.profissionalNome} — fale com ele pra contratar</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
