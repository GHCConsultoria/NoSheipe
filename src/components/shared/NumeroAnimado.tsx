"use client";

import { useContagem } from "@/components/shared/useContagem";

/**
 * Número que conta até o valor. Existe como componente, e não só como
 * hook, pra páginas de servidor poderem usá-lo sem virar client component
 * inteiras — só o número atravessa a fronteira.
 */
export function NumeroAnimado({ valor, sufixo = "" }: { valor: number; sufixo?: string }) {
  const exibido = useContagem(valor);
  return (
    <span className="tabular-nums">
      {exibido}
      {sufixo}
    </span>
  );
}
