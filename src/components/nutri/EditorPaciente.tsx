"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { atualizarMetas, regenerarTokenPaciente, arquivarPaciente, adicionarAnotacao } from "@/lib/nutri/acoes";
import { GraficoLinha } from "@/components/shared/GraficoLinha";

interface Anotacao {
  id: string;
  texto: string;
  data: string;
}

interface PontoDePeso {
  valor: number;
  rotulo: string;
}

interface Props {
  pacienteId: string;
  tokenInicial: string;
  metasIniciais: { metaKcal: number; metaProteina: number; metaCarbo: number; metaGordura: number };
  historicoDePeso: PontoDePeso[];
  anotacoes: Anotacao[];
}

export function EditorPaciente({ pacienteId, tokenInicial, metasIniciais, historicoDePeso, anotacoes }: Props) {
  const router = useRouter();
  const [novaAnotacao, setNovaAnotacao] = useState("");
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

  function enviarAnotacao(evento: React.FormEvent) {
    evento.preventDefault();
    if (!novaAnotacao.trim()) return;
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await adicionarAnotacao({ pacienteId, texto: novaAnotacao });
      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }
      setNovaAnotacao("");
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

      {historicoDePeso.length >= 2 && (
        <section className="paper-card rounded-sm p-6">
          <h2 className="eyebrow mb-4">Evolução de peso</h2>
          <GraficoLinha pontos={historicoDePeso} sufixo=" kg" />
        </section>
      )}

      <section className="paper-card rounded-sm p-6">
        <h2 className="eyebrow mb-4">Anotações</h2>
        <form onSubmit={enviarAnotacao} className="flex flex-col gap-3">
          <textarea
            rows={3}
            value={novaAnotacao}
            onChange={(evento) => setNovaAnotacao(evento.target.value)}
            placeholder="Observação de consulta — só você vê."
            className="w-full rounded-sm border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-sheipe"
          />
          <button
            type="submit"
            disabled={pendente || !novaAnotacao.trim()}
            className="self-start rounded-sm border border-rule px-3 py-2 text-xs text-ink-soft transition-colors hover:border-sheipe hover:text-ink disabled:opacity-50"
          >
            {pendente ? "Salvando…" : "Adicionar anotação"}
          </button>
        </form>

        {anotacoes.length > 0 && (
          <ul className="mt-5 flex flex-col gap-3">
            {anotacoes.map((anotacao) => (
              <li key={anotacao.id} className="rounded-sm border border-rule bg-paper p-3">
                <p className="font-data text-xs text-ink-faint">{anotacao.data}</p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{anotacao.texto}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

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
