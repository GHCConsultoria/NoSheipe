"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, Home, Plus, Salad, UserRound, type LucideIcon } from "lucide-react";
import { ehAbaAtiva } from "@/components/shared/abaAtiva";

interface Props {
  token: string;
  /** Pedidos de acompanhamento esperando resposta — vira o ponto no Perfil. */
  pendentes: number;
  /** Sem nutricionista não há Diário nem registro de refeição (o "+"). */
  temNutricao: boolean;
  /** Sem personal não há aba de Treino. */
  temTreino: boolean;
}

interface ItemAba {
  href: string;
  rotulo: string;
  Icone: LucideIcon;
  distintivo?: number;
}

/**
 * Navegação do cliente. Fica no rodapé em qualquer largura, sem virar topo
 * no desktop: esta área é feita pra celular e instalada como PWA.
 *
 * Cinco lugares no máximo — Home, Diário, o "+" de registrar refeição,
 * Treino e Perfil — mas a barra se adapta aos vínculos: quem só tem
 * nutricionista não vê Treino; quem só tem personal não vê Diário nem o "+".
 * O "+" é a ação do dia e por isso ganha o centro, elevado.
 */
export function NavRodape({ token, pendentes, temNutricao, temTreino }: Props) {
  const base = `/p/${token}`;
  const caminho = usePathname();

  const esquerda: ItemAba[] = [
    { href: base, rotulo: "Home", Icone: Home },
    ...(temNutricao ? [{ href: `${base}/historico`, rotulo: "Diário", Icone: Salad }] : []),
  ];
  const direita: ItemAba[] = [
    ...(temTreino ? [{ href: `${base}/treino`, rotulo: "Treino", Icone: Dumbbell }] : []),
    { href: `${base}/perfil`, rotulo: "Perfil", Icone: UserRound, distintivo: pendentes },
  ];
  const hrefs = [...esquerda, ...direita].map((i) => i.href);

  function renderAba({ href, rotulo, Icone, distintivo }: ItemAba) {
    const ativa = ehAbaAtiva(caminho, base, href, hrefs);
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
          {Boolean(distintivo) && <span className="sr-only">{distintivo} aguardando resposta</span>}
        </Link>
      </li>
    );
  }

  return (
    <nav
      aria-label="Navegação principal"
      // pb com safe-area: no iPhone a barra de gestos come o rodapé.
      className="fixed inset-x-0 bottom-0 z-50 border-t border-rule bg-paper-raised pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-md items-center">
        {esquerda.map(renderAba)}

        {temNutricao && (
          <li className="flex-1">
            <div className="flex justify-center">
              <Link
                href={`${base}#registrar`}
                aria-label="Registrar refeição"
                className="tatil -mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-sheipe text-sheipe-on shadow-lg transition-colors hover:bg-sheipe-deep"
              >
                <Plus size={26} strokeWidth={2.25} />
              </Link>
            </div>
          </li>
        )}

        {direita.map(renderAba)}
      </ul>
    </nav>
  );
}
