"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { atualizarTreino, regenerarTokenAluno, arquivarAluno } from "@/lib/personal/acoes";

interface Props {
  alunoId: string;
  tokenInicial: string;
  treinoAtivo: { nome: string; descricao: string; diasPorSemana: number } | null;
}

export function EditorAluno({ alunoId, tokenInicial, treinoAtivo }: Props) {
  const router = useRouter();
  const [treino, setTreino] = useState({
    nome: treinoAtivo?.nome ?? "",
    descricao: treinoAtivo?.descricao ?? "",
    diasPorSemana: String(treinoAtivo?.diasPorSemana ?? 3),
  });
  const [token, setToken] = useState(tokenInicial);
  const [origem, setOrigem] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pendente, iniciarTransicao] = useTransition();

  useEffect(() => {
    setOrigem(window.location.origin);
  }, []);

  function salvarTreino(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setSalvo(false);
    iniciarTransicao(async () => {
      const resultado = await atualizarTreino({ alunoId, ...treino });
      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }
      setSalvo(true);
      router.refresh();
    });
  }

  function regenerarLink() {
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await regenerarTokenAluno({ alunoId });
      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }
      setToken(resultado.token);
    });
  }

  function arquivar() {
    if (!window.confirm("Arquivar este aluno? O painel deixa de contá-lo, mas nada é excluído.")) return;
    iniciarTransicao(async () => {
      const resultado = await arquivarAluno({ alunoId });
      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }
      router.push("/personal");
      router.refresh();
    });
  }

  const link = origem ? `${origem}/t/${token}` : `/t/${token}`;

  return (
    <div className="flex flex-col gap-6">
      <section className="paper-card rounded-sm p-6">
        <h2 className="eyebrow mb-4">Link do aluno</h2>
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

      <form onSubmit={salvarTreino} className="paper-card flex flex-col gap-4 rounded-sm p-6">
        <h2 className="eyebrow">Treino prescrito</h2>

        <label className="text-sm">
          <span className="eyebrow mb-1.5 block">Nome do treino</span>
          <input
            type="text"
            required
            value={treino.nome}
            onChange={(evento) => setTreino((t) => ({ ...t, nome: evento.target.value }))}
            placeholder="ex.: Treino A/B — hipertrofia"
            className="w-full rounded-sm border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-sheipe"
          />
        </label>

        <label className="text-sm">
          <span className="eyebrow mb-1.5 block">Exercícios prescritos</span>
          <textarea
            required
            rows={4}
            value={treino.descricao}
            onChange={(evento) => setTreino((t) => ({ ...t, descricao: evento.target.value }))}
            placeholder="ex.: A: agachamento 4x10, leg press 3x12. B: supino 4x10, remada 4x10."
            className="w-full rounded-sm border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-sheipe"
          />
        </label>

        <label className="text-sm">
          <span className="eyebrow mb-1.5 block">Dias por semana</span>
          <input
            type="number"
            required
            min={1}
            max={7}
            value={treino.diasPorSemana}
            onChange={(evento) => setTreino((t) => ({ ...t, diasPorSemana: evento.target.value }))}
            className="w-full max-w-[8rem] rounded-sm border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-sheipe"
          />
        </label>

        {erro && <p className="text-sm text-urgent">{erro}</p>}
        {salvo && !erro && <p className="text-sm text-calm">Treino atualizado.</p>}

        <div>
          <button
            type="submit"
            disabled={pendente}
            className="rounded-sm bg-sheipe px-4 py-2 text-sm font-medium text-sheipe-on shadow-sm transition-colors hover:bg-sheipe-deep disabled:opacity-50"
          >
            {pendente ? "Salvando…" : treinoAtivo ? "Atualizar treino" : "Prescrever treino"}
          </button>
        </div>
      </form>

      <button
        type="button"
        onClick={arquivar}
        disabled={pendente}
        className="self-start text-sm text-ink-faint transition-colors hover:text-urgent disabled:opacity-50"
      >
        Arquivar aluno
      </button>
    </div>
  );
}
