import { notFound } from "next/navigation";
import {
  buscarClientePorToken,
  buscarCorridasDoCliente,
  buscarResumoDaNavegacao,
  buscarTreinoDoCliente,
} from "@/lib/cliente/consultas";
import { TreinoDoCliente } from "@/components/cliente/TreinoDoCliente";

export const dynamic = "force-dynamic";

/**
 * Aba Treino. Só existe pra quem tem personal — sem vínculo de treino a rota
 * devolve 404 (a barra nem mostra a aba, mas o link direto precisa da guarda).
 */
export default async function PaginaTreinoDoCliente({ params }: { params: { token: string } }) {
  const cliente = await buscarClientePorToken(params.token);
  if (!cliente || !cliente.consentimentoEm) {
    notFound();
  }

  const { temTreino } = await buscarResumoDaNavegacao(cliente.id);
  if (!temTreino) {
    notFound();
  }

  const [dados, corridas] = await Promise.all([
    buscarTreinoDoCliente(cliente.id),
    buscarCorridasDoCliente(cliente.id),
  ]);
  return <TreinoDoCliente token={cliente.tokenAcesso} corridas={corridas} {...dados} />;
}
