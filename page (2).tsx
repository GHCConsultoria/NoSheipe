"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { atualizarMetas, regenerarTokenPaciente, arquivarPaciente } from "@/lib/nutri/acoes";

interface Props {
  pacienteId: string;
  tokenInicial: string;
  metasIniciais: { metaKcal: number; metaProteina: number; metaCarbo: number; metaGordura: number };
}

export function EditorPaciente({ pacienteId, tokenInicial, metasIniciais }: Props) {
  const router = useRouter();
  const [metas, setMetas] = useState({
    metaKcal: String(metasIniciais.metaKcal),
    metaProteina: String(metasIniciais.metaProteina),
    metaCarbo: String(metasIniciais.metaCarbo),
    metaGordura: String(metasIniciais.metaGordura),
  });
  const [token, setToken] = useState(tokenInicial);
  const [origem, setOrigem] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pendente, iniciarTransicao] = useTransition();

  useEffect(() => {
    setOrigem(window.location.origin);
  }, []);

  function salvarMetas(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setSalvo(false);
    iniciarTransicao(async () => {
      const resultado = await atualizarMetas({ pacienteId, ...metas });
      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }
      setSalvo(true);
    });
  }

  function regenerarLink() {
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await regenerarTokenPaciente({ pacienteId });
      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }
      setToken(resultado.token);
    });
  }

  function arquivar() {
    if (!window.confirm("Arquivar este paciente? O painel deixa de contá-lo, mas nada é excluído.")) return;
    iniciarTransicao(async () => {
      const resultado = await arquivarPaciente({ pacienteId });
      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }
      router.push("/nutri");
      router.refresh();
    });
  }

  const link = origem ? `${origem}/p/${token}` : `/p/${token}`;

  return (
    <div className="flex flex-col gap-6">
      <section className="paper-card rounded-sm p-6">
        <h2 className="eyebrow mb-4">Link do paciente</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <code className="font-data flex-1 rounded-sm border border-rule bg-paper px-3 py-2 text-xs break-all">
            {link}
          </code>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(link)}
              className="rounded-sm border border-rule px-3 py-2 text-xs text-ink-soft transition-colors hover:border-sheipe hover:text-ink"
            >
              Copiar
            </button>
            <button
              type="button"
              onClick={regenerarLink}
              disabled={pendente}
              className="rounded-sm border border-rule px-3 py-2 text-xs text-ink-soft transition-colors hover:border-urgent-line hover:text-urgent disabled:opacity-50"
            >
              Revogar e gerar novo
            </button>
          </div>
        </div>
      </section>

      <form onSubmit={salvarMetas} className="paper-card grid grid-cols-1 gap-4 rounded-sm p-6 sm:grid-cols-2">
        <h2 className="eyebrow sm:col-span-2">Metas diárias</h2>

        <CampoMeta label="Meta kcal" valor={metas.metaKcal} onChange={(v) => setMetas((m) => ({ ...m, metaKcal: v }))} />
        <CampoMeta
          label="Proteína (g)"
          valor={metas.metaProteina}
          onChange={(v) => setMetas((m) => ({ ...m, metaProteina: v }))}
        />
        <CampoMeta label="Carbo (g)" valor={metas.metaCarbo} onChange={(v) => setMetas((m) => ({ ...m, metaCarbo: v }))} />
        <CampoMeta
          label="Gordura (g)"
          valor={metas.metaGordura}
          onChange={(v) => setMetas((m) => ({ ...m, metaGordura: v }))}
        />

        {erro && <p className="text-sm text-urgent sm:col-span-2">{erro}</p>}
        {salvo && !erro && <p className="text-sm text-calm sm:col-span-2">Metas atualizadas.</p>}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pendente}
            className="rounded-sm bg-sheipe px-4 py-2 text-sm font-medium text-sheipe-on shadow-sm transition-colors hover:bg-sheipe-deep disabled:opacity-50"
          >
            {pendente ? "Salvando…" : "Salvar metas"}
          </button>
        </div>
      </form>

      <button
        type="button"
        onClick={arquivar}
        disabled={pendente}
        className="self-start text-sm text-ink-faint transition-colors hover:text-urgent disabled:opacity-50"
      >
        Arquivar paciente
      </button>
    </div>
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
