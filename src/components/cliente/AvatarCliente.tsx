interface Props {
  /** Data URL da foto; ausente = mostra a inicial do nome. */
  fotoUrl?: string | null;
  nome: string;
  /** Lado do avatar em pixels. */
  tamanho?: number;
  className?: string;
}

/**
 * Avatar do cliente — a foto quando existe, senão a inicial do nome num
 * círculo verde. Presentacional e sem estado, pra servir tanto ao topo das
 * telas quanto à tela de trocar a foto. Usa <img> cru (não next/image)
 * porque a fonte é um data URL, que o otimizador do Next não processa.
 */
export function AvatarCliente({ fotoUrl, nome, tamanho = 36, className = "" }: Props) {
  const inicial = nome.trim().charAt(0).toUpperCase() || "?";
  const estilo = { width: tamanho, height: tamanho };

  if (fotoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fotoUrl}
        alt={`Foto de ${nome}`}
        style={estilo}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{ ...estilo, fontSize: Math.round(tamanho * 0.4) }}
      className={`flex shrink-0 items-center justify-center rounded-full bg-sheipe font-medium text-sheipe-on ${className}`}
    >
      {inicial}
    </span>
  );
}
