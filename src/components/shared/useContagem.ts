"use client";

import { useEffect, useRef, useState } from "react";

/** Mesma curva do resto do movimento, em JS. */
function suavizar(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

function prefereMenosMovimento(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Número que conta até o valor em vez de aparecer pronto.
 *
 * Devolve o valor final já na primeira renderização — no servidor e para
 * quem pediu menos movimento. A contagem é enfeite sobre um número que já
 * está certo: nunca existe um instante em que a tela mostra um dado falso
 * porque a animação ainda não chegou lá.
 *
 * Recontagem ao mudar de valor é de propósito: quando o cliente registra
 * uma refeição, ver o número subir é a confirmação de que entrou.
 */
export function useContagem(valor: number, duracaoMs = 900): number {
  const [exibido, setExibido] = useState(valor);
  const anteriorRef = useRef(valor);

  useEffect(() => {
    const de = anteriorRef.current;
    anteriorRef.current = valor;

    if (de === valor || prefereMenosMovimento()) {
      setExibido(valor);
      return;
    }

    let quadro = 0;
    const inicio = performance.now();

    const passo = (agora: number) => {
      const progresso = Math.min((agora - inicio) / duracaoMs, 1);
      setExibido(Math.round(de + (valor - de) * suavizar(progresso)));
      if (progresso < 1) quadro = requestAnimationFrame(passo);
    };

    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [valor, duracaoMs]);

  return exibido;
}
