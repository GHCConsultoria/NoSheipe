"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { criarAluno } from "@/lib/personal/acoes";

interface Campos {
  nome: string;
  telefone: string;
}

const ESTADO_INICIAL: Campos = { nome: "", telefone: "" };

export function FormularioNovoAluno() {
  const router = useRouter();
  const [campos, setCampos] = useState<Campos>(ESTADO_INICIAL);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await criarAluno(campos);
      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }
      setCampos(ESTADO_INICIAL);
      router.push("/personal");
      router.refresh();
    });
  }

  return (
    <form onSubmit={enviar} className="paper-card flex flex-col gap-4 rounded-sm p-6">
      <label className="text-sm">
        <span className="eyebrow mb-1.5 block">Nome</span>
        <input
          type="text"
          required
          value={campos.nome}
          onChange={(evento) => setCampos((c) => ({ ...c, nome: evento.target.value }))}
          className="w-full rounded-sm border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-sheipe"
        />
      </label>

      <label className="text-sm">
        <span className="eyebrow mb-1.5 block">Telefone (opcional)</span>
        <input
          type="text"
          value={campos.telefone}
          onChange={(evento) => setCampos((c) => ({ ...c, telefone: evento.target.value }))}
          className="w-full rounded-sm border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-sheipe"
        />
      </label>

      {erro && <p className="text-sm text-urgent">{erro}</p>}

      <div>
        <button
          type="submit"
          disabled={pendente}
          className="rounded-sm bg-sheipe px-4 py-2 text-sm font-medium text-sheipe-on shadow-sm transition-colors hover:bg-sheipe-deep disabled:opacity-50"
        >
          {pendente ? "Cadastrando…" : "Cadastrar aluno"}
        </button>
      </div>
    </form>
  );
}
