"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AvatarCliente } from "@/components/cliente/AvatarCliente";

interface Props {
  token: string;
  nome: string;
  fotoUrl: string | null;
  /** Pedidos de acompanhamento esperando resposta — vira o ponto no avatar. */
  pendentes: number;
}

/**
 * Avatar flutuante no canto superior direito — mas SÓ na tela de
 * Marketplace. Nas demais telas o acesso ao perfil já é a faixa de
 * identidade no topo (IdentidadeCliente); o Marketplace não tem essa faixa
 * (é vitrine, não o perfil da pessoa), então precisa deste atalho pro
 * perfil. Fora do Marketplace, não renderiza nada.
 *
 * Respeita a safe-area do topo: no PWA instalado a barra de status ocupa o
 * canto, então o avatar desce o quanto ela pede.
 */
export function CabecalhoCliente({ token, nome, fotoUrl, pendentes }: Props) {
  const base = `/p/${token}`;
  const caminho = usePathname();
  if (caminho !== `${base}/marketplace`) return null;

  return (
    <Link
      href={`${base}/perfil`}
      aria-label="Meu perfil"
      className="tatil fixed right-4 z-50"
      style={{ top: "calc(env(safe-area-inset-top) + 0.75rem)" }}
    >
      <span className="relative block">
        <AvatarCliente fotoUrl={fotoUrl} nome={nome} tamanho={36} className="shadow-md" />
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
