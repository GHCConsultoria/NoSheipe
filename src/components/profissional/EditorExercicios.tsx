"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Plus, X } from "lucide-react";
import { salvarExerciciosDoTreino } from "@/lib/cliente/acoes";
import type { ExercicioPrescritoDado } from "@/lib/cliente/consultas";

interface Linha {
  nome: string;
  seriesAlvo: string;
  repsAlvo: string;
  cargaAlvoKg: string;
  descansoSeg: string;
}

function paraLinha(e: ExercicioPrescritoDado): Linha {
  return {
    nome: e.nome,
    seriesAlvo: String(e.seriesAlvo),
    repsAlvo: e.repsAlvo,
    cargaAlvoKg: e.cargaAlvoKg != null ? String(e.cargaAlvoKg) : "",
    descansoSeg: e.descansoSeg != null ? String(e.descansoSeg) : "",
  };
}

const VAZIA: Linha = { nome: "", seriesAlvo: "3", repsAlvo: "8-12", cargaAlvoKg: "", descansoSeg: "60" };

/**
 * Editor dos exercícios prescritos — o lado "personal prescreve" do treino
 * estruturado. Monta a lista (nome, séries, reps e carga-alvo) que o cliente
 * segue na aba Treino. Salvar substitui a lista inteira do treino ativo.
 */
export function EditorExercicios({
  clienteId,
  exerciciosIniciais,
}: {
  clienteId: string;
  exerciciosIniciais: ExercicioPrescritoDado[];
}) {
  const router = useRouter();
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    exerciciosIniciais.length > 0 ? exerciciosIniciais.map(paraLinha) : [{ ...VAZIA }],
  );
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pendente, iniciar] = useTransition();

  function mexer(i: number, campo: keyof Linha, valor: string) {
    setSalvo(false);
    setLinhas((atual) => atual.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));
  }
  function remover(i: number) {
    setSalvo(false);
    setLinhas((atual) => atual.filter((_, j) => j !== i));
  }
  function adicionar() {
    setSalvo(false);
    setLinhas((atual) => [...atual, { ...VAZIA }]);
  }

  function salvar() {
    setErro(null);
    const exercicios = linhas
      .filter((l) => l.nome.trim())
      .map((l) => ({
        nome: l.nome.trim(),
        seriesAlvo: l.seriesAlvo,
        repsAlvo: l.repsAlvo.trim() || "8-12",
        cargaAlvoKg: l.cargaAlvoKg.trim() ? l.cargaAlvoKg.replace(",", ".") : null,
        descansoSeg: l.descansoSeg.trim() ? l.descansoSeg : null,
      }));

    iniciar(async () => {
      const r = await salvarExerciciosDoTreino({ clienteId, exercicios });
      if (!r.sucesso) {
        setErro(r.erro);
        return;
      }
      setSalvo(true);
      router.refresh();
    });
  }

  return (
    <section className="paper-card mt-4 rounded-sm p-5">
      <h2 className="eyebrow mb-1">Exercícios do treino</h2>
      <p className="mb-3 text-xs text-ink-faint">
        O que o cliente segue e registra na aba Treino. Deixe a carga em branco se for livre.
      </p>

      <div className="flex flex-col gap-2">
        {linhas.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <GripVertical size={14} className="shrink-0 text-ink-faint" />
            <input
              type="text"
              value={l.nome}
              onChange={(e) => mexer(i, "nome", e.target.value)}
              maxLength={60}
              placeholder="Exercício"
              className="min-w-0 flex-[2] rounded-sm border border-rule bg-paper px-2 py-1.5 text-sm outline-none focus:border-treino"
            />
            <input
              type="number"
              min="1"
              value={l.seriesAlvo}
              onChange={(e) => mexer(i, "seriesAlvo", e.target.value)}
              aria-label="Séries"
              className="w-12 rounded-sm border border-rule bg-paper px-1.5 py-1.5 text-center text-sm outline-none focus:border-treino"
            />
            <span className="text-xs text-ink-faint">×</span>
            <input
              type="text"
              value={l.repsAlvo}
              onChange={(e) => mexer(i, "repsAlvo", e.target.value)}
              aria-label="Reps"
              maxLength={20}
              placeholder="8-12"
              className="w-16 rounded-sm border border-rule bg-paper px-1.5 py-1.5 text-center text-sm outline-none focus:border-treino"
            />
            <input
              type="number"
              min="0"
              step="0.5"
              value={l.cargaAlvoKg}
              onChange={(e) => mexer(i, "cargaAlvoKg", e.target.value)}
              aria-label="Carga alvo (kg)"
              placeholder="kg"
              className="w-16 rounded-sm border border-rule bg-paper px-1.5 py-1.5 text-center text-sm outline-none focus:border-treino"
            />
            <button
              type="button"
              aria-label="Remover exercício"
              onClick={() => remover(i)}
              className="tatil shrink-0 text-ink-faint transition-colors hover:text-urgent"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {erro && <p className="mt-2 text-sm text-urgent">{erro}</p>}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={adicionar}
          className="tatil inline-flex items-center gap-1 rounded-sm border border-rule px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-treino hover:text-ink"
        >
          <Plus size={13} /> exercício
        </button>
        <button
          type="button"
          disabled={pendente}
          onClick={salvar}
          className="tatil rounded-sm bg-treino px-4 py-2 text-sm font-medium text-treino-on shadow-sm transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {pendente ? "Salvando…" : "Salvar exercícios"}
        </button>
        {salvo && <span className="text-xs text-treino">salvo ✓</span>}
      </div>
    </section>
  );
}
