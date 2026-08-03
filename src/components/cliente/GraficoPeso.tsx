"use client";

import { useMemo, useState } from "react";

export interface PontoPeso {
  valor: number;
  rotulo: string;
  iso: string;
}

type Periodo = "dia" | "semana" | "mes" | "6m" | "tudo";

const PERIODOS: { chave: Periodo; rotulo: string; dias: number }[] = [
  { chave: "dia", rotulo: "Dia", dias: 1 },
  { chave: "semana", rotulo: "Semana", dias: 7 },
  { chave: "mes", rotulo: "Mês", dias: 30 },
  { chave: "6m", rotulo: "6M", dias: 180 },
  { chave: "tudo", rotulo: "Tudo", dias: Infinity },
];

const LARG = 320;
const ALT = 150;
const M = { esq: 34, dir: 8, topo: 12, baixo: 22 };
const PLOT_L = LARG - M.esq - M.dir;
const PLOT_A = ALT - M.topo - M.baixo;

/**
 * Evolução de peso num plano cartesiano de verdade — eixo Y em kg, eixo X no
 * tempo — com abas de período (Dia/Semana/Mês/6M/Tudo). Sem biblioteca de
 * gráfico: o SVG é montado à mão a partir dos pontos filtrados pelo período.
 * O Y escala pelo min/max dos dados (com folga), porque a variação de peso é
 * pequena perto do valor absoluto e sumiria num eixo começando do zero.
 */
export function GraficoPeso({ pontos }: { pontos: PontoPeso[] }) {
  const [periodo, setPeriodo] = useState<Periodo>("semana");

  const filtrados = useMemo(() => {
    const cfg = PERIODOS.find((p) => p.chave === periodo);
    if (!cfg || cfg.dias === Infinity) return pontos;
    const corte = Date.now() - cfg.dias * 24 * 60 * 60 * 1000;
    return pontos.filter((p) => new Date(p.iso).getTime() >= corte);
  }, [pontos, periodo]);

  return (
    <div>
      <div className="mb-3 flex gap-1.5">
        {PERIODOS.map((p) => (
          <button
            key={p.chave}
            type="button"
            onClick={() => setPeriodo(p.chave)}
            aria-pressed={periodo === p.chave}
            className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
              periodo === p.chave
                ? "bg-sheipe font-medium text-sheipe-on"
                : "border border-rule text-ink-soft hover:border-sheipe hover:text-ink"
            }`}
          >
            {p.rotulo}
          </button>
        ))}
      </div>

      {filtrados.length < 2 ? (
        <p className="py-8 text-center text-sm text-ink-faint">Poucos registros neste período pra desenhar a curva.</p>
      ) : (
        <Plano pontos={filtrados} />
      )}
    </div>
  );
}

function Plano({ pontos }: { pontos: PontoPeso[] }) {
  const valores = pontos.map((p) => p.valor);
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  const amplitude = maximo - minimo || 1;
  // Uma folga de 12% em cima e embaixo pra a linha não colar nas bordas.
  const folga = amplitude * 0.12;
  const yMin = minimo - folga;
  const yMax = maximo + folga;

  const t0 = new Date(pontos[0].iso).getTime();
  const t1 = new Date(pontos[pontos.length - 1].iso).getTime();
  const spanT = t1 - t0 || 1;

  const coord = pontos.map((p, i) => {
    const fx = pontos.length === 1 ? 0.5 : (new Date(p.iso).getTime() - t0) / spanT;
    const x = M.esq + fx * PLOT_L;
    const y = M.topo + (1 - (p.valor - yMin) / (yMax - yMin)) * PLOT_A;
    return { x, y, ...p, ultimo: i === pontos.length - 1 };
  });

  const linha = coord.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `M${coord[0].x.toFixed(1)},${(M.topo + PLOT_A).toFixed(1)} L${linha
    .split(" ")
    .join(" L")} L${coord[coord.length - 1].x.toFixed(1)},${(M.topo + PLOT_A).toFixed(1)} Z`;

  // Três linhas de grade no Y: base, meio, topo — com o rótulo em kg.
  const grades = [yMax, (yMax + yMin) / 2, yMin].map((valor) => ({
    valor,
    y: M.topo + (1 - (valor - yMin) / (yMax - yMin)) * PLOT_A,
  }));

  // Poucos rótulos no X pra não embolar: primeiro, meio e último.
  const marcasX = [coord[0], coord[Math.floor(coord.length / 2)], coord[coord.length - 1]];

  return (
    <div>
      <svg viewBox={`0 0 ${LARG} ${ALT}`} className="w-full" role="img" aria-label="Evolução de peso">
        {grades.map((g) => (
          <g key={g.valor}>
            <line x1={M.esq} y1={g.y} x2={LARG - M.dir} y2={g.y} stroke="var(--color-rule)" strokeWidth={1} />
            <text x={M.esq - 5} y={g.y + 3} textAnchor="end" className="fill-ink-faint" style={{ fontSize: 9 }}>
              {g.valor.toFixed(1)}
            </text>
          </g>
        ))}

        <path d={area} fill="var(--color-sheipe)" opacity={0.12} />
        <polyline
          points={linha}
          fill="none"
          stroke="var(--color-sheipe)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coord.map(({ x, y, iso, ultimo }) => (
          <circle key={iso} cx={x} cy={y} r={ultimo ? 3.5 : 2} fill="var(--color-sheipe)" />
        ))}

        {marcasX.map((m, i) => (
          <text
            key={`${m.iso}-${i}`}
            x={m.x}
            y={ALT - 6}
            textAnchor={i === 0 ? "start" : i === marcasX.length - 1 ? "end" : "middle"}
            className="fill-ink-faint"
            style={{ fontSize: 9 }}
          >
            {m.rotulo}
          </text>
        ))}
      </svg>
      <p className="mt-1 text-center text-xs text-ink-faint">
        {pontos[0].valor} kg → <span className="text-ink-soft">{pontos[pontos.length - 1].valor} kg</span>
      </p>
    </div>
  );
}
