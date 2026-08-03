"use client";

import Link from "next/link";
import { NoSheipeLogo } from "@/components/nutri/NoSheipeLogo";
import { AvatarCliente } from "@/components/cliente/AvatarCliente";

interface Props {
  token: string;
  nome: string;
  fotoUrl: string | null;
  /** Pedidos esperando resposta — vira o ponto no avatar. */
  pendentes: number;
}

/**
 * Header do cliente, fixo no topo de todas as telas: a marca à esquerda e a
 * foto (acesso ao perfil) à direita. É `sticky` em vez de `fixed` pra ocupar
 * o próprio espaço no fluxo — assim o conteúdo já começa embaixo dele, sem
 * precisar de padding compensando altura em cada página.
 *
 * Respeita a safe-area do topo: no PWA instalado a barra de status ocupa o
 * canto, então o header recebe esse respiro por cima.
 */
export function HeaderCliente({ token, nome, fotoUrl, pendentes }: Props) {
  const base = `/p/${token}`;
  return (
    <header
      className="sticky top-0 z-40 border-b border-rule bg-paper/90 backdrop-blur"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex h-14 max-w-md items-center justify-between px-6">
        <Link href={base} aria-label="Início" className="tatil">
          <NoSheipeLogo size={22} />
        </Link>
        <Link href={`${base}/perfil`} aria-label="Meu perfil" className="tatil relative block">
          <AvatarCliente fotoUrl={fotoUrl} nome={nome} tamanho={34} className="shadow-sm" />
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
        </Link>
      </div>
    </header>
  );
}
