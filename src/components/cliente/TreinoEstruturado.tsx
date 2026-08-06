"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dumbbell, Plus, Timer, Trophy, X } from "lucide-react";
import { registrarTreinoEstruturado } from "@/lib/cliente/publico";
import { formatarCarga, type RecordeExercicio } from "@/lib/cliente/forca";
import type { ExercicioPrescritoDado } from "@/lib/cliente/consultas";

interface SerieEstado {
  carga: string;
  reps: string;
}
interface ExercicioEstado {
  nome: string;
  alvo: string | null;
  descansoSeg: number | null;
  series: SerieEstado[];
  avulso: boolean;
}

function rotuloAlvo(e: ExercicioPrescritoDado): string {
  const carga = e.cargaAlvoKg ? ` · ${formatarCarga(e.cargaAlvoKg)}` : "";
  return `${e.seriesAlvo}×${e.repsAlvo}${carga}`;
}

function estadoInicial(exercicios: ExercicioPrescritoDado[]): ExercicioEstado[] {
  return exercicios.map((e) => ({
    nome: e.nome,
    alvo: rotuloAlvo(e),
    descansoSeg: e.descansoSeg,
    series: Array.from({ length: Math.max(1, e.seriesAlvo) }, () => ({
      carga: e.cargaAlvoKg ? String(e.cargaAlvoKg) : "",
      reps: "",
    })),
    avulso: false,
  }));
}

const numeroBR = (v: string): number | null => {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/**
 * Registro do treino estruturado: o cliente segue os exercícios prescritos,
 * preenche a carga e as reps de cada série, e pode somar um exercício avulso.
 * Traz o timer de descanso e comemora quando bate o recorde de carga. Ao
 * enviar, vira uma SessaoTreino com as séries — conta na aderência igual.
 */
export function BlocoTreinoEstruturado({
  token,
  treino,
  recordes,
}: {
  token: string;
  treino: { nome: string; exercicios: ExercicioPrescritoDado[] };
  recordes: RecordeExercicio[];
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<ExercicioEstado[]>(() => estadoInicial(treino.exercicios));
  const [erro, setErro] = useState<string | null>(null);
  const [festa, setFesta] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  // Timer de descanso — um só pra tela toda.
  const [descanso, setDescanso] = useState<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  function descansar(seg: number) {
    if (tickRef.current) clearInterval(tickRef.current);
    setDescanso(seg);
    tickRef.current = setInterval(() => {
      setDescanso((t) => {
        if (t === null) return t;
        if (t <= 1) {
          if (tickRef.current) clearInterval(tickRef.current);
          return null;
        }
        return t - 1;
      });
    }, 1000);
  }

  const prDoExercicio = (nome: string) => recordes.find((r) => r.exercicio === nome)?.melhorCargaKg ?? null;

  function mexerSerie(iEx: number, iSerie: number, campo: keyof SerieEstado, valor: string) {
    setEstado((atual) =>
      atual.map((ex, i) =>
        i !== iEx ? ex : { ...ex, series: ex.series.map((s, j) => (j !== iSerie ? s : { ...s, [campo]: valor })) },
      ),
    );
  }
  function addSerie(iEx: number) {
    setEstado((atual) => atual.map((ex, i) => (i !== iEx ? ex : { ...ex, series: [...ex.series, { carga: "", reps: "" }] })));
  }
  function renomear(iEx: number, nome: string) {
    setEstado((atual) => atual.map((ex, i) => (i !== iEx ? ex : { ...ex, nome })));
  }
  function addAvulso() {
    setEstado((atual) => [...atual, { nome: "", alvo: null, descansoSeg: null, series: [{ carga: "", reps: "" }], avulso: true }]);
  }
  function removerAvulso(iEx: number) {
    setEstado((atual) => atual.filter((_, i) => i !== iEx));
  }

  function registrar() {
    setErro(null);
    setFesta(null);

    const series = estado
      .flatMap((ex) =>
        ex.series
          .filter((s) => s.carga.trim() || s.reps.trim())
          .map((s) => ({ exercicio: ex.nome.trim(), cargaKg: numeroBR(s.carga), reps: numeroBR(s.reps) })),
      )
      .filter((s) => s.exercicio);

    if (series.length === 0) {
      setErro("preencha a carga ou as reps de ao menos uma série");
      return;
    }

    // Recorde batido? Compara a maior carga enviada de cada exercício com o PR atual.
    const maiorPorExercicio = new Map<string, number>();
    for (const s of series) {
      if (!s.cargaKg) continue;
      maiorPorExercicio.set(s.exercicio, Math.max(maiorPorExercicio.get(s.exercicio) ?? 0, s.cargaKg));
    }
    let recordeBatido: string | null = null;
    for (const [ex, carga] of Array.from(maiorPorExercicio)) {
      const pr = prDoExercicio(ex);
      if (pr === null || carga > pr) {
        recordeBatido = `🏆 Novo recorde em ${ex}: ${formatarCarga(carga)}!`;
        break;
      }
    }

    iniciar(async () => {
      const r = await registrarTreinoEstruturado({
        token,
        clientLogId: crypto.randomUUID(),
        nomeTreino: treino.nome,
        series,
      });
      if (!r.sucesso) {
        setErro(r.erro);
        return;
      }
      if (recordeBatido) setFesta(recordeBatido);
      setEstado(estadoInicial(treino.exercicios));
      router.refresh();
    });
  }

  return (
    <section className="mt-8">
      <h2 className="eyebrow mb-3 flex items-center gap-1.5">
        <Dumbbell size={13} strokeWidth={1.75} className="text-treino" /> Registrar {treino.nome}
      </h2>

      <div className="flex flex-col gap-3">
        {estado.map((ex, iEx) => {
          const pr = prDoExercicio(ex.nome);
          return (
            <div key={iEx} className="paper-card rounded-sm p-3">
              <div className="flex items-center gap-2">
                {ex.avulso ? (
                  <input
                    type="text"
                    value={ex.nome}
                    onChange={(e) => renomear(iEx, e.target.value)}
                    maxLength={60}
                    placeholder="exercício avulso"
                    className="min-w-0 flex-1 rounded-sm border border-rule bg-paper px-2 py-1 text-sm outline-none focus:border-treino"
                  />
                ) : (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{ex.nome}</p>
                    {ex.alvo && <p className="text-xs text-ink-faint">alvo {ex.alvo}</p>}
                  </div>
                )}
                {pr !== null && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs text-attention" title="seu recorde de carga">
                    <Trophy size={12} strokeWidth={1.75} /> {formatarCarga(pr)}
                  </span>
                )}
                {ex.avulso && (
                  <button type="button" aria-label="Remover exercício" onClick={() => removerAvulso(iEx)} className="tatil shrink-0 text-ink-faint hover:text-urgent">
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="mt-2 flex flex-col gap-1.5">
                {ex.series.map((s, iSerie) => (
                  <div key={iSerie} className="flex items-center gap-2">
                    <span className="w-5 shrink-0 text-center font-data text-xs text-ink-faint">{iSerie + 1}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      min="0"
                      value={s.carga}
                      onChange={(e) => mexerSerie(iEx, iSerie, "carga", e.target.value)}
                      placeholder="kg"
                      className="w-20 rounded-sm border border-rule bg-paper px-2 py-1 text-sm outline-none focus:border-treino"
                    />
                    <span className="text-xs text-ink-faint">×</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={s.reps}
                      onChange={(e) => mexerSerie(iEx, iSerie, "reps", e.target.value)}
                      placeholder="reps"
                      className="w-20 rounded-sm border border-rule bg-paper px-2 py-1 text-sm outline-none focus:border-treino"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-2 flex items-center gap-3">
                <button type="button" onClick={() => addSerie(iEx)} className="tatil inline-flex items-center gap-1 text-xs text-ink-soft hover:text-ink">
                  <Plus size={12} /> série
                </button>
                <button
                  type="button"
                  onClick={() => descansar(ex.descansoSeg ?? 60)}
                  className="tatil inline-flex items-center gap-1 text-xs text-ink-soft hover:text-treino"
                >
                  <Timer size={12} /> descanso {ex.descansoSeg ?? 60}s
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={addAvulso} className="tatil inline-flex items-center gap-1 rounded-sm border border-rule px-3 py-1.5 text-xs text-ink-soft hover:border-treino hover:text-ink">
          <Plus size={13} /> exercício avulso
        </button>
        <button
          type="button"
          disabled={pendente}
          onClick={registrar}
          className="tatil rounded-sm bg-treino px-4 py-2 text-sm font-medium text-treino-on shadow-sm transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {pendente ? "Registrando…" : "Registrar treino"}
        </button>
      </div>

      {erro && <p className="mt-2 text-sm text-urgent">{erro}</p>}
      {festa && <p className="mt-2 text-sm font-medium text-treino">{festa}</p>}

      {descanso !== null && (
        <div className="fixed inset-x-0 bottom-24 z-40 mx-auto w-max rounded-full bg-treino px-5 py-2 text-sm font-semibold text-treino-on shadow-lg" role="status">
          <Timer size={14} strokeWidth={2} className="mr-1.5 inline" />
          Descanso: {descanso}s
          <button type="button" onClick={() => { if (tickRef.current) clearInterval(tickRef.current); setDescanso(null); }} className="ml-3 underline underline-offset-2">
            pular
          </button>
        </div>
      )}
    </section>
  );
}

/** Painel de recordes de carga por exercício — os campeões do cliente. */
export function RecordesDeCarga({ recordes }: { recordes: RecordeExercicio[] }) {
  if (recordes.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="eyebrow mb-3 flex items-center gap-1.5">
        <Trophy size={13} strokeWidth={1.75} className="text-attention" /> Recordes de carga
      </h2>
      <ul className="flex flex-col gap-2">
        {recordes.slice(0, 8).map((r) => (
          <li key={r.exercicio} className="paper-card flex items-center justify-between gap-3 rounded-sm px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm">{r.exercicio}</span>
            <span className="font-data text-sm text-treino">{formatarCarga(r.melhorCargaKg)}</span>
            <span className="font-data text-xs text-ink-faint">1RM ~{formatarCarga(r.melhor1RM)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
