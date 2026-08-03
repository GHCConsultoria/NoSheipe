"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { compartilharResumoDoDia, type SaldoDia } from "@/lib/cliente/compartilhar";

interface Props {
  nomePaciente: string;
  saldo: SaldoDia;
}

export function CompartilharResumoDoDia({ nomePaciente, saldo }: Props) {
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function compartilhar() {
    setErro(null);
    setGerando(true);
    const resultado = await compartilharResumoDoDia(nomePaciente, saldo);
    if (!resultado.ok) setErro(resultado.erro);
    setGerando(false);
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={compartilhar}
        disabled={gerando}
        className="inline-flex items-center gap-1.5 self-start rounded-sm border border-rule px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-sheipe hover:text-ink disabled:opacity-50"
      >
        <Share2 size={13} strokeWidth={1.75} />
        {gerando ? "Gerando…" : "Compartilhar resumo do dia"}
      </button>
      {erro && <p className="text-xs text-urgent">{erro}</p>}
    </div>
  );
}
