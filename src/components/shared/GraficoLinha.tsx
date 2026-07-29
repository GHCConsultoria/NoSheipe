interface Ponto {
  valor: number;
  rotulo: string;
}

interface Props {
  pontos: Ponto[];
  sufixo?: string;
}

const LARGURA = 320;
const ALTURA = 80;
const MARGEM = 6;

/**
 * Sparkline SVG — linha de tendência simples, sem biblioteca de gráfico.
 * Escala o eixo Y pelo min/max dos próprios dados (com uma folga), porque
 * a variação relevante aqui (ex.: peso ao longo de semanas) é pequena
 * perto do valor absoluto e sumiria num eixo começando do zero.
 */
export function GraficoLinha({ pontos, sufixo = "" }: Props) {
  if (pontos.length < 2) {
    return null;
  }

  const valores = pontos.map((p) => p.valor);
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  const amplitude = maximo - minimo || 1;

  const coordenadas = pontos.map((ponto, indice) => {
    const x = MARGEM + (indice / (pontos.length - 1)) * (LARGURA - MARGEM * 2);
    const y = ALTURA - MARGEM - ((ponto.valor - minimo) / amplitude) * (ALTURA - MARGEM * 2);
    return { x, y, ...ponto };
  });

  const linha = coordenadas.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const ultimo = coordenadas[coordenadas.length - 1];

  return (
    <div>
      <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} className="w-full" role="img" aria-label="Evolução ao longo do tempo">
        <polyline
          points={linha}
          fill="none"
          stroke="var(--color-sheipe)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coordenadas.map(({ x, y, rotulo }) => (
          <circle key={rotulo} cx={x} cy={y} r="2.5" fill="var(--color-sheipe)" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-ink-faint">
        <span>
          {pontos[0].rotulo} · {pontos[0].valor}
          {sufixo}
        </span>
        <span>
          {ultimo.rotulo} · {ultimo.valor}
          {sufixo}
        </span>
      </div>
    </div>
  );
}
