"use client";

import { CalendarDays, Home, UserRound } from "lucide-react";
import { BarraDeAbas } from "@/components/shared/BarraDeAbas";

interface Props {
  token: string;
  /** Pedidos de acompanhamento esperando resposta — vira o ponto no Perfil. */
  pendentes: number;
  /** Sem nutricionista não há histórico de dieta pra mostrar. */
  mostrarHistorico: boolean;
}

/**
 * Navegação do cliente. Fica no rodapé em qualquer largura, sem virar topo
 * no desktop: esta área é feita pra celular e instalada como PWA — não
 * existe versão "de mesa" dela.
 */
export function NavRodape({ token, pendentes, mostrarHistorico }: Props) {
  const base = `/p/${token}`;

  return (
    <BarraDeAbas
      raiz={base}
      abas={[
        { href: base, rotulo: "Hoje", Icone: Home },
        ...(mostrarHistorico ? [{ href: `${base}/historico`, rotulo: "Histórico", Icone: CalendarDays }] : []),
        { href: `${base}/perfil`, rotulo: "Perfil", Icone: UserRound, distintivo: pendentes },
      ]}
    />
  );
}
