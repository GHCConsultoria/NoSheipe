"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { criarPaciente } from "@/lib/nutri/acoes";

interface Campos {
  nome: string;
  telefone: string;
  metaKcal: string;
  metaProteina: string;
  metaCarbo: string;
  metaGordura: string;
}

const ESTADO_INICIAL: Campos = {
  nome: "",
  telefone: "",
  metaKcal: "",
  metaProteina: "",
  metaCarbo: "",
  metaGordura: "",
};

export function FormularioNovoPaciente() {
  const router = useRouter();
  const [campos, setCampos] = useState<Campos>(ESTADO_INICIAL);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await criarPaciente(campos);
      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }
      setCampos(ESTADO_INICIAL);
      router.push("/nutri");
      router.refresh();
    });
  }

  return (
    <form onSubmit={enviar} className="paper-card grid grid-cols-1 gap-4 rounded-sm p-6 sm:grid-cols-2">
      <label className="text-sm sm:col-span-2">
        <span className="eyebrow mb-1.5 block">Nome</span>
        <input
          type="text"
          required
          value={campos.nome}
          onChange={(evento) => setCampos((c) => ({ ...c, nome: evento.target.value }))}
          className="w-full rounded-sm border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-sheipe"
        />
      </label>

      <label className="text-sm sm:col-span-2">
        <span className="eyebrow mb-1.5 block">Telefone (opcional)</span>
        <input
          type="text"
          value={campos.telefone}
          onChange={(evento) => setCampos((c) => ({ ...c, telefone: evento.target.value }))}
          className="w-full rounded-sm border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-sheipe"
        />
      </label>

      <CampoMeta label="Meta kcal" valor={campos.metaKcal} onChange={(v) => setCampos((c) => ({ ...c, metaKcal: v }))} />
      <CampoMeta
        label="Proteína (g)"
        valor={campos.metaProteina}
        onChange={(v) => setCampos((c) => ({ ...c, metaProteina: v }))}
      />
      <CampoMeta label="Carbo (g)" valor={campos.metaCarbo} onChange={(v) => setCampos((c) => ({ ...c, metaCarbo: v }))} />
      <CampoMeta
        label="Gordura (g)"
        valor={campos.metaGordura}
        onChange={(v) => setCampos((c) => ({ ...c, metaGordura: v }))}
      />

      {erro && <p className="text-sm text-urgent sm:col-span-2">{erro}</p>}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pendente}
          className="rounded-sm bg-sheipe px-4 py-2 text-sm font-medium text-sheipe-on shadow-sm transition-colors hover:bg-sheipe-deep disabled:opacity-50"
        >
          {pendente ? "Cadastrando…" : "Cadastrar paciente"}
        </button>
      </div>
    </form>
  );
}

function CampoMeta({ label, valor, onChange }: { label: string; valor: string; onChange: (v: string) => void }) {
  return (
    <label className="text-sm">
      <span className="eyebrow mb-1.5 block">{label}</span>
      <input
        type="number"
        required
        min={0}
        value={valor}
        onChange={(evento) => onChange(evento.target.value)}
        className="w-full rounded-sm border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-sheipe"
      />
    </label>
  );
}
