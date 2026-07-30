import { notFound, redirect } from "next/navigation";
import { ehErroDeAutenticacao, obterMasterAtual } from "@/lib/profissional/auth";

export const dynamic = "force-dynamic";

/**
 * Segunda metade da guarda dupla. O middleware.ts garante que existe
 * sessão; aqui se confere `ehMaster`, que só o banco sabe.
 *
 * Sem permissão devolve 404, não 403: um profissional comum não precisa
 * descobrir que existe uma área administrativa.
 */
export default async function MasterLayout({ children }: { children: React.ReactNode }) {
  let master;
  try {
    master = await obterMasterAtual();
  } catch (erro) {
    if (ehErroDeAutenticacao(erro)) {
      redirect("/pro/login");
    }
    throw erro;
  }

  if (!master) {
    notFound();
  }

  return <>{children}</>;
}
