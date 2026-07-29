"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { registrarPeso } from "@/lib/nutri/publico";

interface Props {
  token: string;
  pesoAtual: number | null;
}

export function RegistroPeso({ token, pesoAtual }: Props) {
  const router = useRouter();
  const [peso, setPeso] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!peso.trim()) return;
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await registrarPeso({ token, pesoKg: peso });
      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }
      setPeso("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={enviar} className="paper-card flex flex-col gap-3 rounded-sm p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="eyebrow">Peso</h2>
        {pesoAtual !== null && <span className="font-data text-xs text-ink-faint">último: {pesoAtual} kg</span>}
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min={0}
          value={peso}
          onChange={(evento) => setPeso(evento.target.value)}
          placeholder="ex.: 72.5"
          className="w-full rounded-sm border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-sheipe"
        />
        <button
          type="submit"
          disabled={pendente || !peso.trim()}
          className="shrink-0 rounded-sm border border-rule px-3 py-2 text-xs text-ink-soft transition-colors hover:border-sheipe hover:text-ink disabled:opacity-50"
        >
          {pendente ? "Salvando…" : "Registrar"}
        </button>
      </div>

      {erro && <p className="text-sm text-urgent">{erro}</p>}
    </form>
  );
}
