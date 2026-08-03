"use client";

import { useState } from "react";
import { Flame } from "lucide-react";
import { compartilharResumoDoDia, type SaldoDia } from "@/lib/cliente/compartilhar";

interface Props {
  nome: string;
  /** Saldo do dia pra gerar o card; null quando o cliente não tem nutrição. */
  saldo: SaldoDia | null;
  /** Dias de ofensiva — vira o texto do compartilhamento sem card. */
  ofensivaDias: number;
}

/**
 * Foguinho flutuante estilo AssistiveTouch: fica por cima do conteúdo, acima
 * da barra de baixo, brilhando. No toque, COMPARTILHA o progresso — o card do
 * dia quando há dieta, senão um texto com a ofensiva. É o atalho do "momento
 * de êxtase": bateu as metas, mostra pro mundo.
 */
export function FoguinhoFlutuante({ nome, saldo, ofensivaDias }: Props) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function compartilhar() {
    setErro(null);
    setOcupado(true);
    try {
      if (saldo) {
        const r = await compartilharResumoDoDia(nome, saldo);
        if (!r.ok) setErro(r.erro);
        return;
      }
      // Sem dieta pra virar card: compartilha a constância como texto.
      const texto =
        ofensivaDias > 0
          ? `🔥 Tô há ${ofensivaDias} ${ofensivaDias === 1 ? "dia" : "dias"} de constância no NoSheipe!`
          : "Tô treinando a constância no NoSheipe 💪";
      if (navigator.share) {
        await navigator.share({ title: "NoSheipe", text: texto });
      } else {
        await navigator.clipboard?.writeText(texto);
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setErro("não deu pra compartilhar — tente de novo");
      }
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Compartilhar meu progresso"
        disabled={ocupado}
        onClick={compartilhar}
        className="tatil fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-attention text-paper shadow-lg disabled:opacity-70"
        style={{
          bottom: "calc(5.5rem + env(safe-area-inset-bottom))",
          boxShadow: "0 0 18px 2px rgba(255, 193, 69, 0.55)",
        }}
      >
        <Flame size={26} strokeWidth={2} fill="currentColor" />
      </button>
      {erro && (
        <p
          className="fixed right-4 z-40 max-w-[12rem] rounded-sm bg-paper-raised px-2 py-1 text-right text-xs text-urgent shadow"
          style={{ bottom: "calc(9.5rem + env(safe-area-inset-bottom))" }}
        >
          {erro}
        </p>
      )}
    </>
  );
}
