"use client";

/**
 * O anel de progresso em escala de lista.
 *
 * É a mesma forma do herói da tela do cliente, e da marca. Repetir o
 * símbolo nas duas pontas é o que faz o profissional e o cliente
 * enxergarem a mesma coisa: quando ela diz "estou em 58%", ele já viu
 * aquele arco no painel dele.
 *
 * Sem número dentro — nesse tamanho não caberia legível. O número fica ao
 * lado, na linha.
 */
export function AnelCompacto({
  percentual,
  cor,
  tamanho = 38,
  atrasoMs = 0,
}: {
  percentual: number;
  cor: "sheipe" | "treino" | "urgent";
  tamanho?: number;
  atrasoMs?: number;
}) {
  const CAIXA = 44;
  const raio = 18;
  const espessura = 6;
  const circunferencia = 2 * Math.PI * raio;
  const fracao = Math.min(Math.max(percentual, 0), 100) / 100;

  const traco =
    cor === "sheipe" ? "var(--color-sheipe)" : cor === "treino" ? "var(--color-treino)" : "var(--color-urgent)";

  return (
    <svg viewBox={`0 0 ${CAIXA} ${CAIXA}`} width={tamanho} height={tamanho} aria-hidden="true" className="shrink-0">
      <g transform={`rotate(-90 ${CAIXA / 2} ${CAIXA / 2})`}>
        <circle cx={CAIXA / 2} cy={CAIXA / 2} r={raio} fill="none" stroke="var(--color-rule)" strokeWidth={espessura} />
        <circle
          className="anel-preenche"
          cx={CAIXA / 2}
          cy={CAIXA / 2}
          r={raio}
          fill="none"
          stroke={traco}
          strokeWidth={espessura}
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          strokeDashoffset={circunferencia * (1 - fracao)}
          style={
            {
              "--anel-vazio": circunferencia,
              animationDelay: `${atrasoMs}ms`,
            } as React.CSSProperties
          }
        />
      </g>
    </svg>
  );
}
