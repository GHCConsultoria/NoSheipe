interface Props {
  size?: number;
  comTexto?: boolean;
}

export function NoSheipeLogo({ size = 28, comTexto = true }: Props) {
  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
        <rect width="100" height="100" rx="24" fill="#0a0f0c" />
        <g transform="rotate(45 50 50)">
          <path d="M50 14 A48 48 0 0 1 50 86 A48 48 0 0 1 50 14 Z" fill="#22c55e" />
          <line x1="50" y1="86" x2="50" y2="97" stroke="#166534" strokeWidth={5} strokeLinecap="round" />
        </g>
      </svg>
      {comTexto && (
        <span className="font-display text-lg tracking-tight">
          No<span style={{ color: "var(--color-sheipe)" }}>Sheipe</span>
        </span>
      )}
    </div>
  );
}
