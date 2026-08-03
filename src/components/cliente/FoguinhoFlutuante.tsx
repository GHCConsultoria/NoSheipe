"use client";

import { Flame } from "lucide-react";

/**
 * Foguinho flutuante estilo AssistiveTouch: fica por cima do conteúdo,
 * acima da barra de baixo, brilhando. Por ora ele rola até a "constância"
 * (a chama da semana) — o atalho pro momento de comemorar a sequência.
 *
 * A ação final ainda está em aberto (comemorar / compartilhar / convidar);
 * o alvo do scroll é fácil de trocar quando definirmos.
 */
export function FoguinhoFlutuante() {
  return (
    <button
      type="button"
      aria-label="Minha constância"
      onClick={() => document.getElementById("constancia")?.scrollIntoView({ behavior: "smooth" })}
      className="tatil fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-attention text-paper shadow-lg"
      style={{
        bottom: "calc(5.5rem + env(safe-area-inset-bottom))",
        boxShadow: "0 0 18px 2px rgba(255, 193, 69, 0.55)",
      }}
    >
      <Flame size={26} strokeWidth={2} fill="currentColor" />
    </button>
  );
}
