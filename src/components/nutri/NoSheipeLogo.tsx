import Image from "next/image";

interface Props {
  size?: number;
  comTexto?: boolean;
}

/** Proporção largura/altura da marca (o "S" de elos entrelaçados do SHEIPE). */
const RAZAO_MARCA = 450 / 531;

// Marca oficial do SHEIPE: o "S" de elos entrelaçados, verde neon. É o
// arquivo do logo (public/icons/sheipe-s.png), não um desenho aproximado.
export function NoSheipeLogo({ size = 28, comTexto = true }: Props) {
  const altura = size + 4;
  return (
    <div className="flex items-center gap-2">
      <Image
        src="/icons/sheipe-s.png"
        alt="SHEIPE"
        width={Math.round(altura * RAZAO_MARCA)}
        height={altura}
        style={{ filter: "drop-shadow(0 0 4px rgba(0, 255, 102, 0.4))" }}
      />
      {comTexto && (
        <span className="font-display text-lg font-semibold tracking-[0.14em] text-ink">SHEIPE</span>
      )}
    </div>
  );
}
