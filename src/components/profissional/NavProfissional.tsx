"use client";

import { UserRound, Users, UserRoundPlus } from "lucide-react";
import { BarraDeAbas } from "@/components/shared/BarraDeAbas";

/**
 * Navegação da área do profissional.
 *
 * Mesma peça da área do cliente, com uma diferença: no desktop ela sobe
 * pro topo. O painel do profissional se usa no computador tanto quanto no
 * celular, e barra fixa atravessando uma tela larga não lê como navegação.
 *
 * "Novo cliente" é ação, não seção — mas é a segunda coisa mais frequente
 * que um profissional faz aqui, e escondê-la atrás de um botão no meio da
 * lista custava mais que a impureza de tratá-la como aba.
 *
 * Sem distintivo em lugar nenhum, ao contrário da barra do cliente: os
 * pedidos que o profissional enviou estão esperando resposta de outra
 * pessoa. Um distintivo diria "faça algo", e não há nada a fazer.
 */
export function NavProfissional() {
  return (
    <BarraDeAbas
      raiz="/pro"
      largura="2xl"
      topoNoDesktop
      abas={[
        { href: "/pro", rotulo: "Clientes", Icone: Users },
        { href: "/pro/clientes/novo", rotulo: "Novo", Icone: UserRoundPlus },
        { href: "/pro/conta", rotulo: "Conta", Icone: UserRound },
      ]}
    />
  );
}
