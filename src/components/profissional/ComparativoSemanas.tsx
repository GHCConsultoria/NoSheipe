import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { ComparacaoSemanas } from "@/lib/profissional/consultas";
import type { Comparacao } from "@/lib/profissional/comparacao";

/**
 * Comparativo dos últimos 7 dias contra os 7 anteriores. Componente de
 * servidor — é só leitura, sem interação. Métricas de engajamento (dias,
 * registros) sobem = verde; kcal média é neutra, porque "melhor" depende da
 * meta, e o profissional é quem lê o sentido.
 */
export function ComparativoSemanas({ comparacao }: { comparacao: ComparacaoSemanas }) {
  if (!comparacao.nutricao && !comparacao.treino) return null;

  return (
    <section className="paper-card mt-6 rounded-sm p-6">
      <h2 className="eyebrow">Comparativo</h2>
      <p className="-mt-0.5 mb-4 text-xs text-ink-faint">Últimos 7 dias vs. 7 anteriores.</p>

      <div className="flex flex-col gap-5">
        {comparacao.nutricao && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-medium text-ink-soft">Nutrição</h3>
            <Metrica rotulo="Dias com registro" c={comparacao.nutricao.dias} />
            <Metrica rotulo="Refeições" c={comparacao.nutricao.refeicoes} />
            <Metrica rotulo="Kcal média/refeição" c={comparacao.nutricao.kcalMedia} neutra />
          </div>
        )}
        {comparacao.treino && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-medium text-ink-soft">Treino</h3>
            <Metrica rotulo="Sessões" c={comparacao.treino.sessoes} />
            <Metrica rotulo="Dias treinados" c={comparacao.treino.dias} />
          </div>
        )}
      </div>
    </section>
  );
}

function Metrica({ rotulo, c, neutra = false }: { rotulo: string; c: Comparacao; neutra?: boolean }) {
  const Icone = c.direcao === "subiu" ? ArrowUp : c.direcao === "desceu" ? ArrowDown : Minus;
  // Sem julgar valor quando neutra; senão, subir é bom.
  const cor = neutra
    ? "text-ink-soft"
    : c.direcao === "subiu"
      ? "text-calm"
      : c.direcao === "desceu"
        ? "text-urgent"
        : "text-ink-faint";

  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-ink-soft">{rotulo}</span>
      <span className="flex items-baseline gap-2">
        <span className="font-data">{c.atual}</span>
        <span className={`inline-flex items-center gap-0.5 text-xs ${cor}`}>
          <Icone size={13} strokeWidth={2} />
          {c.delta !== 0 && Math.abs(c.delta)}
        </span>
        <span className="font-data text-xs text-ink-faint">antes {c.anterior}</span>
      </span>
    </div>
  );
}
