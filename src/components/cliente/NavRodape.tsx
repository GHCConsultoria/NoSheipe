"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, UserRound } from "lucide-react";

interface Props {
  token: string;
  /** Pedidos de acompanhamento esperando resposta — vira o ponto no Perfil. */
  pendentes: number;
  /** Sem nutricionista não há histórico de dieta pra mostrar. */
  mostrarHistorico: boolean;
}

/**
 * Barra de navegação fixa no rodapé, no padrão que os apps de celular
 * consolidaram — o alcance do polegar, e não o topo da tela.
 *
 * Só existe na área do cliente: é a tela usada todo dia, instalada como
 * PWA. O painel do profissional é de uso pontual e continua com navegação
 * no topo.
 */
export function NavRodape({ token, pendentes, mostrarHistorico }: Props) {
  const caminho = usePathname();
  const base = `/p/${token}`;

  const abas = [
    { href: base, rotulo: "Hoje", Icone: Home },
    ...(mostrarHistorico ? [{ href: `${base}/historico`, rotulo: "Histórico", Icone: CalendarDays }] : []),
    { href: `${base}/perfil`, rotulo: "Perfil", Icone: UserRound, distintivo: pendentes },
  ];

  return (
    <nav
      aria-label="Navegação principal"
      // pb com safe-area: no iPhone a barra de gestos come o rodapé.
      className="fixed inset-x-0 bottom-0 z-50 border-t border-rule bg-paper-raised pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-md">
        {abas.map(({ href, rotulo, Icone, distintivo }) => {
          // A aba "Hoje" é a raiz, então casar por prefixo marcaria ela em
          // todas as telas — só ela precisa de igualdade exata.
          const ativa = href === base ? caminho === base : caminho.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={ativa ? "page" : undefined}
                className={`tatil flex flex-col items-center gap-1 py-2.5 text-[0.6875rem] ${
                  ativa ? "text-sheipe" : "text-ink-faint hover:text-ink-soft"
                }`}
              >
                <span className="relative">
                  <Icone size={20} strokeWidth={ativa ? 2 : 1.5} />
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
                {Boolean(distintivo) && <span className="sr-only">{distintivo} pedido(s) aguardando resposta</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
