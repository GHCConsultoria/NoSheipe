"use client";

import { useContagem } from "@/components/shared/useContagem";

export interface Arco {
  /** 0..N — pode passar de 100; o traço satura, o número não mente. */
  percentual: number;
  rotulo: string;
  /** Texto exato embaixo do rótulo: "1040 / 1800 kcal", "2 de 3 dias". */
  detalhe: string;
  cor: "sheipe" | "treino";
}

interface Props {
  arcos: Arco[];
  /** Diâmetro em px. */
  tamanho?: number;
}

const CAIXA = 200;
const ESPESSURA = 15;
/** Raios dos anéis, de fora pra dentro. */
const RAIOS = [86, 62];

const CORES: Record<Arco["cor"], { traco: string; texto: string }> = {
  sheipe: { traco: "var(--color-sheipe)", texto: "text-sheipe" },
  treino: { traco: "var(--color-treino)", texto: "text-treino" },
};

/**
 * O progresso do dia como anéis concêntricos.
 *
 * É a mesma forma da marca — a logo do NoSheipe já é um anel de progresso.
 * Em escala, ela deixa de ser enfeite no topo e passa a ser o dado: o
 * cliente abre o app e vê a própria meta desenhada no símbolo do produto.
 *
 * Dieta por fora, treino por dentro, sempre nessa ordem: posição fixa vale
 * mais que legenda quando a leitura é de um relance.
 */
export function AnelDeProgresso({ arcos, tamanho = 220 }: Props) {
  const principal = arcos[0];
  const numero = useContagem(principal?.percentual ?? 0);

  if (arcos.length === 0) return null;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: tamanho, height: tamanho }}>
        <svg viewBox={`0 0 ${CAIXA} ${CAIXA}`} width={tamanho} height={tamanho} aria-hidden="true">
          {/* -90° põe o início às 12h, que é onde se espera que comece. */}
          <g transform={`rotate(-90 ${CAIXA / 2} ${CAIXA / 2})`}>
            {arcos.map((arco, i) => {
              const raio = RAIOS[i] ?? RAIOS[RAIOS.length - 1];
              const circunferencia = 2 * Math.PI * raio;
              const fracao = Math.min(Math.max(arco.percentual, 0), 100) / 100;
              const restante = circunferencia * (1 - fracao);

              return (
                <g key={arco.rotulo}>
                  <circle
                    cx={CAIXA / 2}
                    cy={CAIXA / 2}
                    r={raio}
                    fill="none"
                    stroke="var(--color-rule)"
                    strokeWidth={ESPESSURA}
                  />
                  <circle
                    className="anel-preenche"
                    cx={CAIXA / 2}
                    cy={CAIXA / 2}
                    r={raio}
                    fill="none"
                    stroke={CORES[arco.cor].traco}
                    strokeWidth={ESPESSURA}
                    strokeLinecap="round"
                    strokeDasharray={circunferencia}
                    strokeDashoffset={restante}
                    style={
                      {
                        // O keyframe parte daqui: anel vazio. Fica como
                        // custom property pra cada raio ter o seu.
                        "--anel-vazio": circunferencia,
                        animationDelay: `${i * 120}ms`,
                      } as React.CSSProperties
                    }
                  />
                </g>
              );
            })}
          </g>
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-display text-5xl leading-none tabular-nums ${CORES[principal.cor].texto}`}>
            {numero}
            <span className="text-2xl">%</span>
          </span>
          <span className="eyebrow mt-1.5">{principal.rotulo}</span>
        </div>
      </div>

      <dl className="mt-5 flex w-full flex-col gap-2">
        {arcos.map((arco) => (
          <div key={arco.rotulo} className="flex items-baseline gap-2.5 text-sm">
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: CORES[arco.cor].traco }}
            />
            <dt className="eyebrow">{arco.rotulo}</dt>
            <dd className="ml-auto text-right text-xs text-ink-soft">
              <span className={`font-data tabular-nums ${CORES[arco.cor].texto}`}>{arco.percentual}%</span>
              <span className="text-ink-faint"> · {arco.detalhe}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
