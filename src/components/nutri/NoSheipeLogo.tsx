interface Props {
  size?: number;
  comTexto?: boolean;
}

// Flame-S — a marca oficial do SHEIPE: uma chama que também é um "S", com o
// tri-color do app (verde treino no topo, gold dieta no meio, ciano água na
// base) e o "S" recortado por dentro. Recorte via máscara pra ficar
// transparente de verdade em qualquer fundo (não pintado com a cor do tema).
export function NoSheipeLogo({ size = 28, comTexto = true }: Props) {
  return (
    <div className="flex items-center gap-2">
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        aria-hidden="true"
        style={{ filter: "drop-shadow(0 0 5px rgba(0, 255, 102, 0.45))" }}
      >
        <defs>
          <linearGradient id="sheipe-flame-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00FF66" />
            <stop offset="52%" stopColor="#FF9500" />
            <stop offset="100%" stopColor="#00D2FF" />
          </linearGradient>
          <mask id="sheipe-flame-mask">
            <rect width="100" height="100" fill="white" />
            <path
              d="M63 38 C63 30 41 29 41 43 C41 54 61 53 61 65 C61 79 38 78 38 66"
              fill="none"
              stroke="black"
              strokeWidth="9"
              strokeLinecap="round"
            />
          </mask>
        </defs>
        <path
          d="M52 6 C60 22 74 32 74 54 C74 78 60 94 48 96 C34 94 22 80 24 62 C25 53 32 50 36 44 C40 50 46 48 44 40 C42 30 48 18 52 6 Z"
          fill="url(#sheipe-flame-grad)"
          mask="url(#sheipe-flame-mask)"
        />
      </svg>
      {comTexto && (
        <span className="font-display text-lg font-semibold tracking-[0.14em] text-ink">SHEIPE</span>
      )}
    </div>
  );
}
