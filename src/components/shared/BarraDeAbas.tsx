"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ehAbaAtiva } from "@/components/shared/abaAtiva";

export interface Aba {
  href: string;
  rotulo: string;
  Icone: LucideIcon;
  /** Número no canto do ícone. 0 ou ausente não desenha nada. */
  distintivo?: number;
}

interface Props {
  abas: Aba[];
  /**
   * Rota raiz da área. Recebe o destaque por eliminação: vale quando
   * nenhuma outra aba casa.
   */
  raiz: string;
  /** Largura do conteúdo da área, pra a barra alinhar com ele. */
  largura?: "md" | "2xl";
  /**
   * No desktop a barra vira uma linha estática no topo em vez de ficar
   * grudada embaixo. Usar em área que se usa em tela grande — barra fixa
   * atravessando 1440px de largura não é navegação, é rodapé perdido.
   */
  topoNoDesktop?: boolean;
}

/**
 * Barra de abas — a navegação principal de uma área.
 *
 * Compartilhada entre a área do cliente e a do profissional de propósito:
 * são a mesma peça, e duplicá-la garantiria que uma das duas divergisse na
 * primeira mudança.
 */
export function BarraDeAbas({ abas, raiz, largura = "md", topoNoDesktop = false }: Props) {
  const caminho = usePathname();
  const larguraMaxima = largura === "md" ? "max-w-md" : "max-w-2xl";

  // A regra de qual aba acende mora em abaAtiva.ts, testada — ela já
  // quebrou uma vez deixando a barra inteira apagada.
  const hrefs = abas.map((aba) => aba.href);

  const posicao = topoNoDesktop
    ? "fixed inset-x-0 bottom-0 z-50 border-t sm:static sm:border-t-0 sm:border-b sm:bg-transparent"
    : "fixed inset-x-0 bottom-0 z-50 border-t";

  return (
    <nav
      aria-label="Navegação principal"
      // pb com safe-area: no iPhone a barra de gestos come o rodapé.
      className={`${posicao} border-rule bg-paper-raised pb-[env(safe-area-inset-bottom)] sm:pb-0`}
    >
      <ul className={`mx-auto flex ${larguraMaxima} ${topoNoDesktop ? "sm:justify-start sm:gap-1 sm:px-6" : ""}`}>
        {abas.map(({ href, rotulo, Icone, distintivo }) => {
          const ativa = ehAbaAtiva(caminho, raiz, href, hrefs);
          return (
            <li key={href} className={topoNoDesktop ? "flex-1 sm:flex-none" : "flex-1"}>
              <Link
                href={href}
                aria-current={ativa ? "page" : undefined}
                className={`tatil flex flex-col items-center gap-1 py-2.5 text-[0.6875rem] ${
                  topoNoDesktop ? "sm:flex-row sm:gap-1.5 sm:px-3 sm:text-sm" : ""
                } ${ativa ? "text-sheipe" : "text-ink-faint hover:text-ink-soft"}`}
              >
                <span className="relative">
                  <Icone size={20} strokeWidth={ativa ? 2 : 1.5} className={topoNoDesktop ? "sm:h-4 sm:w-4" : ""} />
                  {Boolean(distintivo) && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sheipe px-1 text-[0.625rem] font-medium text-sheipe-on"
                    >
                      {distintivo}
                    </span>
                  )}
                </span>
                {rotulo}
                {Boolean(distintivo) && <span className="sr-only">{distintivo} aguardando resposta</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
