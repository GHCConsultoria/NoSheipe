interface Props {
  size?: number;
  comTexto?: boolean;
}

// Anel de progresso — a mesma linguagem visual dos cartões de macro (% da
// meta batida), só que na marca: bater a meta é literalmente o que o
// produto acompanha.
const RAIO = 30;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;
const PROGRESSO = 0.74;

export function NoSheipeLogo({ size = 28, comTexto = true }: Props) {
  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
        <rect width="100" height="100" rx="24" fill="#0a0f0c" />
        <circle cx="50" cy="50" r={RAIO} fill="none" stroke="#1c3326" strokeWidth="11" />
        <circle
          cx="50"
          cy="50"
          r={RAIO}
          fill="none"
          stroke="#22c55e"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={`${CIRCUNFERENCIA * PROGRESSO} ${CIRCUNFERENCIA}`}
          transform="rotate(-90 50 50)"
        />
      </svg>
      {comTexto && (
        <span className="font-display text-lg tracking-tight">
          No<span style={{ color: "var(--color-sheipe)" }}>Sheipe</span>
        </span>
      )}
    </div>
  );
}
