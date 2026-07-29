"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { aceitarConsentimentoPaciente } from "@/lib/nutri/publico";
import { NoSheipeLogo } from "./NoSheipeLogo";

export function ConsentimentoPaciente({ token, nomePaciente }: { token: string; nomePaciente: string }) {
  const router = useRouter();
  const [aceito, setAceito] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  function continuar() {
    if (!aceito) return;
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await aceitarConsentimentoPaciente({ token });
      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }
      router.refresh();
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
      <div>
        <div className="mb-3">
          <NoSheipeLogo size={24} />
        </div>
        <h1 className="font-display text-2xl">Olá, {nomePaciente}</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Antes de registrar o que você comeu, precisamos do seu consentimento pra tratar esse dado de saúde (LGPD).
        </p>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={aceito}
          onChange={(evento) => setAceito(evento.target.checked)}
          className="mt-1"
        />
        <span>
          Autorizo o registro das refeições que eu informar aqui e seu uso pelo meu nutricionista para acompanhar
          minha aderência às metas definidas por ele.
        </span>
      </label>

      {erro && <p className="text-sm text-urgent">{erro}</p>}

      <button
        type="button"
        onClick={continuar}
        disabled={!aceito || pendente}
        className="rounded-sm bg-sheipe px-4 py-2.5 text-sm font-medium text-sheipe-on shadow-sm transition-colors hover:bg-sheipe-deep disabled:opacity-50"
      >
        {pendente ? "Confirmando…" : "Aceitar e continuar"}
      </button>
    </main>
  );
}
