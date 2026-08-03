"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Props {
  token: string;
  nome: string;
  /** Pedidos de acompanhamento esperando resposta — vira o ponto no avatar. */
  pendentes: number;
}

/**
 * Avatar flutuante no canto superior direito — o acesso ao perfil/conta,
 * que saiu da barra de baixo (lá embaixo é o loop diário; Perfil virou
 * Marketplace). Fica fixo em todas as telas do cliente, carrega o ponto de
 * "tem alguém esperando sua resposta" e, quando houver, será a foto do
 * usuário. Por enquanto mostra a inicial do nome num círculo.
 *
 * respeita a safe-area do topo: no PWA instalado a barra de status come o
 * canto, então o avatar desce o quanto ela ocupa.
 */
export function CabecalhoCliente({ token, nome, pendentes }: Props) {
  const base = `/p/${token}`;
  const caminho = usePathname();
  const noPerfil = caminho === `${base}/perfil`;
  const inicial = nome.trim().charAt(0).toUpperCase() || "?";

  return (
    <Link
      href={`${base}/perfil`}
      aria-label="Meu perfil"
      aria-current={noPerfil ? "page" : undefined}
      className="tatil fixed right-4 z-50"
      style={{ top: "calc(env(safe-area-inset-top) + 0.75rem)" }}
    >
      <span
        className={`relative flex h-9 w-9 items-center justify-center rounded-full bg-sheipe text-sm font-medium text-sheipe-on shadow-md ${
          noPerfil ? "ring-2 ring-sheipe ring-offset-2 ring-offset-paper" : ""
        }`}
      >
        {inicial}
        {pendentes > 0 && (
          <>
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-urgent px-1 text-[0.625rem] font-medium text-paper"
            >
              {pendentes}
            </span>
            <span className="sr-only">{pendentes} aguardando resposta</span>
          </>
        )}
      </span>
    </Link>
  );
}
